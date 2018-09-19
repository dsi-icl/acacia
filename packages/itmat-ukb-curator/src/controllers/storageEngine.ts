/* storage engine for multer */
import express from 'express';
import Papa from 'papaparse';
import multer from 'multer';

const parseOptions: Papa.ParseConfig = {
    delimiter: ',',
    quoteChar: '"',
    header: false,
    trimHeaders: true,
    dynamicTyping: true,
    encoding: "utf-8",
};


class _CSVStorageEngine implements multer.StorageEngine {
    public _handleFile(req: express.Request, file: any, cb: (error?: any, info?: object) => void): void {
        const incomingStream = file.stream;
        let isHeader = true;
        let numOfSubj = 0;
        let startTime: number;
        let endTime: number;
        let header: string[];
        const parseStream: NodeJS.ReadableStream = incomingStream.pipe(Papa.parse(Papa.NODE_STREAM_INPUT, parseOptions));

        parseStream.on('data', line => {
            if (isHeader) {
                startTime = Date.now();
                isHeader = false;
                console.log('header', line[0], line.length);
                header = line;
            } else {
                numOfSubj++;
                console.log(numOfSubj, line[0], line.length);
            }
        });

        parseStream.on('end', () => { 
            endTime = Date.now();
            console.log(endTime-startTime);
            cb(null, { numOfSubj }); 
        } )
    }

    public _removeFile(req: express.Request, file: any, callback: (error: Error) => void): void {

    }
    
}

export const CSVStorageEngine = Object.freeze(new _CSVStorageEngine());