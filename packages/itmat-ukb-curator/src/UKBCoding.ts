import { Collection } from 'mongodb'; 

interface CodingEntry {
    Coding: number,
    Value: number,
    Meaning: string
}

interface dataEntry {
    eid: string,
    [propName: string]: string | number;
}

export class UKBCoding {
    private dbcollection: Collection;

    constructor(codingCollection: Collection) {
        this.dbcollection = codingCollection;
    }

    static decodeEntry(dataEntry: dataEntry) {
        
    }

    async insertFieldEntry(fieldEntry: CodingEntry) {
        const result = await this.dbcollection.insert(fieldEntry);
    }
}