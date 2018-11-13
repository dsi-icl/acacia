import { IFieldEntry } from '../models/UKBFields';
import mongodb from 'mongodb';

export class UKBFields {
    constructor(private readonly UKBFieldDictionaryCollection: mongodb.Collection) {}

    public async getFieldInfo(FieldID: number): Promise<IFieldEntry> {
        const result = await this.UKBFieldDictionaryCollection.findOne({ FieldID }, { projection: { _id: 0 } });
        return result;
    }
}