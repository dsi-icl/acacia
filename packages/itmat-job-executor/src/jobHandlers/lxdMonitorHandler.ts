import {
    IJob,
    IInstance,
    enumInstanceStatus,
    enumMonitorType,
    LXDInstanceState,
    IJobActionReturn
} from '@itmat-broker/itmat-types';
import { APIHandler } from './apiJobHandler';
import { LogThrottler } from '@itmat-broker/itmat-commons';
import type * as mongodb from 'mongodb';
import { db } from '../database/database';

export class LXDMonitorHandler extends APIHandler {
    private static instance: LXDMonitorHandler;
    private readonly instanceCollection: mongodb.Collection<IInstance>;
    private instanceErrors: Map<string, {count: number, lastLogged: number}> = new Map();

    constructor() {
        super();
        this.instanceCollection = db.collections.instance_collection;
    }

    public static override async getInstance(): Promise<APIHandler> {
        if (!LXDMonitorHandler.instance) {
            LXDMonitorHandler.instance = new LXDMonitorHandler();
        }
        return LXDMonitorHandler.instance;
    }

    public override async execute(document: IJob): Promise<IJobActionReturn>{
        const { operation, userId } = document.metadata as { operation: string; userId: string } ?? {};

        if (!operation || !userId) {
            return { successful: false, error: 'Missing required metadata: operation or userId.' };
        }

        try {
            switch (operation) {
                case enumMonitorType.STATE:
                    return await this.updateInstanceState(userId);
                case enumMonitorType.SYNC_DELETION:
                    return await this.synchronizeDeletedInstances(userId);
                default:
                    return { successful: false, error: 'Unsupported operation.' };
            }
        } catch (error) {
            return { successful: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    private async updateInstanceState(userId: string) {
        // Get all instances for this user, filter the status of DELETED instances
        const instances = await this.instanceCollection.find({
            userId: userId,
            status: { $ne: enumInstanceStatus.DELETED }
        }).toArray();

        for (const instance of instances) {
            try {
                const project = instance.project || 'default';
                const instanceLocation = await this.getInstanceLocationWithErrorHandling(instance);

                // If getInstanceLocation failed and returned null, skip this instance
                if (instanceLocation === null) {
                    continue;
                }

                const hostIp = await this.getInstanceHostIpWithErrorHandling(instanceLocation, instance);

                // If getInstanceHostIp failed, skip this instance
                if (hostIp === null) {
                    continue;
                }

                const response = await this.getInstanceStateWithErrorHandling(instance, project);

                // If getInstanceState failed, skip this instance
                if (response === null) {
                    continue;
                }

                if (response.data) {
                    const instanceState = response.data as LXDInstanceState;
                    instanceState.hostIp = hostIp;  // add the host ip to the instance state

                    await this.instanceCollection.updateOne(
                        { id: instance.id },
                        {
                            $set: {
                                lxdState: instanceState,
                                status: this.determineInstanceStatus(instanceState)
                            }
                        }
                    );

                    // Reset any error counts for this instance
                    this.resetErrorCounts(instance.name);
                } else {
                    // Use throttled logging for missing state data
                    LogThrottler.throttledLog(
                        `instance-state-null-${instance.name}`,
                        `Failed to retrieve state data for instance: ${instance.name}`,
                        'warn'
                    );
                }
            } catch (error) {
                // Use throttled logging for unexpected errors
                LogThrottler.throttledLog(
                    `unexpected-error-${instance.name}`,
                    `Unexpected error updating state for instance ${instance.name}: ${error}`,
                    'error'
                );
            }
        }

        // Add a default return statement
        return { successful: true};
    }


    private async getInstanceLocationWithErrorHandling(instance: IInstance): Promise<string | null> {
        try {
            return await this.lxdManager.getInstanceLocation(instance.name, instance.project || 'default');
        } catch (error) {
            // Determine if this is an AggregateError
            const isAggregateError = String(error).includes('AggregateError');
            const errorMsg = error instanceof Error ? error.message : String(error);

            // Define throttle options based on error type
            const throttleOptions = {
                initialLogInterval: isAggregateError ? 600000 : 300000,  // 10 min for AggregateError, 5 min for others
                subsequentLogInterval: isAggregateError ? 1800000 : 900000,  // 30 min for AggregateError, 15 min for others
                maxOccurrences: isAggregateError ? 3 : 5,
                summarizeInterval: isAggregateError ? 1800000 : 900000  // Provide summary less frequently for AggregateError
            };

            if (errorMsg.includes('404') || errorMsg.includes('Instance not found')) {
                // Use a throttled log for not found errors
                LogThrottler.throttledLog(
                    `instance-not-found-${instance.name}`,
                    `Instance not found while determining location: ${instance.name}`,
                    'warn',
                    throttleOptions
                );
            } else {
                // For other, more unusual errors, also use explicit throttling options
                LogThrottler.throttledLog(
                    `location-error-${instance.name}`,
                    `Error determining instance location for ${instance.name}: ${errorMsg}`,
                    'error',
                    throttleOptions
                );
            }
            return null;
        }
    }

    private async getInstanceHostIpWithErrorHandling(instanceLocation: string, instance: IInstance): Promise<string | null> {
        try {
            return await this.lxdManager.getInstanceHostIp(instanceLocation);
        } catch (error) {
            LogThrottler.throttledLog(
                `host-ip-error-${instance.name}`,
                `Error retrieving host IP for instance ${instance.name}: ${error}`,
                'error'
            );
            return null;
        }
    }

    private async getInstanceStateWithErrorHandling(instance: IInstance, project: string) {
        try {
            return await this.lxdManager.getInstanceState(instance.name, project);
        } catch (error) {
            // Handle 404 errors specially - these are common during instance lifecycle
            const errorMsg = error instanceof Error ? error.message : String(error);

            if (errorMsg.includes('404') || errorMsg.includes('Instance not found')) {
                // Use throttled logging
                LogThrottler.throttledLog(
                    `state-not-found-${instance.name}`,
                    `Instance ${instance.name} not found while checking state`,
                    'warn',
                    {
                        initialLogInterval: 300000,  // 5 minutes
                        subsequentLogInterval: 1800000 // 30 minutes
                    }
                );
            } else {
                // For other errors, log with normal throttling
                LogThrottler.throttledLog(
                    `state-error-${instance.name}`,
                    `Error updating state for instance ${instance.name}: ${errorMsg}`,
                    'error'
                );
            }
            return null;
        }
    }

    // TODO: define the function to delete the instance that synchronously the status with both in the database and the lxd server
    // call delete again from the lxd server if the instance is showed deleted in the database
    // set the status to DELETED in the database if the instance is deleted in the lxd server (not exist in the lxd server)


    // TODO: define the function to delete the instance that should be deleted after the lifespan + 10 day ( comapre the life.deletedTime)
    // check the expried instance and delete them, and recaulate the lifespan of them



    private determineInstanceStatus(state: LXDInstanceState): enumInstanceStatus {
        switch (state.status) {
            case 'Running':
                return enumInstanceStatus.RUNNING;
            case 'Stopped':
                return enumInstanceStatus.STOPPED;
            case 'Error':
                return enumInstanceStatus.FAILED;
            default:
                // Use throttled logging for unknown states
                LogThrottler.throttledLog(
                    `unknown-state-${state.status}`,
                    `Unknown instance state: ${state.status}`,
                    'error'
                );
                return enumInstanceStatus.FAILED;
        }
    }

    private resetErrorCounts(instanceName: string): void {
        // Reset error tracking for an instance that is now working correctly
        LogThrottler.resetTracking(`instance-not-found-${instanceName}`);
        LogThrottler.resetTracking(`location-error-${instanceName}`);
        LogThrottler.resetTracking(`host-ip-error-${instanceName}`);
        LogThrottler.resetTracking(`state-not-found-${instanceName}`);
        LogThrottler.resetTracking(`state-error-${instanceName}`);
        LogThrottler.resetTracking(`unexpected-error-${instanceName}`);
    }

    /**
     * Synchronizes instance deletion status between the database and LXD server
     * - Deletes instances from LXD server if they're marked as DELETED in the database but still exist on the server
     * - Updates database status to DELETED if instances don't exist on the LXD server
     * @param userId The user ID whose instances to synchronize
     * @returns Result of the synchronization operation
     */
    private async synchronizeDeletedInstances(userId: string): Promise<IJobActionReturn> {
        try {
            // Get all instances for this user, including ones marked as DELETED
            const instances = await this.instanceCollection.find({
                userId: userId
            }).toArray();

            let syncCount = 0;

            for (const instance of instances) {
                const project = instance.project || 'default';

                try {
                    // Check if the instance exists on the LXD server
                    let instanceExistsOnLXD = true;

                    try {
                        // Try to get instance state - will throw an error if instance doesn't exist
                        await this.lxdManager.getInstanceState(instance.name, project);
                    } catch (error) {
                        // If error contains 404 or "not found", the instance doesn't exist on LXD
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        if (errorMsg.includes('404') || errorMsg.includes('Instance not found')) {
                            instanceExistsOnLXD = false;
                        } else {
                            // For other errors, log and continue to next instance
                            LogThrottler.throttledLog(
                                `sync-deletion-error-${instance.name}`,
                                `Error checking instance existence for ${instance.name}: ${errorMsg}`,
                                'error'
                            );
                            continue;
                        }
                    }

                    // Case 1: Instance is marked as DELETED in DB but still exists on LXD server
                    if (instance.status === enumInstanceStatus.DELETED && instanceExistsOnLXD) {
                        try {
                            await this.lxdManager.deleteInstance(instance.name, project);
                            // Reduce verbosity for routine cleanup operations with longer throttling intervals
                            LogThrottler.throttledLog(
                                `sync-deletion-success-${instance.name}`,
                                `Successfully deleted instance ${instance.name} from LXD server that was already marked as deleted in DB`,
                                'info',
                                {
                                    initialLogInterval: 300000,     // 5 minutes
                                    subsequentLogInterval: 1800000, // 30 minutes
                                    maxOccurrences: 5,              // Reduce logging frequency after 5 occurrences
                                    summarizeInterval: 7200000      // Summarize every 2 hours
                                }
                            );
                            syncCount++;
                        } catch (deleteError) {
                            LogThrottler.throttledLog(
                                `sync-deletion-failed-${instance.name}`,
                                `Failed to delete instance ${instance.name} from LXD server: ${deleteError}`,
                                'error'
                            );
                        }
                    }
                    // Case 2: Instance exists in DB but not on LXD server (and not already marked as deleted)
                    else if (!instanceExistsOnLXD && instance.status !== enumInstanceStatus.DELETED) {
                        await this.instanceCollection.updateOne(
                            { id: instance.id },
                            {
                                $set: {
                                    status: enumInstanceStatus.DELETED
                                }
                            }
                        );
                        LogThrottler.throttledLog(
                            `sync-status-updated-${instance.name}`,
                            `Updated instance ${instance.name} status to DELETED in DB as it no longer exists on LXD server`,
                            'info',
                            {
                                initialLogInterval: 300000,     // 5 minutes
                                subsequentLogInterval: 1800000, // 30 minutes
                                maxOccurrences: 5,              // Reduce logging frequency after 5 occurrences
                                summarizeInterval: 7200000      // Summarize every 2 hours
                            }
                        );
                        syncCount++;
                    }

                } catch (instanceError) {
                    LogThrottler.throttledLog(
                        `sync-deletion-instance-error-${instance.name}`,
                        `Error synchronizing deletion for instance ${instance.name}: ${instanceError}`,
                        'error'
                    );
                }
            }

            return {
                successful: true,
                result: `Synchronized deletion status for ${syncCount} instances`
            };
        } catch (error) {
            return {
                successful: false,
                error: `Failed to synchronize deleted instances: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
}