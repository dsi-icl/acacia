import { Database } from 'itmat-utils';
import mongo from 'mongodb';
import { FieldEntry, UKBFields } from './UKBFields';
import { DataEntry } from './UKBData';
import { MongoCallback } from 'itmat-utils/node_modules/@types/mongodb';

export interface CodingEntry {
    Coding: number,
    Value: string,
    Meaning: string
}

export interface CodingMap {
    [property: number]: {
        [property: string]: string
    }
}

export class UKBCoding {

    public static async getCodeMeaning(Coding: number, Value: string): Promise<string|null> {
        const result: CodingEntry = await Database.UKB_coding_collection.findOne({ Coding, Value });
        if (result) {
            return result.Meaning;
        } else {
            return null;
        }
    }

    public static async getCodeDictionary(Coding: number): Promise<CodingMap> {
        const map: any = {};
        const results: mongo.Cursor = Database.UKB_coding_collection.find({ Coding });
        await results.forEach((doc: CodingEntry) => {
            map[doc.Value] = doc.Meaning;
        });
        return map;
    }

}