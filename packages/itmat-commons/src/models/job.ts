import { ObjectID } from 'mongodb';

export interface IJobEntry<dataobj> {
    _id?: ObjectID;
    jobType: string;
    id: string;
    projectId?: string;
    studyId: string;
    requester: string;
    requestTime: number;
    receivedFiles: string[];
    status: string;
    error: null | object;
    cancelled: boolean;
    cancelledTime?: number;
    claimedBy?: string;
    lastClaimed?: number;
    data?: dataobj;
}
