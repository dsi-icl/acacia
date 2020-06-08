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
    error: null | Record<string, unknown>;
    cancelled: boolean;
    cancelledTime?: number;
    claimedBy?: string;
    lastClaimed?: number;
    data?: dataobj;
}

export type IJobEntryForDataCuration = IJobEntry<{ dataVersion: string, versionTag?: string }>;
export type IJobEntryForFieldCuration = IJobEntry<{ dataVersionId: string, tag: string }>;
