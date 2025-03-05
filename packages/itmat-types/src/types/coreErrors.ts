import { TRPCError } from '@trpc/server';

export enum enumCoreErrors {
    DATABASE_ERROR = 'DATABASE_ERROR',
    NOT_LOGGED_IN = 'NOT_LOGGED_IN',
    CLIENT_MALFORMED_INPUT = 'CLIENT_MALFORMED_INPUT',
    CLIENT_ACTION_ON_NON_EXISTENT_ENTRY = 'CLIENT_ACTION_ON_NON_EXISTENT_ENTRY',
    AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
    NO_PERMISSION_ERROR = 'NO_PERMISSION_ERROR',
    FILE_STREAM_ERROR = 'FILE_STREAM_ERROR',
    OBJ_STORE_ERROR = 'OBJ_STORE_ERROR',
    UNQUALIFIED_ERROR = 'UNQUALIFIED_ERROR',
    NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
    POLLING_ERROR = 'POLLING_ERROR' // error type for polling errors
}

export enum enumRequestErrorCodes {
    BAD_REQUEST = 'BAD_REQUEST',
    UNAUTHORIZED = 'UNAUTHORIZED',
    FORBIDDEN = 'FORBIDDEN',
    NOT_FOUND = 'NOT_FOUND',
    TIMEOUT = 'TIMEOUT',
    CONFLICT = 'CONFLICT',
    PRECONDITION_FAILED = 'PRECONDITION_FAILED',
    PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
    METHOD_NOT_SUPPORTED = 'METHOD_NOT_SUPPORTED',
    UNPROCESSABLE_CONTENT = 'UNPROCESSABLE_CONTENT',
    TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
    CLIENT_CLOSED_REQUEST = 'CLIENT_CLOSED_REQUEST',
    INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}

/**
 * This is to keep the consitency of the GraphQL error codes and tRPC error codes.
 * If possible, merge it in future.
 */
export class CoreError extends TRPCError {
    errorCode: enumCoreErrors;
    constructor(errorCode: enumCoreErrors, message: string, httpErrorCode: (typeof TRPCError.prototype)['code'] = 'BAD_REQUEST') {
        super({ message: message, code: httpErrorCode });
        this.errorCode = errorCode;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
