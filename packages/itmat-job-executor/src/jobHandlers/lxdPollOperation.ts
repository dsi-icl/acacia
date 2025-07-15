import { Logger, LogThrottler } from '@itmat-broker/itmat-commons';
import { LxdManager } from '@itmat-broker/itmat-cores'; // Adjust the import path as necessary
import {CoreError, enumCoreErrors } from '@itmat-broker/itmat-types';

/**
 *  Polls an LXD operation until it is completed
 * @param lxdManager  The LxdManager instance
 * @param operationUrl  The URL of the operation to poll
 * @param maxTry    The maximum number of tries before giving up
 * @returns A promise that resolves when the operation is completed
 */
export const pollOperation = async (
    lxdManager: LxdManager,
    operationUrl: string,
    project: string,
    maxTry = 50
): Promise<void> => {
    let tryCount = 0;
    return new Promise<void>((resolve, reject) => {
        const operationIdMatch = operationUrl.match(/\/1\.0\/operations\/([^/]+)/);
        if (!operationIdMatch) {
            reject(new Error('Invalid operation URL'));
            return;
        }
        const operationId = operationIdMatch[1];
        const throttleKey = `lxd-poll-${operationId.substring(0, 8)}`;

        const interval = setInterval(() => {
            tryCount++;
            if (tryCount > maxTry) {
                clearInterval(interval);
                const errorMessage = `Operation polling timed out: ${operationUrl} -> ${operationId}`;
                LogThrottler.throttledLog(
                    `lxd-poll-timeout-${operationId.substring(0, 8)}`,
                    errorMessage,
                    'error',
                    { initialLogInterval: 60000, subsequentLogInterval: 300000 }
                );
                reject(new Error(errorMessage));
                return;
            }
            void (async () => {
                try {
                    const opData = await lxdManager.getOperationStatus(`/1.0/operations/${operationId}?project=${project}`);
                    const operationStatus = opData.metadata.status;

                    if (operationStatus === 'Success') {
                        clearInterval(interval);
                        resolve(); // Operation succeeded
                    } else if (operationStatus === 'Failure') {
                        if (opData.metadata.err.includes('Instance is busy running')) {
                            return;
                        } else {
                            clearInterval(interval);
                            const errorMessage = `Operation failed for ${opData.metadata.err}`;
                            // Don't throttle specific failure messages as they're important
                            Logger.error(errorMessage);
                            reject(new CoreError(enumCoreErrors.POLLING_ERROR, errorMessage));
                        }
                    } else if (operationStatus === 'Running') {
                        return;
                    } else {
                        clearInterval(interval);
                        const errorMessage = `Unknown operation status: ${operationStatus}`;
                        LogThrottler.throttledLog(
                            `lxd-unknown-status-${operationStatus}`,
                            errorMessage,
                            'error'
                        );
                        reject(new CoreError(enumCoreErrors.POLLING_ERROR, errorMessage));
                    }
                } catch (error) {
                    // Extract meaningful info from error
                    const errorMessage = LogThrottler.getErrorMessage(error);

                    // Categorize and throttle different types of errors
                    if (errorMessage.includes('timeout') || errorMessage.includes('ECONNABORTED')) {
                        // Timeout errors - these happen frequently in batches
                        LogThrottler.throttledLog(
                            `lxd-timeout-${operationId.substring(0, 8)}`,
                            `Error fetching operation status: ${errorMessage}`,
                            'error',
                            {
                                initialLogInterval: 30000,      // Only log every 30 seconds initially
                                subsequentLogInterval: 300000,  // Then only every 5 minutes
                                summarizeInterval: 900000       // Summary every 15 minutes
                            }
                        );
                    } else if (errorMessage.includes('Cannot read properties of null')) {
                        // Null reference errors - also frequent during certain operations
                        LogThrottler.throttledLog(
                            `lxd-null-ref-${operationId.substring(0, 8)}`,
                            `Error polling operation: ${errorMessage}`,
                            'error',
                            { initialLogInterval: 60000, subsequentLogInterval: 300000 }
                        );
                    } else {
                        // Other errors - log more frequently as they might be novel
                        LogThrottler.throttledLog(
                            `lxd-error-${throttleKey}`,
                            `Error polling operation: ${errorMessage}`,
                            'error',
                            { initialLogInterval: 10000, subsequentLogInterval: 60000 }
                        );
                    }

                    // Only reject and stop polling on sustained issues that persist for several attempts
                    if (tryCount % 10 === 0) { // Every 10th try (with 4s interval = ~40s)
                        clearInterval(interval);
                        reject(new CoreError(
                            enumCoreErrors.POLLING_ERROR,
                            `Fatal error polling operation: ${errorMessage}`
                        ));
                    }
                }
            })();
        }, 4000);
    });
};