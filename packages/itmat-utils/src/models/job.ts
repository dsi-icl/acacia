import mongodb from 'mongodb';
import { UrlObjectCommon } from 'url';

export interface IJobType {
    [typename: string]: {
        name: string,
        requiredFiles: string[],
        status: {
            [name: number]: string
        },
        error: {
            [name: string]: any
        }
    }
}

export interface IJob {
    jobType: string,
}

export interface IJobEntry<dataobj> extends IJob {
    _id?: mongodb.ObjectId,
    id: string,
    study: string,
    requester: string,
    receivedFiles: string,
    status: string,
    error: null | object,
    cancelled: boolean,
    cancelledTime?: number,
    claimedBy?: string,
    lastClaimed?: number,
    data?: dataobj
}

export interface IDataobj_UKB_IMAGE_UPLOAD_job {  //tslint:disable-line
    patientId: string,
    objectUrl: string,
    field: string // xxxx-y.z
}

export const jobTypes: IJobType = {
    UKB_CSV_UPLOAD: {
        name: 'UKB_CSV_UPLOAD',
        requiredFiles: ['phenotype.csv'],
        status: {
            0: 'QUEUEING FOR UPLOAD',
            1: 'UPLOADING TO DATABASE',
            2: 'FINISHED SUCCESSFULLY',
            3: 'TERMINATED WITH ERROR'
        },
        error: {
            INVALID_FIELD: (fieldsWithError: string[]) => `The following fields do not exists on UK BIOBANK database therefore job is terminated: ${fieldsWithError.join(', ')}`,
            UNEVEN_FIELD_NUMBER: (linenumber: number) => `Your CSV file has uneven field numbers. First line of problem: ${linenumber}`,
            CANNOT_PARSE_NUMERIC_VALUE: (linenumber: number, fieldnumber: number) => `Cannot parse the supposedly numeric value on line ${linenumber}, ${fieldnumber}-th field.`,
            DUPLICATED_FIELD_VALUE: (fieldValue: string /* xx-yy-zz like in UKB CSV */) => `Duplicated Field: ${fieldValue}`
        }
    },
    UKB_IMAGE_UPLOAD: {
        name: 'UKB_IMAGE_UPLOAD',
        requiredFiles: ['imageFile'],
        status: {
            0: 'QUEUEING FOR UPLOAD',
            1: 'UPLOADING TO DATABASE',
            2: 'FINISHED SUCCESSFULLY',
            3: 'TERMINATED WITH ERROR'
        },
        error: {
        }
    }
};