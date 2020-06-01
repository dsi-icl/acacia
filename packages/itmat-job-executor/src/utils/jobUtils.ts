import { Logger } from 'itmat-utils';
import mongodb from 'mongodb';

export class JobUtils {
    constructor(private readonly jobCollection: mongodb.Collection) {}

    public async setJobError(jobId: string, msg: string) {
        try {
            await this.jobCollection.updateOne({ id: jobId }, { $set: {
                error: msg,
                status: 'TERMINATED WITH ERROR'
            }});
        } catch (e) {
            Logger.error(`Cannot set job ${jobId} with error "${msg}"`);
        }
    }
}

/* validate a field string */
export function fieldValidator(field: string) {
    if (/^\d+@\d+.\d+(:[c|i|d|b|t])?$/.test(field)) {
        return true;
    } else {
        return false;
    }
}

/* decompose a field string */
export function fieldParser(field: string) {
    const fieldId = parseInt(field.substring(0, field.indexOf('@')), 10);
    const timepoint = parseInt(field.substring(field.indexOf('@') + 1, field.indexOf('.')), 10);
    const measurement = parseInt(field.substring(field.indexOf('.') + 1, field.indexOf(':') === -1 ? field.length : field.indexOf(':')), 10);
    const datatype: 'c' | 'i' | 'd' | 'b' | 't' = field.indexOf(':') === -1 ? 'c' : field.substring(field.indexOf(':') + 1, field.length) as ('c' | 'i' | 'd' | 'b');
    return {
        fieldId,
        timepoint,
        measurement,
        datatype
    }
}