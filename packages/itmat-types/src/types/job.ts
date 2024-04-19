import type { ObjectId } from 'mongodb';

export interface IJobEntry<dataobj = unknown> {
    _id?: ObjectId;
    jobType: string;
    id: string;
    projectId?: string;
    studyId: string;
    requester: string;
    requestTime: number;
    receivedFiles: string[];
    status: 'QUEUED' | 'PROCESSING' | 'FINISHED' | 'ERROR';
    error: null | Error | Error[] | Record<string, unknown> | Record<string, unknown>[];
    cancelled: boolean;
    cancelledTime?: number;
    claimedBy?: string;
    lastClaimed?: number;
    data?: dataobj;
}

export type IJobEntryForDataCuration = IJobEntry<unknown>;
export type IJobEntryForFieldCuration = IJobEntry<{ tag: string }>;
export type IJobEntryForQueryCuration = IJobEntry<{ queryId: string[], projectId: string, studyId: string }>;
