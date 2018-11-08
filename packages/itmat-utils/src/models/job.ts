import mongodb from 'mongodb';

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

export interface IJobEntry extends IJob {
    _id?: mongodb.ObjectId,
    files: string[],
    type: string,
    id: string,
    requester: string,
    numberOfTransferredFiles: number,
    numberOfFilesToTransfer: number,
    created: number,
    status: string, // cancel, uploading to database, transferring file..etc, finished successfully, finished with error
    carrier: string, // endpoint to call for upload file
    error: null | object,
    filesReceived: string[],
    cancelled?: boolean,
    cancelledTime?: number
}

export const jobTypes: IJobType = {
    UKB_CSV_UPLOAD: {
        name: 'UKB_CSV_UPLOAD',
        requiredFiles: ['phenotype.csv'],
        status: {
            0: 'WAITING FOR FILE FROM CLIENT',
            1: 'TRANSFERRING FILE',
            2: 'UPLOADING TO DATABASE',
            3: 'FINISHED SUCCESSFULLY',
            4: 'TERMINATED WITH ERROR'
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
        requiredFiles: [],
        status: {
        },
        error: {
        }
    }
};