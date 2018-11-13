import mongodb from 'mongodb';
import { IFieldMap } from '../models/UKBFields';
import { IFieldDescriptionObject } from '../models/curationUtils';
import { Models } from 'itmat-utils';

export class UKBImageCurator {
    constructor(private readonly UKBFieldDictionary: IFieldMap, private readonly dataCollection: mongodb.Collection) {}

    public async updateData(document: Models.JobModels.IJobEntry<Models.JobModels.IDataobj_UKB_IMAGE_UPLOAD_job>): Promise<boolean> {
        if (document.data === undefined || document.data.patientId === undefined || !document.data.fieldId || !document.data.objectUrl) {
            // set job error!
            return false;
        }
        const { fieldId, patientId, objectUrl } = document.data;
        const field: IFieldDescriptionObject = this.parseFieldHeader(fieldId);
            // ==> update the data collection
            // check the fieldId is indeed an image
            // check the patientId exists and the study is right
            // update the objectUrl
        if (this.UKBFieldDictionary[field.fieldId] === undefined
            || this.UKBFieldDictionary[field.fieldId].ItemType !== 'Bulk'
            || this.UKBFieldDictionary[field.fieldId].Array < field.array ) {
            // set job error!
            return false;
        }
        let updateResult: mongodb.UpdateWriteOpResult;
        try {
            updateResult = await this.dataCollection.updateOne(
                { m_eid: patientId, m_study: 'UKBIOBANK' },
                { $set: { [`${field.fieldId}.${field.instance}.${field.array}`]: objectUrl }});
        } catch (e) {
            // set job error
            return false;
        }

        if (updateResult.modifiedCount !== 1) {
            // set job error
            return false;
        }

        return true;
    }

    private parseFieldHeader(fieldHeader: string): IFieldDescriptionObject {
        return ({
                fieldId: parseInt(fieldHeader.slice(0, fieldHeader.indexOf('-'))),
                instance: parseInt(fieldHeader.slice(fieldHeader.indexOf('-') + 1, fieldHeader.indexOf('.'))),
                array: parseInt(fieldHeader.slice(fieldHeader.indexOf('.') + 1))
        });
    }
}