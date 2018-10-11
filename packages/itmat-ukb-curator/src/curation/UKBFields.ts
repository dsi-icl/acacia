import { UKBCurationDatabase } from '../database/database';
import { IFieldEntry } from '../models/UKBFields';

export class UKBFields {
    public static async getFieldInfo(FieldID: number): Promise<IFieldEntry> {
        const result = await UKBCurationDatabase.UKB_field_dictionary_collection.findOne({ FieldID }, { projection: { _id: 0 } });
        return result;
    }

}