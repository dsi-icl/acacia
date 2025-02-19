import { Logger } from '@itmat-broker/itmat-commons';
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

        const interval = setInterval(() => {
            tryCount++;
            if (tryCount > maxTry) {
                clearInterval(interval);
                reject(new Error(`Operation polling timed out: ${operationUrl} -> ${operationId}`));
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
                            reject(new CoreError(enumCoreErrors.POLLING_ERROR, `Operation failed for ${opData.metadata.err}`));
                        }
                    } else if (operationStatus === 'Running') {
                        return;
                    } else {
                        clearInterval(interval);
                        reject(new CoreError(enumCoreErrors.POLLING_ERROR, `Unknown operation status: ${operationStatus}`));
                    }
                } catch (error) {
                    Logger.error(`Error polling operation: ${error}`);
                    clearInterval(interval);
                    reject(new CoreError(enumCoreErrors.POLLING_ERROR, `Fatal error polling operation: ${error instanceof Error ? error.message : String(error)}`));
                }
            })();
        }, 4000);
    });
};