// Prepare user-data for cloud-init to initialize the instance
export const cloudInitUserDataJupyterContainer = (instanceSystemToken: string, username: string, instance_id: string, webdavServer: string, webdavMountPath: string, jupyterPort: number) =>`
#cloud-config
packages:
  - davfs2
users:
  - name: ubuntu
    groups: sudo
    sudo: "ALL=(ALL) NOPASSWD:ALL"
    shell: /bin/bash
write_files:
  - path: /etc/bash.bashrc
    append: true
    content: |
      # Set proxy environment variables
      export HTTP_PROXY=http://127.0.0.1:3128
      export HTTPS_PROXY=http://127.0.0.1:3128
      export NO_PROXY=127.0.0.1,localhost
    permissions: '0644'
  - path: /etc/systemd/system.conf.d/proxy.conf
    content: |
      [Manager]
      DefaultEnvironment="HTTP_PROXY=http://127.0.0.1:3128" "HTTPS_PROXY=http://127.0.0.1:3128" "NO_PROXY=127.0.0.1,localhost"
    permissions: '0644'
  - path: /root/.ipython/profile_default/startup/00-proxy.py
    content: |
      import os
      os.environ['HTTP_PROXY'] = 'http://127.0.0.1:3128'
      os.environ['HTTPS_PROXY'] = 'http://127.0.0.1:3128'
      os.environ['NO_PROXY'] = '127.0.0.1,localhost'
    permissions: '0644'
  - path: /etc/davfs2/davfs2.conf
    content: |
      ask_auth        0
      use_locks       0
      precheck        1
      read_timeout    60
      retry           30
      max_retry       300
      dir_refresh     0
      file_refresh    1
      delay_upload    30
      gui_optimize    0
      use_compression 0
      min_propset     0
      drop_weak_etags 1
      ignore_dav_header 1

      [/home/\${DEFAULT_USER}/${username}_Drive}]
      follow_redirect 1

      # Add WebDAV authentication
      add_header Authorization "Bearer ${instanceSystemToken}"
    append: true
    permissions: '0644'
  - path: /etc/systemd/system/webdav-mount.service
    content: |
      [Unit]
      Description=Mount WebDAV on startup
      After=network.target
      [Service]
      Type=oneshot

      ExecStartPre=/bin/bash -c '\
          if [ -d ${webdavMountPath} ]; then \
              echo "Clearing existing mount point"; \
              fusermount -u ${webdavMountPath} 2>/dev/null; \
              rm -rf ${webdavMountPath}; \
          fi; \
          mkdir -p ${webdavMountPath}'

      ExecStartPre=/bin/bash -c '\
          chown ubuntu:ubuntu ${webdavMountPath}; \
          chmod 755 ${webdavMountPath}'

      ExecStart=/bin/mount -t davfs ${webdavServer} ${webdavMountPath} \
          -o rw,uid=ubuntu,gid=ubuntu,_netdev,auto
      
      ExecStartPost=/bin/bash -c '\
          MOUNT_STATUS=$?; \
          if [ $MOUNT_STATUS -ne 0 ]; then \
              echo "WebDAV Mount Failed with status $MOUNT_STATUS"; \
              journalctl -xe | grep -A 20 "WebDAV Mount"; \
          else \
              echo "WebDAV Mount Successful"; \
          fi'

      ExecStop=/bin/bash -c '\
          fusermount -u ${webdavMountPath} 2>/dev/null; \
          rmdir ${webdavMountPath} 2>/dev/null'

      RemainAfterExit=yes
      User=root
      Group=root
      [Install]
      WantedBy=multi-user.target
    permissions: '0644'
  - path: /root/.jupyter/jupyter_notebook_config.py
    content: |
      c.NotebookApp.ip = "0.0.0.0"
      c.NotebookApp.port = ${jupyterPort}
      c.NotebookApp.open_browser = False
      c.NotebookApp.token = ""
      c.NotebookApp.password = ""
      c.NotebookApp.allow_root = True
      c.NotebookApp.base_url = "/jupyter/${instance_id}"
      c.NotebookApp.notebook_dir = "/home/ubuntu"
      c.Spawner.environment = {
        'HTTP_PROXY': 'http://127.0.0.1:3128',
        'HTTPS_PROXY': 'http://127.0.0.1:3128',
        'NO_PROXY': '127.0.0.1,localhost'
      }
    permissions: '0644'
  - path: /etc/systemd/system/jupyter.service
    content: |
      [Unit]
      Description=Jupyter Notebook Server
      After=network.target
      [Service]
      Type=simple
      User=root
      Environment="HTTP_PROXY=http://127.0.0.1:3128"
      Environment="HTTPS_PROXY=http://127.0.0.1:3128"
      Environment="NO_PROXY=127.0.0.1,localhost"
      ExecStartPre=/bin/bash -c 'pkill -f jupyter || true'
      ExecStartPre=/bin/sleep 2
      ExecStart=/usr/bin/python3 /usr/local/bin/jupyter-notebook --config=/root/.jupyter/jupyter_notebook_config.py --allow-root
      WorkingDirectory=/root
      Restart=always
      EnvironmentFile=/etc/environment
      [Install]
      WantedBy=multi-user.target
    permissions: '0644'
runcmd:
  - |
    DEFAULT_USER="\${USERNAME:-ubuntu}"
    if ! getent group nopasswdlogin > /dev/null; then
      addgroup nopasswdlogin
    fi
    if ! id -u \${DEFAULT_USER} > /dev/null 2>&1; then
      adduser \${DEFAULT_USER} nopasswdlogin || true
    fi
    passwd -d \${DEFAULT_USER} || true
    echo "@reboot \${DEFAULT_USER} DISPLAY=:0 /home/\${DEFAULT_USER}/disable_autolock.sh" | crontab -u \${DEFAULT_USER} -
    cat << 'EOF' > "/home/\${DEFAULT_USER}/disable_autolock.sh"
    #!/bin/bash
    if [ -z "\${DISPLAY}" ]; then
      echo "No DISPLAY available. Skipping GUI settings."
    else
      dbus-launch gsettings set org.gnome.desktop.screensaver lock-enabled false
      dbus-launch gsettings set org.gnome.desktop.session idle-delay 0
    fi
    EOF
    chmod +x "/home/\${DEFAULT_USER}/disable_autolock.sh"
    chown \${DEFAULT_USER}: "/home/\${DEFAULT_USER}/disable_autolock.sh"
    mkdir -p /usr/local/share/jupyter/kernels/python3
    cat > /usr/local/share/jupyter/kernels/python3/kernel.json << EOF
    {
      "argv": ["/usr/bin/python3", "-m", "ipykernel_launcher", "-f", "{connection_file}"],
      "display_name": "Python 3",
      "language": "python",
      "env": {
        "HTTP_PROXY": "http://127.0.0.1:3128",
        "HTTPS_PROXY": "http://127.0.0.1:3128",
        "NO_PROXY": "127.0.0.1,localhost"
      }
    }
    EOF
  - sleep 10
  - systemctl daemon-reload
  - systemctl restart systemd-journald
  - systemctl enable webdav-mount.service
  - systemctl start webdav-mount.service
  - |
    if [ -d "/home/\${DEFAULT_USER}" ]; then
      if [ ! -e "/home/\${DEFAULT_USER}/${username}_Drive" ]; then
        ln -sf ${webdavMountPath} "/home/\${DEFAULT_USER}/${username}_Drive"
        chown \${DEFAULT_USER}:\${DEFAULT_USER} "/home/\${DEFAULT_USER}/${username}_Drive"
      fi
    fi
`;


// to the cloud-init file  as the container's environment variables
export  const cloudInitUserDataMatlabContainer =  (instanceSystemToken: string, username: string, instance_id: string, webdavServer: string, webdavMountPath: string) =>`
#cloud-config
packages:
  - davfs2
users:
  - name: ubuntu
    groups: sudo
    sudo: "ALL=(ALL) NOPASSWD:ALL"
    shell: /bin/bash
write_files:
  - path: /etc/bash.bashrc
    append: true
    content: |
      # Set proxy environment variables
      export HTTP_PROXY=http://127.0.0.1:3128
      export HTTPS_PROXY=http://127.0.0.1:3128
      export NO_PROXY=127.0.0.1,localhost
    permissions: '0644'
  - path: /etc/systemd/system.conf.d/proxy.conf
    content: |
      [Manager]
      DefaultEnvironment="HTTP_PROXY=http://127.0.0.1:3128" "HTTPS_PROXY=http://127.0.0.1:3128" "NO_PROXY=127.0.0.1,localhost"
    permissions: '0644'
  - path: /root/.ipython/profile_default/startup/00-proxy.py
    content: |
      import os
      os.environ['HTTP_PROXY'] = 'http://127.0.0.1:3128'
      os.environ['HTTPS_PROXY'] = 'http://127.0.0.1:3128'
      os.environ['NO_PROXY'] = '127.0.0.1,localhost'
    permissions: '0644'
  - path: /etc/davfs2/davfs2.conf
    content: |
      ask_auth        0
      use_locks       0
      precheck        1
      read_timeout    60
      retry           30
      max_retry       300
      dir_refresh     0
      file_refresh    1
      delay_upload    30
      gui_optimize    0
      use_compression 0
      min_propset     0
      drop_weak_etags 1
      ignore_dav_header 1

      [/home/\${DEFAULT_USER}/${username}_Drive}]
      follow_redirect 1

      # Add WebDAV authentication
      add_header Authorization "Bearer ${instanceSystemToken}"
    append: true
    permissions: '0644'
  - path: /etc/systemd/system/webdav-mount.service
    content: |
      [Unit]
      Description=Mount WebDAV on startup
      After=network.target
      [Service]
      Type=oneshot

      ExecStartPre=/bin/bash -c '\
          if [ -d ${webdavMountPath} ]; then \
              echo "Clearing existing mount point"; \
              fusermount -u ${webdavMountPath} 2>/dev/null; \
              rm -rf ${webdavMountPath}; \
          fi; \
          mkdir -p ${webdavMountPath}'

      ExecStartPre=/bin/bash -c '\
          chown ubuntu:ubuntu ${webdavMountPath}; \
          chmod 755 ${webdavMountPath}'

      ExecStart=/bin/mount -t davfs ${webdavServer} ${webdavMountPath} \
          -o rw,uid=ubuntu,gid=ubuntu,_netdev,auto
      
      ExecStartPost=/bin/bash -c '\
          MOUNT_STATUS=$?; \
          if [ $MOUNT_STATUS -ne 0 ]; then \
              echo "WebDAV Mount Failed with status $MOUNT_STATUS"; \
              journalctl -xe | grep -A 20 "WebDAV Mount"; \
          else \
              echo "WebDAV Mount Successful"; \
          fi'

      ExecStop=/bin/bash -c '\
          fusermount -u ${webdavMountPath} 2>/dev/null; \
          rmdir ${webdavMountPath} 2>/dev/null'

      RemainAfterExit=yes
      User=root
      Group=root
      Restart=always
      EnvironmentFile=/etc/environment
      [Install]
      WantedBy=multi-user.target
    permissions: '0644'
  - path: /etc/nginx/sites-available/vnc_proxy
    content: |
        server {
            listen 8888;
            server_name _;
            # Use the instance_id in the path:
            location ~ ^/matlab/${instance_id}(/.*)?$ {
                # Strip the prefix and forward to noVNC on 6080
                rewrite ^/matlab/${instance_id}(/.*)$ $1 break;
                proxy_pass http://localhost:6080;
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection $http_connection;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;

                # Increase timeouts
                proxy_read_timeout  36000;
                proxy_send_timeout  36000;
            }
            location / {
                return 404;
            }
        }
    permissions: '0644'
runcmd:
  - |
    DEFAULT_USER="\${USERNAME:-ubuntu}"
    if ! getent group nopasswdlogin > /dev/null; then
      addgroup nopasswdlogin
    fi
    if ! id -u \${DEFAULT_USER} > /dev/null 2>&1; then
      adduser \${DEFAULT_USER} nopasswdlogin || true
    fi
    passwd -d \${DEFAULT_USER} || true
    echo "@reboot \${DEFAULT_USER} DISPLAY=:0 /home/\${DEFAULT_USER}/disable_autolock.sh" | crontab -u \${DEFAULT_USER} -
    cat << 'EOF' > "/home/\${DEFAULT_USER}/disable_autolock.sh"
    #!/bin/bash
    if [ -z "\${DISPLAY}" ]; then
      echo "No DISPLAY available. Skipping GUI settings."
    else
      dbus-launch gsettings set org.gnome.desktop.screensaver lock-enabled false
      dbus-launch gsettings set org.gnome.desktop.session idle-delay 0
    fi
    EOF
    chmod +x "/home/\${DEFAULT_USER}/disable_autolock.sh"
    chown \${DEFAULT_USER}: "/home/\${DEFAULT_USER}/disable_autolock.sh"
    mkdir -p /usr/local/share/jupyter/kernels/python3
    cat > /usr/local/share/jupyter/kernels/python3/kernel.json << EOF
    {
      "argv": ["/usr/bin/python3", "-m", "ipykernel_launcher", "-f", "{connection_file}"],
      "display_name": "Python 3",
      "language": "python",
      "env": {
        "HTTP_PROXY": "http://127.0.0.1:3128",
        "HTTPS_PROXY": "http://127.0.0.1:3128",
        "NO_PROXY": "127.0.0.1,localhost"
      }
    }
    EOF
  - sleep 10
  - systemctl daemon-reload
  - systemctl enable webdav-mount.service
  - systemctl start webdav-mount.service
  - |
    if [ -d "/home/\${DEFAULT_USER}" ]; then
      if [ ! -e "/home/\${DEFAULT_USER}/${username}_Drive" ]; then
        ln -sf ${webdavMountPath} "/home/\${DEFAULT_USER}/${username}_Drive"
        chown \${DEFAULT_USER}:\${DEFAULT_USER} "/home/\${DEFAULT_USER}/${username}_Drive"
      fi
    fi
`;



export const __unused_cloudInitUserDataVM =  (instanceSystemToken: string, username: string, webdavServer: string, webdavMountPath: string) =>`
#cloud-config
packages:
    - lxd-agent
    - davfs2
users:
    - name: ubuntu
    groups: sudo
    sudo: "ALL=(ALL) NOPASSWD:ALL"
    shell: /bin/bash
write_files:
    - path: /etc/environment
      content: |
          PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin"
          HTTP_PROXY=http://127.0.0.1:3128
          HTTPS_PROXY=http://127.0.0.1:3128
          NO_PROXY=127.0.0.1,localhost
        permissions: '0644'
    - path: /etc/davfs2/secrets
        content: |
          ${webdavServer} ubuntu ${instanceSystemToken}
        permissions: '0600'
    - path: /etc/systemd/system/webdav-mount.service
        content: |
          [Unit]
          Description=Mount WebDAV on startup
          After=network.target
          [Service]
          Type=oneshot
          ExecStart=/bin/mount -t davfs ${webdavServer} ${webdavMountPath} -o rw,uid=ubuntu,gid=ubuntu
          ExecStartPre=/bin/mkdir -p ${webdavMountPath}
          RemainAfterExit=true
          [Install]
           WantedBy=multi-user.target
        permissions: '0644'
runcmd:
    # Removing MATLAB licenses
    - rm -rf /usr/local/MATLAB/R2022b/licenses/
    - rm /home/ubuntu/.matlab/R2022b_licenses/license_matlab-ubuntu-vm_600177_R2022b.lic
    - rm /usr/local/MATLAB/R2022b/licenses/license.dat
    - rm /usr/local/MATLAB/R2022b/licenses/license*.lic
    # Apply netplan configuration
    - netplan apply
    # New commands for user setup
    - |
        DEFAULT_USER="\${USERNAME:-ubuntu}"
        if ! getent group nopasswdlogin > /dev/null; then
        addgroup nopasswdlogin
        fi
        if ! id -u \${DEFAULT_USER} > /dev/null 2>&1; then
        adduser \${DEFAULT_USER} nopasswdlogin || true
        fi
        passwd -d \${DEFAULT_USER} || true
        echo "@reboot \${DEFAULT_USER} DISPLAY=:0 /home/\${DEFAULT_USER}/disable_autolock.sh" | crontab -u \${DEFAULT_USER} -
        cat << 'EOF' > "/home/\${DEFAULT_USER}/disable_autolock.sh"
        #!/bin/bash
        if [ -z "\${DISPLAY}" ]; then
        echo "No DISPLAY available. Skipping GUI settings."
        else
        dbus-launch gsettings set org.gnome.desktop.screensaver lock-enabled false
        dbus-launch gsettings set org.gnome.desktop.session idle-delay 0
        fi
        EOF
        chmod +x "/home/\${DEFAULT_USER}/disable_autolock.sh"
        chown \${DEFAULT_USER}: "/home/\${DEFAULT_USER}/disable_autolock.sh"
    - sleep 10
    - systemctl daemon-reload
    - systemctl enable webdav-mount.service
    - systemctl start webdav-mount.service
    - | 
        if [ -d "/home/\${DEFAULT_USER}/Desktop" ]; then
        ln -sf ${webdavMountPath} "/home/\${DEFAULT_USER}/Desktop/${username}_Drive"
        chown \${DEFAULT_USER}:\${DEFAULT_USER} "/home/\${DEFAULT_USER}/Desktop/${username}_Drive"
        fi
        if [ -d "/home/\${DEFAULT_USER}" ]; then
            if [ ! -e "/home/\${DEFAULT_USER}/${username}_Drive" ]; then
                ln -sf ${webdavMountPath} "/home/\${DEFAULT_USER}/${username}_Drive"
                chown \${DEFAULT_USER}:\${DEFAULT_USER} "/home/\${DEFAULT_USER}/${username}_Drive"
            fi
        fi
    - . /etc/profile.d/dmpy.sh
    - . /etc/profile.d/instance_token.sh
`;