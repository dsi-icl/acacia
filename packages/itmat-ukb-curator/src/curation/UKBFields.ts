import { UKBCurationDatabase } from '../database/database';

export interface FieldEntry {
    Path: string,
    Category: number,
    FieldID: number,
    Field: string,
    Participants?: number,
    Items?: number,
    Stability?: string,
    ValueType: string,
    Units?: string | null,
    ItemType?: string,
    Strata?: string
    Sexed?: string,
    Instances: number,
    Array: number,
    Coding?: number | null,
    Notes?: string | null,
    Link?: string
}

export interface FieldMap {
    [fieldID: number]: FieldEntry
}

export class UKBFields {
    public static async getFieldInfo(FieldID: number): Promise<FieldEntry> {
        const result = await UKBCurationDatabase.UKB_field_dictionary_collection.findOne({ FieldID }, { projection: { _id: 0 } });
        return result;
    }

}