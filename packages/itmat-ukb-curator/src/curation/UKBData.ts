import csvparse from 'csv-parse';

export interface DataEntry {
    patientId: string,
    study: string,
    fieldId: number,
    instance: number,
    array: number,
    value: string | number
}

/* update should be audit trailed */ 

export class UKBDataCurator {
    private readonly jobId: string;
    private readonly fileName: string;
    private readonly incomingWebStream: NodeJS.ReadableStream;
    private readonly parseOptions: csvparse.Options = {
        delimiter: ',',
        quote: '"'
    };

    constructor(jobId: string, fileName: string, incomingWebStream: NodeJS.ReadableStream) {
        this.jobId = jobId;
        this.fileName = fileName;
        this.incomingWebStream = incomingWebStream;
    }

    public async processIncomingStreamAndUploadToMongo() {
        const parseStream: NodeJS.ReadableStream = this.incomingWebStream.pipe(csvparse(this.parseOptions)); //piping the incoming stream to a parser stream
        //check for intergrity
        parseStream.on('data', (data) => {
            console.log(data);
        });

        parseStream.on('end', () => {
            console.log('end');
        });
    }
}