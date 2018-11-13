import { ICodingEntry, ICodingMap } from '../models/UKBCoding';
import mongodb from 'mongodb';

export class UKBCoding {
    constructor(private readonly UKBCodingCollection: mongodb.Collection) {}

    public async getCodeMeaning(Coding: number, Value: string): Promise<string|null> {
        const result: ICodingEntry = await this.UKBCodingCollection.findOne({ Coding, Value });
        if (result) {
            return result.Meaning;
        } else {
            return null;
        }
    }

    public async getCodeDictionary(Coding: number): Promise<ICodingMap> {
        const map: any = {};
        const results: mongodb.Cursor = this.UKBCodingCollection.find({ Coding });
        await results.forEach((doc: ICodingEntry) => {
            map[doc.Value] = doc.Meaning;
        });
        return map;
    }

}