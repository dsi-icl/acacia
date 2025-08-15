import { CoreError, ILog, IUserWithoutToken, enumAPIResolver, enumCoreErrors, enumEventStatus, enumEventType, enumUserTypes } from '@itmat-broker/itmat-types';
import { DBType } from '../database/database';
import { Filter } from 'mongodb';

export class LogCore {
    db: DBType;
    constructor(db: DBType) {
        this.db = db;
    }

    /**
     * Get logs.
     *
     * @param requester - The requester.
     * @param caller - The caller of the event.
     * @param type - The type of the event.
     * @param apiResolver - The resolver of the event.
     * @param event - The event.
     * @param status - The status of the event.
     * @param indexRange - The range of the indexes.
     * @param timeRange - The range of the time.
     * Note that if parameters set to null, no restrictions will be applied.
     *
     * @return ILog[]
     */
    public async getLogs(requester: IUserWithoutToken | undefined, caller?: string, type?: enumEventType[], apiResolver?: enumAPIResolver[], event?: string[], status?: enumEventStatus[], indexRange?: number[], timeRange?: number[]) {
        if (!requester) {
            throw new CoreError(
                enumCoreErrors.NOT_LOGGED_IN,
                enumCoreErrors.NOT_LOGGED_IN
            );
        }

        if (requester.type !== enumUserTypes.ADMIN) {
            throw new CoreError(
                enumCoreErrors.NO_PERMISSION_ERROR,
                enumCoreErrors.NO_PERMISSION_ERROR
            );
        }

        const filters: Filter<ILog> = {};
        if (caller) {
            filters.requester = caller;
        }
        if (type) {
            filters.type = { $in: type };
        }
        if (apiResolver) {
            filters.apiResolver = { $in: apiResolver };
        }
        if (event) {
            filters.event = { $in: event };
        }
        if (status) {
            filters.status = { $in: status };
        }
        if (timeRange) {
            filters['life.createdTime'] = {
                $gte: timeRange[0],
                $lte: timeRange[1]
            };
        }
        let logs: ILog[];
        if (indexRange) {
            logs = await this.db.collections.log_collection.find(filters).sort({ 'life.createdTime': -1 }).skip(indexRange[0]).limit(indexRange[1] - indexRange[0]).toArray();
        } else {
            logs = await this.db.collections.log_collection.find(filters).toArray();
        }
        return logs;
    }

    /**
     * Provide several statistics of the logs.
     * This function provides several statistics of the logs, which is used by the frontend.
     * Modify it as needed.
     *
     */
    public async getLogsSummary() {
        const thirtyDaysInMilliseconds = 30 * 24 * 60 * 60 * 1000;
        const startTime = Date.now() - thirtyDaysInMilliseconds;

        const eventStatistics = await this.db.collections.log_collection.aggregate([
            {
                $match: {
                    'life.createdTime': { $gte: startTime },
                    'timeConsumed': { $ne: null } // Skip documents with null timeConsumed
                }
            },
            {
                $addFields: {
                    dayIndex: {
                        $trunc: {
                            $divide: [
                                { $subtract: ['$life.createdTime', startTime] },
                                86400000  // Milliseconds in a day
                            ]
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { event: '$event', dayIndex: '$dayIndex' },
                    countPerDay: { $sum: 1 },
                    avgTimeConsumed: { $avg: '$timeConsumed' },
                    stdDevTimeConsumed: { $stdDevSamp: '$timeConsumed' }
                }
            },
            {
                $group: {
                    _id: '$_id.event',
                    totalEventCount: { $sum: '$countPerDay' },
                    data: {
                        $push: {
                            dayIndex: '$_id.dayIndex',
                            count: '$countPerDay'
                        }
                    },
                    avgTimeConsumed: { $avg: '$avgTimeConsumed' },
                    stdDevTimeConsumed: { $avg: '$stdDevTimeConsumed' }
                }
            },
            {
                $project: {
                    _id: 0,
                    event: '$_id',
                    count: '$totalEventCount',
                    dailyCounts: {
                        $map: {
                            input: { $range: [0, 30] },  // From 0 to 29 (inclusive)
                            as: 'dayIndex',
                            in: {
                                $let: {
                                    vars: {
                                        matchingDayData: {
                                            $arrayElemAt: [
                                                {
                                                    $filter: {
                                                        input: '$data',
                                                        as: 'd',
                                                        cond: { $eq: ['$$d.dayIndex', '$$dayIndex'] }
                                                    }
                                                },
                                                0
                                            ]
                                        }
                                    },
                                    in: {
                                        dayIndex: { $subtract: ['$$dayIndex', 29] }, // Shift to correct day range
                                        count: { $ifNull: ['$$matchingDayData.count', 0] }
                                    }
                                }
                            }
                        }
                    },
                    avgTimeConsumed: 1,
                    stdDevTimeConsumed: 1
                }
            },
            {
                $sort: { count: -1 }
            }
        ]).toArray();

        const requesterStatistics = await this.db.collections.log_collection.aggregate([
            {
                $match: {
                    'life.createdTime': { $gte: startTime },
                    'timeConsumed': { $ne: null } // Skip documents with null timeConsumed
                }
            },
            {
                $addFields: {
                    dayIndex: {
                        $trunc: {
                            $divide: [
                                { $subtract: ['$life.createdTime', startTime] },
                                86400000  // Milliseconds in a day
                            ]
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { requester: '$requester', dayIndex: '$dayIndex' },
                    countPerDay: { $sum: 1 },
                    avgTimeConsumed: { $avg: '$timeConsumed' },
                    stdDevTimeConsumed: { $stdDevSamp: '$timeConsumed' }
                }
            },
            {
                $group: {
                    _id: '$_id.requester',
                    totalRequesterCount: { $sum: '$countPerDay' },
                    data: {
                        $push: {
                            dayIndex: '$_id.dayIndex',
                            count: '$countPerDay'
                        }
                    },
                    avgTimeConsumed: { $avg: '$avgTimeConsumed' },
                    stdDevTimeConsumed: { $avg: '$stdDevTimeConsumed' }
                }
            },
            {
                $project: {
                    _id: 0,
                    requester: '$_id',
                    count: '$totalRequesterCount',
                    dailyCounts: {
                        $map: {
                            input: { $range: [0, 30] },  // From 0 to 29 (inclusive)
                            as: 'dayIndex',
                            in: {
                                $let: {
                                    vars: {
                                        matchingDayData: {
                                            $arrayElemAt: [
                                                {
                                                    $filter: {
                                                        input: '$data',
                                                        as: 'd',
                                                        cond: { $eq: ['$$d.dayIndex', '$$dayIndex'] }
                                                    }
                                                },
                                                0
                                            ]
                                        }
                                    },
                                    in: {
                                        dayIndex: { $subtract: ['$$dayIndex', 29] }, // Shift to correct day range
                                        count: { $ifNull: ['$$matchingDayData.count', 0] }
                                    }
                                }
                            }
                        }
                    },
                    avgTimeConsumed: 1,
                    stdDevTimeConsumed: 1
                }
            },
            {
                $sort: { count: -1 }
            }
        ]).toArray();

        return { eventStatistics, requesterStatistics };
    }
}

