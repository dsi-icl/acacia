// Prepare user-data for cloud-init to initialize the instance
export const cloudInitUserDataJupyterContainer = (instanceSystemToken: string, username: string, instance_id: string, jupyterPort: number) =>`
#cloud-config
users:
  - name: ubuntu
    groups: sudo,root
    sudo: "ALL=(ALL) NOPASSWD:ALL"
    shell: /bin/bash
write_files:
  - path: /etc/profile.d/instance_token.sh
    content: |
      #!/bin/bash
      export DMP_TOKEN="${instanceSystemToken}"
      export HTTP_PROXY=http://127.0.0.1:3128  
      export HTTPS_PROXY=http://127.0.0.1:3128  
      export NO_PROXY=127.0.0.1,localhost  
    permissions: '0755'
  - path: /etc/apt/apt.conf.d/95proxy
    content: |
      Acquire::http::Proxy "http://127.0.0.1:3128";
      Acquire::https::Proxy "http://127.0.0.1:3128";
      Acquire::http::Proxy "http://[::1]:3128";
      Acquire::https::Proxy "http://[::1]:3128";
    permissions: '0644'
  - path: /etc/bash.bashrc
    append: true
    content: |
      export HTTP_PROXY=http://127.0.0.1:3128
      export HTTPS_PROXY=http://127.0.0.1:3128
      export NO_PROXY=127.0.0.1,localhost
      export http_proxy=$HTTP_PROXY
      export https_proxy=$HTTPS_PROXY
      export no_proxy=$NO_PROXY
      export DMP_TOKEN="${instanceSystemToken}"
    permissions: '0644'
  - path: /etc/systemd/system.conf.d/proxy.conf
    content: |
      [Manager]
      DefaultEnvironment="HTTP_PROXY=http://127.0.0.1:3128" "HTTPS_PROXY=http://127.0.0.1:3128" "NO_PROXY=127.0.0.1,localhost"
    permissions: '0644'
  - path: /root/.ipython/profile_default/startup/00-proxy.py
    content: |
      import os
      import sys
      os.environ['HTTP_PROXY'] = 'http://127.0.0.1:3128'
      os.environ['HTTPS_PROXY'] = 'http://127.0.0.1:3128'
      os.environ['NO_PROXY'] = '127.0.0.1,localhost'
      os.environ['DMP_TOKEN'] = '${instanceSystemToken}'
      sys.path.insert(0, '/root/dmpy')
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
        'PYTHONPATH': '/root/dmpy:$PYTHONPATH',
        'HTTP_PROXY': 'http://127.0.0.1:3128',
        'HTTPS_PROXY': 'http://127.0.0.1:3128',
        'NO_PROXY': '127.0.0.1,localhost',
        'DMP_TOKEN': '${instanceSystemToken}'
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
      EnvironmentFile=-/etc/environment
      ExecStart=/usr/bin/python3 /usr/local/bin/jupyter-notebook --config=/root/.jupyter/jupyter_notebook_config.py  --allow-root
      WorkingDirectory=/root
      Restart=always
      RestartSec=60
      StartLimitInterval=300
      StartLimitBurst=5
      [Install]
      WantedBy=multi-user.target
    permissions: '0644'
runcmd:
  - |  
    grep -qxF 'DMP_TOKEN="${instanceSystemToken}"' /etc/environment || \
    echo 'DMP_TOKEN="${instanceSystemToken}"' >> /etc/environment 
    grep -qxF 'PYTHONPATH="/root/dmpy:$PYTHONPATH"' /etc/environment || \
    echo 'PYTHONPATH="/root/dmpy:$PYTHONPATH"' >> /etc/environment 
    grep -qxF 'HTTP_PROXY=http://127.0.0.1:3128' /etc/environment || \
    echo 'HTTP_PROXY=http://127.0.0.1:3128' >> /etc/environment
    grep -qxF 'HTTPS_PROXY=http://127.0.0.1:3128' /etc/environment || \
    echo 'HTTPS_PROXY=http://127.0.0.1:3128' >> /etc/environment   
    grep -qxF 'NO_PROXY=127.0.0.1,localhost' /etc/environment || \
    echo 'NO_PROXY=127.0.0.1,localhost' >> /etc/environment    
  - |
    export HTTP_PROXY=http://127.0.0.1:3128
    export HTTPS_PROXY=http://127.0.0.1:3128
    export NO_PROXY=127.0.0.1,localhost
    apt-get update
    apt-get install -y nginx
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
        "PYTHONPATH": "/root/dmpy:$PYTHONPATH", 
        "HTTP_PROXY": "http://127.0.0.1:3128",
        "HTTPS_PROXY": "http://127.0.0.1:3128",
        "NO_PROXY": "127.0.0.1,localhost",
        "DMP_TOKEN": "${instanceSystemToken}"
      }
    }
    EOF
  - sleep 10
  - systemctl daemon-reload
  - systemctl restart systemd-journald
  - systemctl enable jupyter.service
  - systemctl start jupyter.service
`;

// MATLAB Container configuration with WebDAV removed
export const cloudInitUserDataMatlabContainer = (instanceSystemToken: string, username: string, instance_id: string) =>`
#cloud-config
users:
  - name: ubuntu
    groups: sudo,root
    sudo: "ALL=(ALL) NOPASSWD:ALL"
    shell: /bin/bash
write_files:
  - path: /etc/profile.d/instance_token.sh
    content: |
      #!/bin/bash
      export DMP_TOKEN="${instanceSystemToken}"
      export HTTP_PROXY=http://127.0.0.1:3128  
      export HTTPS_PROXY=http://127.0.0.1:3128  
      export NO_PROXY=127.0.0.1,localhost  
    permissions: '0755'
  - path: /etc/apt/apt.conf.d/95proxy
    content: |
      Acquire::http::Proxy "http://127.0.0.1:3128";
      Acquire::https::Proxy "http://127.0.0.1:3128";
      Acquire::http::Proxy "http://[::1]:3128";
      Acquire::https::Proxy "http://[::1]:3128";  
    permissions: '0644'
  - path: /etc/bash.bashrc
    append: true
    content: |
      export HTTP_PROXY=http://127.0.0.1:3128
      export HTTPS_PROXY=http://127.0.0.1:3128
      export NO_PROXY=127.0.0.1,localhost
      export http_proxy=$HTTP_PROXY
      export https_proxy=$HTTPS_PROXY
      export no_proxy=$NO_PROXY
    permissions: '0644'
  - path: /usr/local/MATLAB/R2023b/bin/matlab_env.sh  
    content: |  
      #!/bin/bash  
      export DMP_TOKEN="${instanceSystemToken}"  
      export HTTP_PROXY=http://127.0.0.1:3128  
      export HTTPS_PROXY=http://127.0.0.1:3128  
      export NO_PROXY=127.0.0.1,localhost  
    permissions: '0755'  
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
      os.environ['DMP_TOKEN'] = '${instanceSystemToken}'
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
  - path: /root/dummy-mac.sh
    content: |
      #!/bin/bash
      
      # Read the machine-id (persistent across reboots)
      MACHINE_ID=$(cat /etc/machine-id)
      
      # Generate a deterministic MAC address from the machine-id
      # - Use a hash to derive 6 bytes (SHA-256 truncated to 48 bits)
      # - Ensure it's a locally administered unicast MAC (second bit of first byte = 1)
      MAC_ADDR=$(echo "\${MACHINE_ID}" | sha256sum | awk '{print $1}' | head -c 12 | sed 's/\\(..\\)\\(..\\)\\(..\\)\\(..\\)\\(..\\)\\(..\\)/\\1:\\2:\\3:\\4:\\5:\\6/')
      
      # Force the first byte to be locally administered (e.g., 0x02, 0x06, etc.)
      FIRST_BYTE=$(echo "\${MAC_ADDR}" | cut -d':' -f1)
      FIRST_BYTE_HEX=$(( 0x\${FIRST_BYTE} | 0x02 ))  # Set the second bit
      FIRST_BYTE=$(printf "%02x" "\${FIRST_BYTE_HEX}")
      
      # Rebuild the MAC address
      MAC_ADDR="\${FIRST_BYTE}:$(echo "\${MAC_ADDR}" | cut -d':' -f2-6)"
      
      # Create the dummy interface and set the MAC
      ip link add eth0 type dummy
      ip link set eth0 address "\${MAC_ADDR}" 
      ip link set eth0 up
    permissions: '0755'
  - path: /etc/systemd/system/dummy-eth0.service
    content: |
      [Unit]
      Description=Create dummy eth0 with persistent MAC
      After=network.target
      
      [Service]
      Type=oneshot
      ExecStart=/root/dummy-mac.sh
      RemainAfterExit=yes
      
      [Install]
      WantedBy=multi-user.target
    permissions: '0644'
runcmd:
  - |  
    grep -qxF 'DMP_TOKEN="${instanceSystemToken}"' /etc/environment || \
    echo 'DMP_TOKEN="${instanceSystemToken}"' >> /etc/environment 
    grep -qxF 'PYTHONPATH="/root/dmpy:$PYTHONPATH"' /etc/environment || \
    echo 'PYTHONPATH="/root/dmpy:$PYTHONPATH"' >> /etc/environment 
    grep -qxF 'HTTP_PROXY=http://127.0.0.1:3128' /etc/environment || \
    echo 'HTTP_PROXY=http://127.0.0.1:3128' >> /etc/environment
    grep -qxF 'HTTPS_PROXY=http://127.0.0.1:3128' /etc/environment || \
    echo 'HTTPS_PROXY=http://127.0.0.1:3128' >> /etc/environment   
    grep -qxF 'NO_PROXY=127.0.0.1,localhost' /etc/environment || \
    echo 'NO_PROXY=127.0.0.1,localhost' >> /etc/environment  
  - |
    export HTTP_PROXY=http://127.0.0.1:3128
    export HTTPS_PROXY=http://127.0.0.1:3128
    export NO_PROXY=127.0.0.1,localhost
    apt-get update
    apt-get install -y nginx
  - systemctl enable vncserver.service
  - systemctl start vncserver.service
  - systemctl enable novnc.service
  - systemctl start novnc.service
  - ln -sf /etc/nginx/sites-available/vnc_proxy /etc/nginx/sites-enabled/
  - systemctl enable nginx
  - systemctl start nginx
  - systemctl restart nginx
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
  - netplan apply
  - systemctl enable dummy-eth0.service
  - systemctl start dummy-eth0.service
  - rm -rf /usr/local/MATLAB/R2022b/licenses/*
`;