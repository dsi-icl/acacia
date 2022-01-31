export const Secrets = {
    SRTWELCOME: 'Hey you! Welcome to WP5 Data Management Platform!',
    SRTTDOMAIN: 'https://data.idea-fast.eu'
};

export enum ErrorCodes {
    EKEYISENC,
    ESCPNOTRD,
    EINPASSWD,
    ETRANSFIL,
    ETIMOCHEL,
    ETIMOCPOW,
    ETINSRVID,
    ETINSRVIC,
    ETINUSRKY,
    ETIMOCPOI,
    ETINSRVPI,
    EUNABLCON,
    ENOTCONNT,
    EINVKFORM,
    EINVKNAME,
    EUNSPKMIS,
    EUNSPEXPS,
    EKEYLDFAI,
    EKEYNOTEC,
    EXORNOTSS,
    EKEYNOTSL
}

export const ErrorMessage: Record<ErrorCodes, string> = {
    [ErrorCodes.EKEYISENC]: 'Key is encrypted',
    [ErrorCodes.ESCPNOTRD]: 'Can\'t encrypt, SCP session is not ready',
    [ErrorCodes.EINPASSWD]: 'Can\'t decrypt, Invalid password',
    [ErrorCodes.ETRANSFIL]: 'Transaction failed',
    [ErrorCodes.ETIMOCHEL]: 'Timeout after client hello',
    [ErrorCodes.ETIMOCPOW]: 'Timeout after client proof-of-work',
    [ErrorCodes.ETINSRVID]: 'Invalid server identity',
    [ErrorCodes.ETINSRVIC]: 'Invalid server identity chain at #',
    [ErrorCodes.ETINUSRKY]: 'Invalid user key',
    [ErrorCodes.ETIMOCPOI]: 'Timeout after client proof-of-identity',
    [ErrorCodes.ETINSRVPI]: 'Invalid server proof-of-identity',
    [ErrorCodes.EUNABLCON]: 'Unable to create the secure connection: ',
    [ErrorCodes.ENOTCONNT]: 'Not connected',
    [ErrorCodes.EINVKFORM]: 'Key format is incorrect',
    [ErrorCodes.EINVKNAME]: 'Invalid key name',
    [ErrorCodes.EUNSPKMIS]: 'Unsupported, missing key file',
    [ErrorCodes.EUNSPEXPS]: 'Unsupported, expecting a single key file',
    [ErrorCodes.EKEYLDFAI]: 'Failed to load the key file',
    [ErrorCodes.EKEYNOTEC]: 'Can\'t save, key must be encrypted',
    [ErrorCodes.EXORNOTSS]: 'Array should have the same size',
    [ErrorCodes.EKEYNOTSL]: 'Key as not been sealed'
};

export enum ConnectionState {
    connecting,
    secure,
    closing,
    closed
}

export const ConnectionStateMessage: Record<ConnectionState, string> = {
    [ConnectionState.connecting]: 'Secure Connection in Progress',
    [ConnectionState.secure]: 'Secure Connection Established',
    [ConnectionState.closing]: 'Secure Connection Failed',
    [ConnectionState.closed]: 'Closed'
};
