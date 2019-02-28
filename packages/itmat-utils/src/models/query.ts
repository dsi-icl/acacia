import * as mongodb from 'mongodb';

export interface IQueryEntry {
    _id?: mongodb.ObjectId,
    id: string,
    queryString: string,
    study: string,
    application: string,
    requester: string,
    claimedBy?: string,
    lastClaimed?: number,
    status: string,
    error: null | object,
    cancelled: boolean,
    cancelledTime?: number,
    queryResult?: string
}