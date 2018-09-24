interface UploadJobEntry {
    id: string,
    status: string, //cancel, uploading to database, transferring file..etc, finished successfully, finished with error
    carrier: string, //endpoint to call for upload file
    filetype: string, //'UKB-CSV', 'CSV', 'Images'...etc
    error: null | object,
    filesReceived: object[],
    filesNeeded: string[]
}