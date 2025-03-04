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
                        // Don't update status, keep it as is for polling errors
                        return {
                            successful: false,
                            error: error.message
                        };
                    }
                    // For non-polling errors, rethrow to be caught by outer catch
                    Logger.error(`Error polling operation for instance ${instanceId}: ${error}`);
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
                await pollOperation(this.lxdManager, data.operation, project);
            }
            // update the status of the instance by the state monitor
            // const newStatus = action === enumOpeType.START ? enumInstanceStatus.RUNNING : enumInstanceStatus.STOPPED;
            // await this.updateInstanceMetadata(instanceId, null, newStatus);

            return { successful: true, result: data };
        } catch (error) {
            Logger.error(`Error in startStopInstance ${instanceData.name}: ${error}`);
            return { successful: false, error: error instanceof Error ? error.message : String(error) };
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