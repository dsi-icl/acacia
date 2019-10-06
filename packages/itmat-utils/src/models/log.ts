export interface ILogEntry {
    type: LOG_TYPE;
    subtype?: LOG_SUBTYPE;
    user?: string;
    ref: string;
    content: string;
    request: string;
    outcome: string;
}

enum LOG_TYPE {
    ERROR = 'ERROR',
    USER_ACTION = 'USER_ACTION',
    LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',
    SYSTEM_LOG = 'SYSTEM_LOG'
}

enum LOG_SUBTYPE {
    DATADASE_WRITE = 'DATABASE_WRITE',
    DATADASE_READ = 'DATABASE_READ'
}
