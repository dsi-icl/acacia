import mongodb from 'mongodb'; 

    export interface IJobType {
        [typename: string]: {
            name: string,
            requiredFiles: string[],
            status: {
                [name: number]: string
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
        status: string, //cancel, uploading to database, transferring file..etc, finished successfully, finished with error
        carrier: string, //endpoint to call for upload file
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
        }
    }
};