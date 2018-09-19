import { Database } from 'itmat-utils';
import { FieldEntry, UKBFields } from './UKBFields';
import { DataEntry } from './UKBData';

interface CodingEntry {
    Coding: number,
    Value: string,
    Meaning: string
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

}