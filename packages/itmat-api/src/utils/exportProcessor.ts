import mongodb from 'mongodb';
import { db } from '../database/database';
import { IFieldEntry } from 'itmat-utils/dist/models/field';

class ExportProcessor {
    private fieldInfo?: IFieldEntry[];
    constructor(private readonly mongoCursor: mongodb.Cursor, private readonly studyId: string, private readonly wantedFields: string[], private readonly patientIdMap: { [originalId: string] : string}) {}

    async getWantedFieldsInfo() {
        const cursor = db.collections!.field_dictionary_collection.find({ studyId: this.studyId, fieldId: { $in: this.wantedFields } });
        this.fieldInfo = await cursor.toArray();
    }

    formatDataIntoJSON() {
        
    }

    replacePatientId() {

    }
    

}