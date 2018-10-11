import { UKBCurationDatabase } from '../database/database';
import { FieldEntry } from '../models/UKBFields';

export class UKBFields {
    public static async getFieldInfo(FieldID: number): Promise<FieldEntry> {
        const result = await UKBCurationDatabase.UKB_field_dictionary_collection.findOne({ FieldID }, { projection: { _id: 0 } });
        return result;
    }

}