import {
    IJob,
    IInstance,
    enumOpeType,
    enumInstanceStatus,
    LxdConfiguration,
    LXDInstanceState
} from '@itmat-broker/itmat-types';
import { APIHandler } from './apiJobHandler';
import { Logger } from '@itmat-broker/itmat-commons';
import {CoreError, enumCoreErrors } from '@itmat-broker/itmat-types';
import type * as mongodb from 'mongodb';
import { pollOperation } from './lxdPollOperation';
import { db } from '../database/database';

export class LXDJobHandler extends APIHandler {
    private static instance: LXDJobHandler;
    private readonly instanceCollection: mongodb.Collection<IInstance>;

    private constructor() {
        super();
        this.instanceCollection = db.collections.instance_collection;
    }

    public static override async getInstance(): Promise<LXDJobHandler> {
        if (!LXDJobHandler.instance) {
            LXDJobHandler.instance = new LXDJobHandler();
        }
        return LXDJobHandler.instance;
    }

    public override async execute(document: IJob) {
        const { operation, instanceId } = document.metadata as { operation: string; instanceId: string };

        if (!operation || !instanceId) {
            throw new Error('Missing required metadata: operation or instanceId.');
        }

        switch (operation) {
            case enumOpeType.CREATE:
                return this.create(document);
            case enumOpeType.UPDATE:
                return this.update(document);
            case enumOpeType.START:
                return this.startStopInstance(instanceId, operation);
            case enumOpeType.STOP:
                return this.startStopInstance(instanceId, operation);
            case enumOpeType.DELETE:
                return this.deleteInstance(instanceId);
            default:
                throw new Error('Unsupported operation.');
        }
    }

    private async create(document: IJob){
        const metadata = document.metadata as { payload: LxdConfiguration, instanceId: string };
        const payload = metadata.payload ?? {};
        const instanceId = metadata.instanceId ?? '';

        const instanceData = await this.instanceCollection.findOne({ id: instanceId });
        if (!instanceData) {
            throw new Error('Instance not found.');
        }
        // if instance's status is not pending, then do not create the instance
        if (instanceData.status !== enumInstanceStatus.PENDING) {
            throw new Error('Instance status is not PENDING.');
        }
        const project = instanceData.project || 'default';

        try {
            const data = await this.lxdManager.createInstance(payload, project);

            if (data?.operation) {

                try {
                    await pollOperation(this.lxdManager, data.operation, project);
                    // await this.updateInstanceMetadata(instanceId, data, enumInstanceStatus.STOPPED);

                    // Add wait and check loop
                    let attempts = 0;
                    const maxAttempts = 30; // 5 minutes total
                    while (attempts < maxAttempts) {
                        const instanceInfo= await this.lxdManager.getInstanceInfo(instanceData.name, project);
                        const stateResponse = await this.lxdManager.getInstanceState(instanceData.name, project);
                        const instanceState = stateResponse.data as LXDInstanceState;

                        // Check both operation status and instance state
                        if (!instanceInfo.data.metadata?.running_operation &&
                            instanceState.status === 'Stopped') {
                            await this.updateInstanceMetadata(instanceId, data, enumInstanceStatus.STOPPED);
                            return { successful: true, result: data };
                        }

                        await new Promise(resolve => setTimeout(resolve, 10000));
                        attempts++;
                    }

                    throw new Error('Instance creation timeout - still busy after 5 minutes');

                } catch (error) {
                    if (error instanceof CoreError && error.errorCode === enumCoreErrors.POLLING_ERROR) {
                        Logger.error(`LXD polling error for instance ${instanceId}: ${error.message}`);

                        // Handle the case where instance already exists
                        const errorMessage = error.message || '';
                        if (errorMessage.includes('Instance') && errorMessage.includes('already exists')) {
                            Logger.warn(`Instance ${instanceId} already exists, treating as successful creation`);
                            await this.updateInstanceMetadata(instanceId, {}, enumInstanceStatus.STOPPED);
                            return {
                                successful: true,
                                result: { message: 'Instance already exists' }
                            };
                        }

                        // Check for read-only filesystem error or other fatal storage errors
                        if (errorMessage.includes('read-only file system') ||
                            errorMessage.includes('Failed creating instance') ||
                            errorMessage.includes('Failed to create mount directory')) {
                            Logger.error(`Fatal storage error for instance ${instanceId}: ${errorMessage}`);
                            await this.updateInstanceMetadata(instanceId, { error: errorMessage }, enumInstanceStatus.FAILED);
                            return {
                                successful: false,
                                error: `Fatal storage error: ${errorMessage}`
                            };
                        }

                        // Don't update status, keep it as is for polling errors
                        return {
                            successful: false,
                            error: error.message
                        };
                    }
                    // For non-polling errors, rethrow to be caught by outer catch
                    Logger.error(`Error polling operation for instance ${instanceId}: ${error}`);

                    // if  the instance is failed out of space or other errors, set the instance status to failed

                    // Handle specific error cases for instance creation failures
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    Logger.error(`Instance creation failed for ${instanceId}: ${errorMessage}`);

                    // Check for specific error types
                    const errorDetails = {
                        message: errorMessage,
                        timestamp: new Date(),
                        type: 'creation_failure'
                    };

                    if (errorMessage.includes('out of space') || errorMessage.includes('no space left')) {
                        errorDetails.type = 'storage_space_error';
                    } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
                        errorDetails.type = 'network_error';
                    } else if (errorMessage.includes('timeout')) {
                        errorDetails.type = 'timeout_error';
                    }

                    // Update instance with error details and failed status
                    await this.updateInstanceMetadata(
                        instanceId,
                        { ...data, error: errorDetails },
                        enumInstanceStatus.FAILED
                    );
                    throw error;
                }
            }

            // await this.updateInstanceMetadata(instanceId, data, enumInstanceStatus.STOPPED);
            return { successful: true, result: data };
        } catch (error) {
            Logger.error(`Error creating instance: ${instanceId}, ${error}`);
            await this.updateInstanceMetadata(instanceId, {}, enumInstanceStatus.FAILED);
            return { successful: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    private async update(document: IJob) {
        // const { instanceId, updates } = document.metadata ?? {};
        const { instanceId, updates } = document.metadata as { instanceId: string; updates: LxdConfiguration };
        const instance = await this.instanceCollection.findOne({ id: instanceId });

        if (!instance) {
            Logger.error(`LXD update: Instance not found.: ${instanceId} ${JSON.stringify(updates)}`);
            return { successful: false, error: 'LXD update: Instance not found' };
        }
        const project = instance.project || 'default';
        try {
            const data = await this.lxdManager.updateInstance(instance.name, updates, project);
            return { successful: true, result: data };
        } catch (error) {
            Logger.error(`Error updating instance configuration: ${instanceId} - ${JSON.stringify(error)}`);
            return { successful: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    private async startStopInstance(instanceId: string, action: enumOpeType.START | enumOpeType.STOP) {
        const instanceData = await this.instanceCollection.findOne({ id: instanceId });
        if (!instanceData) {
            return { successful: false, error: 'Instance not found.' };
        }
        const project = instanceData.project || 'default';
        try {
            const data = await this.lxdManager.startStopInstance(instanceData.name, action, project);

            if (data?.operation) {
                try {
                    await pollOperation(this.lxdManager, data.operation, project);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);

                    // Handle "already running" case for START operation
                    if (action === enumOpeType.START && errorMessage.includes('already running')) {
                        Logger.warn(`Instance ${instanceData.name} is already running, treating as successful start`);
                        return {
                            successful: true,
                            result: { message: 'Instance already running' }
                        };
                    }

                    // Handle "already stopped" case for STOP operation
                    if (action === enumOpeType.STOP && errorMessage.includes('already stopped')) {
                        Logger.warn(`Instance ${instanceData.name} is already stopped, treating as successful stop`);
                        return {
                            successful: true,
                            result: { message: 'Instance already stopped' }
                        };
                    }

                    // Re-throw error for other cases
                    throw error;
                }
            }
            // update the status of the instance by the state monitor
            // const newStatus = action === enumOpeType.START ? enumInstanceStatus.RUNNING : enumInstanceStatus.STOPPED;
            // await this.updateInstanceMetadata(instanceId, null, newStatus);

            return { successful: true, result: data };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            // Handle "already running" error outside the poll operation
            if (action === enumOpeType.START && errorMessage.includes('already running')) {
                Logger.warn(`Instance ${instanceData.name} is already running, treating as successful start`);
                return {
                    successful: true,
                    result: { message: 'Instance already running' }
                };
            }

            // Handle "already stopped" error outside the poll operation
            if (action === enumOpeType.STOP && errorMessage.includes('already stopped')) {
                Logger.warn(`Instance ${instanceData.name} is already stopped, treating as successful stop`);
                return {
                    successful: true,
                    result: { message: 'Instance already stopped' }
                };
            }

            Logger.error(`Error in startStopInstance ${instanceData.name}: ${error}`);
            return { successful: false, error: errorMessage };
        }
    }

    private async deleteInstance(instanceId: string) {
        const instanceData = await this.instanceCollection.findOne({ id: instanceId });
        if (!instanceData) {
            return { successful: false, error: 'Instance not found.' };
        }
        // if instance's status is not deleted, then do not delete the instance
        if (instanceData.status !== enumInstanceStatus.DELETED) {
            return { successful: false, error: 'Instance status is not DELETED.' };
        }
        const project = instanceData.project || 'default';
        try {
            const data = await this.lxdManager.deleteInstance(instanceData.name, project);

            if (data?.operation) {
                await pollOperation(this.lxdManager, data.operation, project);
            }
            // once the instance is deleted, remove the instance from the database
            await this.instanceCollection.deleteOne({ id: instanceId });
            return { successful: true, result: data };
        } catch (error) {
            Logger.error(`[JOB] Failed to delete instance: ${error}`);
            return { successful: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    private async updateInstanceMetadata(
        instanceId: string,
        metadata: Record<string, unknown> | null,
        status: enumInstanceStatus
    ) {
        const updateObject: mongodb.UpdateFilter<IInstance>  = {
            $set: {
                status: status
            }
        };
        if (metadata !== null) {
            updateObject.$set = { ...updateObject.$set, metadata };
        }

        try {
            const updateResult = await this.instanceCollection.findOneAndUpdate({ id: instanceId }, updateObject);
            if (!updateResult) {
                Logger.error(`Failed to update instance ${instanceId}:`);
                throw new Error(`Failed to update instance metadata: ${instanceId}`);
            }
        } catch (error) {
            Logger.error(`Failed to update instance ${instanceId} error: ${error}`);
            throw new Error(`Failed to update instance metadata:  ${instanceId} ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}