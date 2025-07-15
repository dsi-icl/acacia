import { IBase } from './base';

export interface ILog extends IBase {
    requester: string;
    type: enumEventType;
    apiResolver: enumAPIResolver | null, // null for system logs
    event: string; // we do not use enum here to reduce conflicts of both API backends
    parameters?: Record<string, unknown>;
    status: enumEventStatus;
    errors?: string;
    timeConsumed: number | null;
}

export enum enumAPIResolver {
    'tRPC' = 'tRPC',
    'GraphQL' = 'GraphQL',
    'FILE' = 'FILE'
}

export enum enumUserAgent {
    MOZILLA = 'MOZILLA',
    OTHER = 'OTHER'
}

export enum enumEventType {
    SYSTEM_LOG = 'SYSTEMLOG',
    API_LOG = 'APILOG'
}

export enum enumEventStatus {
    SUCCESS = 'SUCCESS',
    FAIL = 'FAIL',
    UNKNOWN = 'UNKNOWN'
}
