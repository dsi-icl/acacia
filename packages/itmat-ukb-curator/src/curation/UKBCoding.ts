import { UKBCurationDatabase } from '../database/database';
import { CodingEntry, CodingMap } from '../models/UKBCoding';
import mongo from 'mongodb';

export class UKBCoding {

    public static async getCodeMeaning(Coding: number, Value: string): Promise<string|null> {
        const result: CodingEntry = await UKBCurationDatabase.UKB_coding_collection.findOne({ Coding, Value });
        if (result) {
            return result.Meaning;
        } else {
            return null;
        }
    }

    public static async getCodeDictionary(Coding: number): Promise<CodingMap> {
        const map: any = {};
        const results: mongo.Cursor = UKBCurationDatabase.UKB_coding_collection.find({ Coding });
        await results.forEach((doc: CodingEntry) => {
            map[doc.Value] = doc.Meaning;
        });
        return map;
    }

}