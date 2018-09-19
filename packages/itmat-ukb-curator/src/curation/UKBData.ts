import { UKBCoding } from './UKBCoding';
import { UKBFields, FieldEntry } from './UKBFields';
import { Database } from 'itmat-utils';

export interface DataEntry {
    patientId: string,
    study: string,
    fieldId: number,
    instance: number,
    array: number,
    value: string | number
}


/* update should be audit trailed */ 

export class UKBData {

    public static async addOneDataEntry(entry: DataEntry, decode: boolean, strictlyAdd?: boolean): Promise<boolean> {
        const { fieldId, instance, array, value } = entry;
        const fieldInfo: FieldEntry = await UKBFields.getFieldInfo(fieldId);
        if (entry.instance > fieldInfo.Instances || entry.array > fieldInfo.Array ) {  //checking if the csv conforms with info from ukb
            return false;
        }

        if (decode && fieldInfo.Coding !== null) {  //if the user specifies for decoding and ukb info says it's coded
            entry = await UKBCoding.decodeEntry(entry);
        }

        if (strictlyAdd) {
            await Database.UKB_data_collection.insert(entry);
        } else {
            const criteria = { ...entry };
            delete criteria.value;
            await Database.UKB_data_collection.update(criteria, entry )
        }
        return true;
        
    }
}