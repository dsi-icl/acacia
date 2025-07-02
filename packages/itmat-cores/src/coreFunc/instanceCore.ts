import { IUserConfig, enumConfigType, CoreError, enumCoreErrors, IInstance, LXDInstanceTypeEnum, enumInstanceStatus, enumAppType, IUser, enumUserTypes, enumJobType, enumOpeType, enumMonitorType, enumJobStatus, ISystemConfig} from '@itmat-broker/itmat-types';
import { v4 as uuid } from 'uuid';
import { DBType } from '../database/database';
import { Logger, Mailer} from '@itmat-broker/itmat-commons';
import { IConfiguration} from '../utils';
import { ConfigCore } from './configCore';
import { JobCore} from './jobCore'; // Ensure you have the correct import path
import { UserCore } from './userCore';
import { cloudInitUserDataJupyterContainer, cloudInitUserDataMatlabContainer } from '../lxd/lxd.config';

export class InstanceCore {
    db: DBType;
    mailer: Mailer;
    config: IConfiguration;
    configCore: ConfigCore;
    JobCore: JobCore;
    UserCore: UserCore;
    lxdProject: string;
    private previousCpuUsage: Record<string, number> = {};
    private previousCpuTimestamp: Record<string, number> = {};

    constructor(db: DBType, mailer: Mailer, config: IConfiguration, jobCore: JobCore, userCore: UserCore) {
        this.db = db;
        this.mailer = mailer;
        this.config = config;
        this.configCore = new ConfigCore(db);
        this.JobCore = jobCore;
        this.UserCore = userCore;
        // set lxd project from config
        this.lxdProject = this.config.lxdProject || 'default';
    }
    /**
     * Convert memory size in bytes to a formatted string like '4GB'.
     * @param memory - The memory size in bytes.
     * @returns Formatted memory size string.
     */
    private formatMemory(memory: number): string {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let index = 0;
        let size = memory;

        while (size >= 1024 && index < units.length - 1) {
            size /= 1024;
            index++;
        }

        return `${Math.round(size)}${units[index]}`;
    }

    /**
     * Convert memory string like '4GB' to bytes.
     * @param memoryStr - The memory string to parse.
     * @returns Memory size in bytes.
     */
    private parseMemory(memoryStr: string): number {
        const units: Record<string, number> = {
            B: 1,
            KB: 1024,
            MB: 1024 * 1024,
            GB: 1024 * 1024 * 1024,
            TB: 1024 * 1024 * 1024 * 1024
        };
        // if memory string is undefined, return 0
        if (!memoryStr) {
            return 0;
        }
        const match = memoryStr.match(/^(\d+(?:\.\d+)?)([KMGT]?B)$/);
        if (!match) {
            throw new Error(`Invalid memory string: ${memoryStr}`);
        }

        const value = parseFloat(match[1]);
        const unit = match[2];

        return value * (units[unit] || 1);
    }
    /**
     * Get an instance by ID.
     *
     * @param instanceId - The ID of the instance to retrieve.
     * @return IInstance - The instance object.
     */
    public async getInstanceById(instanceId: string): Promise<IInstance> {
        const instance = await this.db.collections.instance_collection.findOne({ id: instanceId });
        if (!instance) {
            throw new CoreError(enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Instance not found.'
            );
        }
        return instance;
    }    /**
     * TODO: get the instance by name
     * create the host map port for the instance according to the latest valid port (port range: 30000 - 40000)
     * @returns the valid port number
     */
    private async getValidHostPort(): Promise<number> {
        const instances = await this.db.collections.instance_collection.find({}).toArray();
        // Filter out null/undefined values and then sort
        // get the base port range from config, default to [30000, 40000]
        const lxdPortRange: number[] = this.config.lxdPortRange || [30000, 40000];

        // Ensure we have a valid port range - if the minimum port is 0, use 30000 as minimum
        const minPort = lxdPortRange[0] === 0 ? 30000 : lxdPortRange[0];
        const maxPort = lxdPortRange[1] === 0 ? 40000 : lxdPortRange[1];

        const existingPorts = instances
            .map(instance => instance.hostMapPort)
            .filter(port => port !== undefined && port !== null);

        // If no valid ports are found, start from the base port
        if (existingPorts.length === 0) {
            return minPort; // Use the corrected minimum port
        }

        // Find the highest port and increment
        const latestPort = Math.max(...existingPorts);
        // Wrap around if we reach the maximum port
        const nextPort = latestPort < maxPort ? latestPort + 1 : minPort;
        return nextPort; // Return the next port, wrapping around if necessary;
    }

    private formatProxyAddress(address: string): string {
        // Remove any protocol prefixes if present
        if (address.includes('://')) {
            address = address.split('://')[1];
        }
        return address;
    }
    /**
     * Create an instance.
     *
     * @param userId - The id of the user creating the instance.
     * @param name - The name of the instance.
     * @param type - The type of the instance ('virtual-machine' or 'container').
     * @param appType - The application type of the instance (e.g., 'Jupyter', 'Matlab').
     * @param lifeSpan - The life span of the instance in seconds.
     * @param project - The LXD project of the instance (optional, defaults to 'default').
     *
     * @return IInstance
     */
    public async createInstance(userId: string, username: string, name: string, type: LXDInstanceTypeEnum,
        appType: enumAppType, lifeSpan: number, cpuLimit?: number, memoryLimit?: string, diskLimit?: string): Promise<IInstance> {

        const instance_id = uuid();  // Generate a unique ID for the instance

        // generate the token for instance
        let instanceSystemToken;
        try {
            // fake Id
            const data = await this.UserCore.issueSystemAccessToken(userId, null);  // null for unlimited token
            instanceSystemToken = data.accessToken;
        } catch (error) {
            Logger.error(`Error generating token: ${error}`);
            throw new Error('Error generating instance token.');
        }

        // const webdavServer = this.config.webdavServer;
        // const webdavMountPath = `/home/ubuntu/${username}_Drive`; // Ensure the correct path is used

        const instanceProfile = appType===enumAppType.MATLAB? 'matlab-profile' : 'jupyter-profile';

        const instanceMapPort = await this.getValidHostPort();

        // Prepare user-data for cloud-init to initialize the instance
        const cloudInitUserData = appType === enumAppType.MATLAB
            ? cloudInitUserDataMatlabContainer(instanceSystemToken, username, instance_id)
            : cloudInitUserDataJupyterContainer(instanceSystemToken, username, instance_id, this.config.jupyterPort);
        // add boot-time script, to be executed on first boot
        const instaceConfig = {
            'limits.cpu': cpuLimit ? cpuLimit.toString() : '4',
            'limits.memory': memoryLimit ? memoryLimit : '16GB',
            'user.disk': diskLimit ? diskLimit : '20GB',
            'user.username': username, // store username to instance config
            'user.user-data': cloudInitUserData // set the cloud-init user-data
        };

        const instanceEntry: IInstance = {
            id: instance_id,
            name,
            userId,
            username,
            status: enumInstanceStatus.PENDING,
            type,
            appType,
            createAt: Date.now(),
            lifeSpan,
            instanceToken: instanceSystemToken,
            project: this.lxdProject, // the  project name by config, idea-fast staging or production
            webDavToken: instanceSystemToken, // Assign or generate as needed, System token
            life: {
                createdTime: Date.now(),
                createdUser: userId,
                deletedTime: null,
                deletedUser: null
            },
            metadata: {},
            config: instaceConfig,
            // add the port mapping for the instance
            hostMapPort: instanceMapPort
        };

        await this.db.collections.instance_collection.insertOne(instanceEntry);

        // Create the job to create the LXD instance on LXD server
        const jobName = `Create ${appType} Instance: ${name}`;
        const jobType = enumJobType.LXD;
        const executorPath = '/lxd'; // The executor path for LXD jobs

        // Override defaults if cpuLimit and memoryLimit are provided
        if (cpuLimit) {
            instaceConfig['limits.cpu'] = cpuLimit.toString(); // Ensure it's a string
        }
        if (memoryLimit) {
            instaceConfig['limits.memory'] = memoryLimit;
        }

        // Construct the payload from the job document parameters
        // Prepare job data including the operation and instanceId
        const lxd_metadata = {
            operation: enumOpeType.CREATE,
            instanceId: instanceEntry.id,
            userId: userId,
            payload: {
                name: name,
                architecture: 'x86_64',
                config: instaceConfig,
                devices: {
                    root: {
                        path: '/',
                        pool: this.config.lxdStoragePool,
                        size: diskLimit ? diskLimit : '20GB',
                        type: 'disk'
                    },
                    // add a squid proxy device for the container, get the squid ip from config
                    squid0: {
                        bind: 'instance',
                        connect: `tcp:${this.formatProxyAddress(this.config.lxdSquidProxy)}`,
                        listen: 'tcp:0.0.0.0:3128',
                        type: 'proxy'
                    },
                    // Add proxy device for Jupyter
                    jupyter0: {
                        connect: `tcp:127.0.0.1:${this.config.jupyterPort || 8888}`,
                        listen: `tcp:0.0.0.0:${instanceMapPort}`,
                        type: 'proxy'
                    },
                    // Add proxy device for dmp server
                    dmp0: {
                        bind: 'instance',
                        listen: 'tcp:127.0.0.1:3080',
                        connect: `tcp:${this.config.dmp['host']}:${this.config.dmp['port']}`,
                        type: 'proxy'
                    }

                } as Record<string, unknown>,
                source: {
                    type: 'image',
                    alias: appType ===enumAppType.MATLAB? 'ubuntu-matlab-container-image' : 'ubuntu-jupyter-container-image'
                },
                profiles: [instanceProfile],
                type: type, // 'virtual-machine' or 'container'
                project: this.lxdProject // Ensure the correct project is used
            }
        };

        // Call the createJob method of JobCore to create a new job
        await this.JobCore.createJob(
            userId,
            jobName,
            jobType,
            undefined,
            undefined,
            { path: executorPath, type: 'lxd', id: instance_id },
            null,
            null,
            8, // High priority for create operations
            lxd_metadata);

        return instanceEntry;
    }

    /**
     * Start and Stop instance
     */
    public async startStopInstance(userId: string, instanceId: string, action: enumOpeType.START | enumOpeType.STOP): Promise<IInstance> {
        // Retrieve instance details from the database
        const instance = await this.db.collections.instance_collection.findOne({ id: instanceId });
        if (!instance) {
            throw new Error('Instance not found.');
        }
        // update the instance status
        // Optimistically update the instance status
        const newStatus = action === 'start' ? enumInstanceStatus.STARTING : enumInstanceStatus.STOPPING;
        await this.db.collections.instance_collection.updateOne({ id: instanceId }, {
            $set: { status: newStatus }
        });


        // Create the job to start/stop the LXD instance on the LXD server
        const jobName = `${action.toUpperCase()} ${instance.appType} Instance: ${instance.name}`;
        const jobType = enumJobType.LXD;
        const executorPath = `/lxd/${action}`;

        const lxd_metadata = {
            operation: action,
            instanceId: instance.id,
            userId: userId // Include userId in metadata
        };

        // Call the createJob method of JobCore to create a new job for starting/stopping the instance
        await this.JobCore.createJob(userId, jobName, jobType, undefined, undefined, { id: instanceId, type: 'lxd', path: executorPath }, null, null, 5, lxd_metadata);

        // Optionally, immediately return the instance object or wait for the job to complete based on your application's needs
        return instance;
    }

    /**
     * restartInstance with new lifespan, and update the instance's create time
     */
    public async restartInstance(userId: string, instanceId: string, lifeSpan: number): Promise<IInstance> {

        // Update the instance's create time and lifespan
        const result = await this.db.collections.instance_collection.findOneAndUpdate({ id: instanceId }, {
            $set: {
                createAt: Date.now(),
                lifeSpan: lifeSpan,
                status: enumInstanceStatus.STARTING

            }
        }, {
            returnDocument: 'after'
        });

        if (!result) { // Check if a document was found and updated
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Instance does not exist or update failed.');
        }
        const instance = result;

        // Create the job to update the LXD instance on the LXD server
        const jobName = `Restart ${instance.appType} Instance: ${instance.name} for user ${userId}`;
        const jobType = enumJobType.LXD;
        const executorPath = '/lxd/start';

        const lxd_metadata = {
            operation: enumOpeType.START,
            instanceId: instance.id,
            userId: userId // Include userId in metadata
        };

        // Call the createJob method of JobCore to create a new job for restarting the instance
        await this.JobCore.createJob(userId, jobName, jobType, undefined, undefined, { id: instanceId, type: 'lxd', path: executorPath }, null, null, 5, lxd_metadata);


        return instance;
    }

    /**
     * Delete an instance.
     */
    public async deleteInstance(UserId: string, instanceId: string): Promise<boolean> {
        const result = await this.db.collections.instance_collection.findOneAndUpdate({ id: instanceId }, {
            $set: {
                'life.deletedTime': Date.now(),
                'life.deletedUser': UserId,
                'status': enumInstanceStatus.DELETED
            }
        }, {
            returnDocument: 'after'
        });
        // log that set the instance status to deleted
        Logger.warn(`Instance ${instanceId} is deleted by user ${UserId}`);

        if (!result) { // Check if a document was found and updated
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Instance does not exist or delete failed.');
        }

        const instance = result; // Access the updated document
        const appType = instance.appType;

        // Create the job to delete the LXD instance on the LXD server
        const jobName = `DELETE ${appType} Instance: ${instance.name}`;
        const jobType = enumJobType.LXD;
        const executorPath = '/lxd/delete';

        const lxd_metadata = {
            operation: enumOpeType.DELETE,
            instanceId: instance.id,
            userId: UserId // Include userId in metadata
        };

        // Create the delete job and get its id
        const deleteJobResult = await this.JobCore.createJob(
            instance.userId,
            jobName,
            jobType,
            undefined,
            undefined,
            { id: instanceId, type: 'lxd', path: executorPath },
            null,
            null,
            10,
            lxd_metadata
        );

        // Get the ID of the newly created delete job
        const deleteJobId = deleteJobResult?.id;

        // Cancel all other pending jobs related to this instance, except the delete job
        await this.db.collections.jobs_collection.updateMany(
            {
                status: enumJobStatus.PENDING,
                id: { $ne: deleteJobId }, // Exclude the delete job we just created
                $or: [
                    { 'metadata.instanceId': instanceId },
                    { 'executor.id': instanceId }
                ]
            },
            {
                $set: {
                    'status': enumJobStatus.CANCELLED,
                    'life.deletedTime': Date.now(),
                    'life.deletedUser': UserId
                }
            }
        );

        return true;
    }

    /**
 * Get all instances and update their status based on lifespan.
 *
 * @param userId The ID of the user managing instances.
 * @return IInstance[] The list of instances.
 */
    public async getInstances(userId: string): Promise<IInstance[]> {
    // Retrieve all instances that haven't been deleted
        const instances = await this.db.collections.instance_collection.find({
            // status is not DELETED
            status: { $nin: [enumInstanceStatus.DELETED] },
            userId: userId  // Ensure to only fetch instances related to the userId if necessary
        }).toArray();

        //  create a LXD_MONITOR job to update the status of the instances
        const jobName = `Update Instance Status of User: ${userId}`;
        const jobType = enumJobType.LXD_MONITOR;
        const executorPath = '/lxd/monitor';
        const period =  1 * 60 * 1000; // set 5 minute future
        // Check if there is a pending job for the user instances update
        const existingJobs = await this.JobCore.getJob({ name: jobName, type: jobType, status: enumJobStatus.PENDING });

        if (existingJobs.length === 0) {
            const metadata = {
                operation: enumMonitorType.STATE,
                userId: userId
            };
            const instanceIds = instances.map(instance => instance.id).join('|');
            await this.JobCore.createJob(userId, jobName, jobType, undefined, period, { id: instanceIds, type: 'lxd', path: executorPath }, null, null, 1, metadata);
        }

        // Create a job for synchronizing instance deletion status between DB and LXD server
        const syncDeletionJobName = `Synchronize Deleted Instances for User: ${userId}`;
        const existingSyncDeletionJobs = await this.JobCore.getJob({
            name: syncDeletionJobName,
            type: jobType,
            status: enumJobStatus.PENDING
        });

        if (existingSyncDeletionJobs.length === 0) {
            const syncDeletionMetadata = {
                operation: enumMonitorType.SYNC_DELETION,
                userId: userId
            };
            // Create the sync deletion job with a slightly longer period to avoid resource contention
            const syncDeletionPeriod = 5 * 60 * 1000; // 5 minutes
            await this.JobCore.createJob(
                userId,
                syncDeletionJobName,
                jobType,
                undefined,
                syncDeletionPeriod,
                { id: 'sync-deletion', type: 'lxd', path: executorPath },
                null,
                null,
                1,
                syncDeletionMetadata
            );
        }

        const now = Date.now();

        // Create a series of promises to handle lifespan and status updates
        const updates = instances.map(async (instance) => {
            const lifeDuration = now - instance.createAt;
            const remainingLife = instance.lifeSpan - lifeDuration;

            // Check if the lifespan has been exceeded
            if (remainingLife <= 0) {
            // Check if the instance is not already stopped
                if (instance.status !== enumInstanceStatus.STOPPED && instance.status !== enumInstanceStatus.STOPPING
                    && instance.status !== enumInstanceStatus.FAILED
                ) {
                    // Stop the instance and update status in the database
                    await this.startStopInstance(userId, instance.id, enumOpeType.STOP);
                }

                await this.db.collections.instance_collection.updateOne(
                    { id: instance.id },
                    {
                        $set: {
                            lifeSpan: 0  // Reset lifespan to zero as it's now considered ended
                        }
                    }
                );

            }
            // Ensure instance config and limits exist
            const cpuLimit = 'limits.cpu' in instance.config ? parseInt(instance.config['limits.cpu'] as string) : 1;
            const memoryLimit = 'limits.memory' in instance.config ? this.parseMemory(instance.config['limits.memory'] as string) : 16 * 1024 * 1024 * 1024; // Default to 16GB

            let cpuUsage = 0;
            let memoryUsage = 0;

            if (instance.status === enumInstanceStatus.RUNNING && instance.lxdState) {
                const cpuUsageRaw = instance.lxdState.cpu.usage;
                const memoryUsageRaw = instance.lxdState.memory.usage;

                // Retrieve previous values from local storage (or instance metadata if necessary)
                const previousCpuUsageRaw = this.previousCpuUsage[instance.id] || 0;
                const previousTimestamp = this.previousCpuTimestamp[instance.id] || now;


                // Calculate the time interval in seconds
                const intervalSeconds = (now - previousTimestamp) / 1000;

                // Calculate the difference in CPU usage
                const cpuUsageDelta = cpuUsageRaw - previousCpuUsageRaw;

                // Convert CPU usage delta to seconds
                const cpuUsageDeltaSeconds = cpuUsageDelta / 1e9;

                // Calculate CPU usage percentage
                if (intervalSeconds > 0) {
                    cpuUsage = (cpuUsageDeltaSeconds / (cpuLimit * intervalSeconds)) * 100;
                }

                // Calculate memory usage percentage
                memoryUsage = (memoryUsageRaw / memoryLimit) * 100;

                // Store the current values for the next calculation
                this.previousCpuUsage[instance.id] = cpuUsageRaw;
                this.previousCpuTimestamp[instance.id] = now;

            }

            // Assign CPU and memory usage to instance metadata
            instance.metadata = {
                ...instance.metadata,
                cpuUsage: cpuUsage > 100 ? 100 : (cpuUsage < 0 ? 0 : Math.round(cpuUsage)), // Clamp values between 0 and 100
                memoryUsage: memoryUsage > 100 ? 100 : (memoryUsage < 0 ? 0 : Math.round(memoryUsage)) // Clamp values between 0 and 100
            };

            // resolve the promise with the instance object
            return instance;
        });

        // Wait for all updates to complete
        await Promise.all(updates);

        // Fetch and return the updated list of instances
        return instances.map(instance => {
            // calculate the cpu and memory usage percentage, only for running instances

            // This will provide the updated remaining life span without persisting it
            const lifeDuration = now - instance.createAt;
            const remainingLifeSpan = (instance.lifeSpan - lifeDuration);
            return {
                ...instance,
                lifeSpan: remainingLifeSpan > 0 ? remainingLifeSpan : 0
            };
        });
    }

    /**
     * Edit an instance.
     *
     * @param userId - The id of the user editing the instance.
     * @param instanceId - The id of the instance to edit.
     * @param updates - Object containing the fields to update.
     *
     * @return IInstance
     */
    public async editInstance(requester: IUser, instanceId: string | null | undefined, instanceName: string | null | undefined, updates: Record<string, unknown>): Promise<IInstance> {

        // Check that at least one of the identifier fields is provided
        if (!instanceId && !instanceName) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Instance ID or name must be provided.'
            );
        }

        // Find the instance by either ID or name
        const instanceQuery: Record<string, unknown> = {};
        if (instanceId) instanceQuery['id'] = instanceId;
        if (instanceName) instanceQuery['name'] = instanceName;

        const instance = await this.db.collections.instance_collection.findOne(instanceQuery);

        if (!instance) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Instance does not exist.'
            );
        }


        // Check if the requester has permission to edit the instance
        if (requester.username !== instance.username && requester.type !== enumUserTypes.ADMIN) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'User does not have permission to edit this instance.'
            );
        }

        // Update the config object directly if cpuLimit or memoryLimit are provided
        if (updates['cpuLimit'] || updates['memoryLimit']) {
            const currentConfig = instance.config ?? {};

            updates['config'] = {
                ...currentConfig, // Preserve existing config values
                'limits.cpu': updates['cpuLimit']?.toString() || currentConfig['limits.cpu'],
                'limits.memory': updates['memoryLimit'] || currentConfig['limits.memory']
            };

            // Remove top-level cpuLimit and memoryLimit after applying to config
            delete updates['cpuLimit'];
            delete updates['memoryLimit'];
        }
        // Update the instance in the database
        const result = await this.db.collections.instance_collection.findOneAndUpdate(
            { _id: instance._id }, // Use the unique `_id` from MongoDB
            { $set: updates },
            { returnDocument: 'after' }
        );

        if (!result) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Failed to update the instance.'
            );
        }

        // Create the job to update the LXD instance on the LXD server
        // Prepare job metadata for the LXD update operation
        const metadata = {
            operation: enumOpeType.UPDATE,
            instanceToken: instance.instanceToken ?? '',
            instanceId: result.id,
            updates: updates
        };
        const appType = result.appType;

        // Create the job for the LXD operation
        // TODO: better to package all of them to the jobCore as a attch function
        const jobName = `Update Config for ${appType} Instance: ${result.name}`;
        const executorPath = '/lxd/update';
        await this.JobCore.createJob(requester.id, jobName, enumJobType.LXD, undefined, undefined, { id: instanceId || instanceName || '', type: 'lxd', path: executorPath }, null, null, 2, metadata);


        return result;
    }

    // get the ip of the instance by instanceId or update the state of the instance

    /**
     * Get or update the container IP (state) from the database or trigger monitor if not available.
     *
     * @param instance_id - The ID of the instance.
     * @param user_id - The user ID (optional, for ownership validation).
     * @return string | null - The container IP, or null if not available.
     */
    public async getContainerIP(instance_id: string, user_id?: string) {
        // Retrieve the instance by the instance_id
        const instance: IInstance = await this.getInstanceById(instance_id);

        // Check instance ownership
        if (user_id && instance.userId !== user_id) {
            Logger.error('User not authorized to access the instance');
            throw new Error('User not authorized to access the instance');
        }

        // If instance is not running, return null (no IP available)
        if (instance.status !== 'RUNNING') {
            Logger.warn(`Instance ${instance_id} is not running, no IP available.`);
            return null;
        }

        // Check if the instance state is available in the database (via the monitor job)
        if (instance.lxdState && instance.lxdState.network && instance.lxdState.network['eth0']) {
            const ipv4Address = instance.lxdState.network['eth0'].addresses
                .filter((addr) => addr.family === 'inet')
                .map((addr) => addr.address)[0];

            if (ipv4Address) {
                return {ip: ipv4Address, port: this.config.jupyterPort};
            }
        }

        // If the state is not available, trigger the monitor job if it doesn't exist
        const existingMonitorJob = await this.JobCore.getJob({
            name: `Update Instance Status of User: ${instance.userId}`,
            type: enumJobType.LXD_MONITOR,
            status: enumJobStatus.PENDING
        });

        if (existingMonitorJob.length === 0) {
            // No pending monitor job, create one
            const jobName = `Update Instance Status of User: ${instance.userId}`;
            const jobType = enumJobType.LXD_MONITOR;
            const executorPath = '/lxd/monitor';
            const period = 5 * 60 * 1000; // 5 minute

            const metadata = {
                operation: enumMonitorType.STATE,
                userId: user_id
            };

            await this.JobCore.createJob(
                instance.userId,
                jobName,
                jobType,
                undefined,
                period,
                { id: instance.id, type: 'lxd', path: executorPath },
                null,
                null,
                1,
                metadata
            );

            Logger.warn(`Monitor job created for instance ${instance_id} to update state.`);
        }
        // Return null IP for now, as the monitor job will update the instance state
        return null;
    }

    public async checkQuotaBeforeCreation(userId: string, requestedCpu: number, requestedMemory: string, requestedDisk: string, requestedInstances: number): Promise<void> {

        const {properties: userQuota} = await this.configCore.getConfig(enumConfigType.USERCONFIG,  userId, true )as { properties: IUserConfig };
        const instances: IInstance[] = await this.getInstances(userId);

        let currentCpu = 0, currentMemory = 0, currentDisk = 0;
        instances.forEach(instance => {
            currentCpu += parseInt(instance.config['limits.cpu'] as string);

            currentMemory += this.parseMemory(instance.config['limits.memory'] as string);
            currentDisk += this.parseMemory(instance.config['user.disk'] as string);
        });

        if (currentCpu + requestedCpu > userQuota.defaultLXDMaximumInstanceCPUCores) {
            throw new CoreError(enumCoreErrors.NO_PERMISSION_ERROR, 'Requested CPU exceeds available quota. Please delete some instances or contact an administrator.');
        }
        if (this.parseMemory(requestedMemory) + currentMemory > userQuota.defaultLXDMaximumInstanceMemory) {
            throw new CoreError(enumCoreErrors.NO_PERMISSION_ERROR, 'Requested memory exceeds available quota. Please delete some instances or contact an administrator.');
        }
        if (this.parseMemory(requestedDisk) + currentDisk > userQuota.defaultLXDMaximumInstanceDiskSize) {
            throw new CoreError(enumCoreErrors.NO_PERMISSION_ERROR, 'Requested disk space exceeds available quota. Please delete some instances or contact an administrator.');
        }
        if (instances.length + requestedInstances > userQuota.defaultLXDMaximumInstances) {
            throw new CoreError(enumCoreErrors.NO_PERMISSION_ERROR, 'Requested instance count exceeds available quota. Please delete some instances or contact an administrator.');
        }
    }

    /**
     * Extend the lifespan of an instance
     *
     * @param userId - The ID of the user extending the instance
     * @param instanceId - The ID of the instance to extend
     * @param additionalTime - The additional time to add in milliseconds
     * @returns The updated instance
     */
    public async extendInstanceLifespan(userId: string, instanceId: string, additionalTime: number): Promise<IInstance> {
        // Retrieve instance details from the database
        const instance = await this.db.collections.instance_collection.findOne({ id: instanceId });
        if (!instance) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Instance not found.'
            );
        }

        // Get the current time to check for cooldown period
        const now = Date.now();

        // Check if user has permission to extend this instance
        if (instance.userId !== userId) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'User does not have permission to extend this instance.'
            );
        }

        // Calculate remaining lifespan
        const lifeDuration = now - instance.createAt;
        const remainingLifespan = instance.lifeSpan - lifeDuration;

        // Check if lifespan is already sufficiently long (more than 7 days)
        if (remainingLifespan > 7 * 24 * 60 * 60 * 1000) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                'Instance already has sufficient lifespan (more than 7 days). No need to extend now.'
            );
        }

        const newLifespan = instance.lifeSpan + additionalTime;

        // Update the instance's lifespan
        const result = await this.db.collections.instance_collection.findOneAndUpdate(
            { id: instanceId },
            { $set: { lifeSpan: newLifespan } },
            { returnDocument: 'after' }
        );

        if (!result) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Failed to update the instance lifespan.'
            );
        }

        Logger.log(`Extended lifespan of instance ${instanceId} by ${additionalTime / (3600 * 1000)} hours`);

        return result;
    }

    public async getQuotaAndFlavors(requester: IUser) {

        // key: userId,
        const {properties: userQuota} = await this.configCore.getConfig(enumConfigType.USERCONFIG,  requester.id, true );
        const { properties: systemConfig } = await this.configCore.getConfig(enumConfigType.SYSTEMCONFIG, null, true);

        const isAdmin = requester.type === enumUserTypes.ADMIN;
        // const userFlavors = isAdmin ? (systemConfig as ISystemConfig).defaultLXDFlavor.keys(): (userQuota as IUserConfig).defaultLXDflavor;
        const userFlavors = isAdmin
            ? Object.keys((systemConfig as ISystemConfig).defaultLXDFlavor)
            : (userQuota as IUserConfig).defaultLXDflavor;


        // Transform flavors into an object with flavor names as keys
        const transformedFlavors: Record<string, unknown> = {};
        userFlavors.forEach(flavor => {
            const flavorDetails = (systemConfig as ISystemConfig).defaultLXDFlavor[flavor];
            if (!flavorDetails) {
                Logger.warn(`Flavor ${flavor} is not defined in systemConfig.defaultLXDFlavor.`);
                return; // Skip this flavor if it's not defined
            }

            transformedFlavors[flavor] = {
                ...flavorDetails,
                memoryLimit: this.formatMemory(flavorDetails.memoryLimit),
                diskLimit: this.formatMemory(flavorDetails.diskLimit)
            };
        });

        return {
            userQuota: userQuota as IUserConfig,
            userFlavors: transformedFlavors
        };
    }



}