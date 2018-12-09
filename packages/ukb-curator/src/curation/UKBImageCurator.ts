import mongodb from 'mongodb';
import { IFieldMap } from '../models/UKBFields';
import { IFieldDescriptionObject } from '../models/curationUtils';
import { JobUtils } from '../utils/jobUtils';
import { Models, Logger } from 'itmat-utils';

export class UKBImageCurator {
    private jobUtils: JobUtils;

    constructor(private readonly UKBFieldDictionary: IFieldMap, private readonly dataCollection: mongodb.Collection, private readonly jobCollection: mongodb.Collection) {
        this.jobUtils = new JobUtils(this.jobCollection);
        this.updateData = this.updateData.bind(this);
    }

    public async updateData(document: Models.JobModels.IJobEntry<Models.JobModels.IDataobj_UKB_IMAGE_UPLOAD_job>): Promise<boolean> {
        if (document.data === undefined || document.data.patientId === undefined || !document.data.field || !document.receivedFiles) {
            Logger.error(`Job ${document.id} does not have patientId, field or receivedFiles`);
            await this.jobUtils.setJobError(document.id, 'Does not have patientId, field or receivedFiles');
            return false;
        }
        const { field: fieldId, patientId } = document.data;
        const objectUrl = `${document.id}|${document.receivedFiles}`;
        const field: IFieldDescriptionObject = this.parseFieldHeader(fieldId);
            // ==> update the data collection
            // check the fieldId is indeed an image
            // check the patientId exists and the study is right
            // update the objectUrl
        if (this.UKBFieldDictionary[field.fieldId] === undefined
            || this.UKBFieldDictionary[field.fieldId].ItemType !== 'Bulk'
            || this.UKBFieldDictionary[field.fieldId].Array < field.array ) {
            await this.jobUtils.setJobError(document.id, 'The provided field is malformed, or does not refer to images.');
            return false;
        }
        let updateResult: mongodb.UpdateWriteOpResult;
        try {
            updateResult = await this.dataCollection.updateOne(
                { m_eid: patientId, m_study: 'UKBIOBANK' },
                { $set: { [`${field.fieldId}.${field.instance}.${field.array}`]: objectUrl }});
        } catch (e) {
            Logger.error(`Job ${document.id} received file but cannot update data collection: MESSAGE: ${JSON.stringify(e)}`);
            await this.jobUtils.setJobError(document.id, 'Internal error. Do not reupload image. Please contact admin.');
            return false;
        }

        if (updateResult.modifiedCount !== 1) {
            Logger.error(`Job ${document.id} received file but cannot correctly update data collection. Modified count is ${updateResult.modifiedCount} instead.`);
            await this.jobUtils.setJobError(document.id, 'Internal error. Do not reupload image. Please contact admin.');
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