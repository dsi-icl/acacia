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
}