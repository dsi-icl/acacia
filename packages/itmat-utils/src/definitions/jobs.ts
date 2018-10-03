interface JobType {
    [typename: string]: {
        name: string,
        requiredFiles: string[],
        status: {
            [name: number]: string
        }
    }
}

export const jobTypes: JobType = {
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
}