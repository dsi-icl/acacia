export interface ILogEntry {
    type: LOG_TYPE,
    user?: string,
    ref: string,
    content: string,
    request: string,
    outcome: string
}

enum LOG_TYPE {
    ERROR = 'ERROR',
    USER_ACTION = 'USER_ACTION',
    LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',
    SYSTEM_LOG = 'SYSTEM_LOG'
}