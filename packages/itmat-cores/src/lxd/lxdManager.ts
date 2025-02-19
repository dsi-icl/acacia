import * as https from 'https';
import * as fs from 'fs';
import { WebSocket } from 'ws';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import { LXDInstanceState, LxdConfiguration, Cpu, Memory, Storage, Gpu , LxdOperation, LxdGetInstanceConsoleResponse} from '@itmat-broker/itmat-types';
import { Logger } from '@itmat-broker/itmat-commons';
import { sanitizeUpdatePayload } from './lxd.util';
import { IConfiguration } from '../utils/configManager';


export class LxdManager {
    private lxdInstance!: AxiosInstance;
    private lxdAgent!: https.Agent;
    config: IConfiguration;

    constructor(config: IConfiguration) {
        this.config = config;
        // Initialize synchronously to avoid async constructor
        void this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            await this.initializeLXDClient();
        } catch (error) {
            Logger.error('Failed to initialize LXD manager: ' + error);
            throw error;
        }
    }

    private async initializeLXDClient(): Promise<void> {
        try {
            let lxdSslCert: string;
            let lxdSslKey: string;

            // Load the SSL certificate and key
            if (this.config.lxdCertFile['cert'].includes('-----BEGIN')) {
                lxdSslCert = this.config.lxdCertFile['cert'];
            } else {
                lxdSslCert = fs.readFileSync(this.config.lxdCertFile['cert'], 'utf8');
            }

            if (this.config.lxdCertFile['key'].includes('-----BEGIN')) {
                lxdSslKey = this.config.lxdCertFile['key'];
            } else {
                lxdSslKey = fs.readFileSync(this.config.lxdCertFile['key'], 'utf8');
            }

            // Create HTTPS agent with proper error handling
            this.lxdAgent = new https.Agent({
                cert: lxdSslCert,
                key: lxdSslKey,
                rejectUnauthorized: this.config.lxdRejectUnauthorized,
                timeout: 60000, // Increased timeout for HTTPS agent
                keepAlive: true
            });

            // Initialize axios instance with retry logic
            this.lxdInstance = axios.create({
                baseURL: this.config.lxdEndpoint,
                httpsAgent: this.lxdAgent,
                timeout: 60000,
                validateStatus: (status) => status < 500,
                maxRedirects: 10
            });

            axiosRetry(this.lxdInstance, {
                retries: 3,
                retryDelay: (retryCount) => retryCount * 1000, // Exponential backoff
                retryCondition: (error) =>
                    error.code === 'ECONNABORTED' || (error.response?.status ?? 0) >= 500
            });


            // Test connection
            await this.lxdInstance.get('/1.0');
            Logger.log('LXD connection established successfully');

            // Add proper environment variable handling
            process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = this.config.lxdRejectUnauthorized ? '0' : '1';
        } catch (error) {
            Logger.error(`Failed to initialize LXD client: ${error}`);
            throw new Error('LXD initialization failed');
        }
    }

    // Add isInitialized check method
    private isInitialized(): boolean {
        return this.lxdInstance !== undefined && this.lxdAgent !== undefined;
    }

    // Add method to ensure initialization
    private async ensureInitialized(): Promise<void> {
        if (!this.isInitialized()) {
            await this.initialize();
        }
    }

    // get resources of lxd server.
    async getResources() {
        await this.ensureInitialized();
        try {
            const project = this.config.lxdProject || 'default';
            const response = await this.lxdInstance.get(`/1.0/resources?project=${project}`);
            const data = response.data.metadata;

            return {
                data: {
                    cpu: data.cpu as Cpu,
                    memory: data.memory as Memory,
                    storage: data.storage as Storage,
                    gpu: data.gpu as Gpu
                }
            };

        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                Logger.error('getResources axios error' + error.message);
                return {
                    error: true,
                    data: error.message
                };
            }
            Logger.error('getResources unknown error 1' + error);
            return {
                error: true,
                data: String(error)
            };
        }
    }

    // getProfile
    async getProfile(profileName: string, project: string) {
        try {
            const response = await this.lxdInstance.get(`/1.0/profiles/${encodeURIComponent(profileName)}?project=${project}`);
            if (response.status === 200) {
                return {
                    data: response.data.metadata // assuming this is the format in which LXD returns profile data
                };
            } else {
                Logger.error(`Failed to fetch profile data. ${response.data}`);
                return {
                    error: true,
                    data: `Failed to fetch profile data. ${response.data}`
                };
            }
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                Logger.error(`Failed to fetch profile data. ${error.response}`);
                return {
                    error: true,
                    data: `Failed to fetch profile data. ${error.response}`
                };
            } else {
                Logger.error('Error fetching profile data from LXD:' + error);
                return {
                    error: true,
                    data: String(error)
                };
            }
        }
    }

    // This should almost never be run, only for admin user
    async getInstances() {
        await this.ensureInitialized();
        try {
            const project = this.config.lxdProject || 'default';
            const instanceUrls = await this.lxdInstance.get(`/1.0/instances?project=${project}`);
            const instances = await Promise.allSettled(instanceUrls.data.metadata.map(async (instanceUrl: string) => await this.lxdInstance.get(instanceUrl)));

            const sanitizedInstances = instances.map((instance) => {
                if (instance.status === 'fulfilled') {
                    const { metadata } = instance.value.data;
                    return {
                        name: metadata.name,
                        description: metadata.description,
                        status: metadata.status,
                        statusCode: metadata.status_code,
                        profiles: metadata.profiles,
                        type: metadata.type,
                        architecture: metadata.architecture,
                        creationDate: metadata.created_at,
                        lastUsedDate: metadata.last_used_at,
                        username: metadata.config['user.username'] || 'N/A',
                        cpuLimit: metadata.config['limits.cpu'] || 'N/A',
                        memoryLimit: metadata.config['limits.memory'] || 'N/A'
                    };
                } else {
                    Logger.error('Error fetching instance data: ' + instance.reason);
                    return null;
                }
            }).filter(instance => instance !== null);

            return {
                data: sanitizedInstances
            };
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                Logger.error('getInstances axios error' + error.message);
                return {
                    error: true,
                    data: error.message
                };
            }
            Logger.error('getInstances unknown error 1' + error);
            return {
                error: true,
                data: String(error)
            };
        }
    }

    async getInstanceInfo(instanceName: string, project: string) {
        instanceName = encodeURIComponent(instanceName);
        return await this.lxdInstance.get(`/1.0/instances/${instanceName}?project=${project}`);
    }

    async getInstanceState(instanceName: string, project: string) {
        instanceName = encodeURIComponent(instanceName);
        try {
            const response = await this.lxdInstance.get(`/1.0/instances/${instanceName}/state?project=${project}`);
            const instanceState: LXDInstanceState = response.data.metadata;
            return {
                data: instanceState
            };
        } catch (error: unknown) {

            Logger.error(`Error fetching Instance ${instanceName} state from LXD:` + error);
            if (axios.isAxiosError(error)) {
                Logger.error(`Error fetching Instance state from LXD: ${error.message}`);
                if (error.response) {
                    Logger.error(`Status: ${error.response.status}`);
                    Logger.error(`Headers: ${JSON.stringify(error.response.headers)}`);
                    Logger.error(`Data: ${JSON.stringify(error.response.data)}`);
                }
            } else {
                Logger.error(`Error fetching Instance state from LXD: ${String(error)}`);
            }
            return {
                error: true,
                data: String(error)
            };
        }
    }

    async getInstanceConsole(instanceName: string, options: { height: number; width: number; type: string; }): Promise<LxdGetInstanceConsoleResponse>  {
        try {
            instanceName = encodeURIComponent(instanceName);
            const project = this.config.lxdProject || 'default';
            const consoleInfo = await this.lxdInstance.post<LxdOperation>(`/1.0/instances/${instanceName}/console?project=${project}&wait=10`, options);

            return {
                operationId: consoleInfo.data.metadata.id,
                operationSecrets: consoleInfo.data.metadata.metadata.fds
            };
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                Logger.error(`getInstanceConsole unknown error : ${error.message}`);
                return {
                    error: true,
                    data: error.message
                };
            }
            Logger.error(`getInstanceConsole unknown error : ${error}`);
            return {
                error: true,
                data: String(error)
            };
        }
    }

    async getInstanceConsoleLog(instanceName: string) {
        instanceName = encodeURIComponent(instanceName);
        const project = this.config.lxdProject || 'default';
        try {
            const response = await this.lxdInstance.get(`/1.0/instances/${instanceName}/console?project=${project}`);
            if (response.status === 200) {
                return response.data;
            } else {
                const errorMessage = `Failed to fetch Logger log data. Status: ${response.status}, Data: ${JSON.stringify(response.data)}`;
                Logger.error(errorMessage);
                return {
                    error: true,
                    data: errorMessage
                };
            }
        } catch (error: unknown) {
            let errorMessage = 'Error fetching instance Logger log from LXD:';
            if (axios.isAxiosError(error)) {
                if (error.response) {
                    if (error.response.status === 404) {
                        errorMessage = `Logger log file not found. Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`;
                        Logger.error(errorMessage);
                        // Return an empty string to the frontend
                        return {
                            error: false,
                            data: ''
                        };
                    } else {
                        errorMessage = `Failed to fetch Logger log data. Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`;
                    }
                } else {
                    errorMessage = `Axios error without response: ${error.message}`;
                }
            } else {
                errorMessage = `Unknown error: ${String(error)}`;
            }
            Logger.error(errorMessage);
            return {
                error: true,
                data: errorMessage
            };
        }
    }

    async getOperations() {
        try {
            const project = this.config.lxdProject || 'default';
            // add project to the url
            const operationUrls = await this.lxdInstance.get(`/1.0/operations?project=${project}`);
            return {
                data: operationUrls.data.metadata
            };
        } catch (e) {
            if (isAxiosError(e)) {
                Logger.error('getOperations axios error' + e.message);
                return {
                    error: true,
                    data: e.message
                };
            }
            Logger.error('getOperations unknown error' + e);
            return {
                error: true,
                data: e
            };
        }
    }

    async getOperationStatus(operationUrl: string) {
        try {
            const opResponse = await this.lxdInstance.get(operationUrl);
            return opResponse.data;
        } catch (error) {
            Logger.error('Error fetching operation status from LXD:' + error);
            throw error;
        }
    }

    getOperationSocket(operationId: string, operationSecret: string) {
        operationId = encodeURIComponent(operationId);
        operationSecret = encodeURIComponent(operationSecret);
        const containerConsoleSocket = new WebSocket(`wss://${this.config.lxdEndpoint.replace('https://', '')}/1.0/operations/${operationId}/websocket?secret=${operationSecret}`, {
            agent: this.lxdAgent
        });
        containerConsoleSocket.binaryType = 'arraybuffer';
        return containerConsoleSocket;
    }

    async createInstance(payload: LxdConfiguration, project: string) {
        await this.ensureInitialized();
        try {
            const lxdResponse = await this.lxdInstance.post(`/1.0/instances?project=${encodeURIComponent(project)}`, payload, {
                headers: { 'Content-Type': 'application/json' },
                httpsAgent: this.lxdAgent,
                timeout: 30000 // adjust as needed
            });
            return lxdResponse.data;
        } catch (error) {
            if (isAxiosError(error)) {
                console.error('Error response:', error.response?.data);
            }
            Logger.error(`Error creating instance  ${payload.name} on LXD: ${JSON.stringify(error)}`);
            throw new Error(`Error creating instance  ${payload.name}  on LXD`);
        }
    }

    async updateInstance(instanceName: string, payload: LxdConfiguration, project: string) {
        try {
            const sanitizedPayload = sanitizeUpdatePayload(payload);
            // Perform the PATCH request to LXD to update the instance configuration
            const response = await this.lxdInstance.patch(`/1.0/instances/${encodeURIComponent(instanceName)}?project=${project}`, sanitizedPayload, {
                headers: { 'Content-Type': 'application/json' }
            });
            return response.data; // Return the response or format as needed
        } catch (error) {
            Logger.error(`Error updating instance ${instanceName} on LXD:` + error);
            throw error;
        }
    }

    async startStopInstance(instanceName: string, action: string, project: string) {
        try {
            const response = await this.lxdInstance.put(`/1.0/instances/${instanceName}/state?project=${project}`, {
                action: action,
                timeout: 300, // adjust as needed
                force: false,
                stateful: false
            });
            return response.data;
        } catch (error) {
            Logger.error(`Error ${action} instance ${instanceName} on LXD: ${error}`);
            throw error; // Propagate the error
        }
    }

    // restart , set the stateful to true

    async deleteInstance(instanceName: string, project: string) {
        try {
            const response = await this.lxdInstance.delete(`/1.0/instances/${instanceName}?project=${project}`);
            return response.data;
        } catch (error) {
            Logger.error(`Error deleting instance ${instanceName} on LXD: ${error}`);
            throw error; // Propagate the error
        }
    }
}