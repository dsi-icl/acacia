import mongodb from 'mongodb';
import { db } from '../../database/database';
import { permissions } from 'itmat-utils';
import { ApolloError } from 'apollo-server-core';
import { IProject, IStudy, IRole } from 'itmat-utils/dist/models/study';
import { errorCodes } from '../errors';
import uuidv4 from 'uuid/v4';
import { IUser, userTypes } from 'itmat-utils/dist/models/user';
import { IFieldEntry } from 'itmat-utils/dist/models/field';

export class FieldCore {
    public async getFieldsOfStudy(studyId: string, detailed: boolean, getOnlyTheseFields?: string[]): Promise<IFieldEntry[]> {
        /* ASSUMING projectId and studyId match*/
        /* if detailed=false, only returns the fieldid in an array */ 
        /* constructing queryObj; if projectId is provided then only those in the approved fields are returned */
        let queryObj: any = { studyId };
        if (getOnlyTheseFields) {  // if both study id and project id are provided then just make sure they belong to each other
            queryObj = { studyId, fieldId: { $in: getOnlyTheseFields } };
        }

        const aggregatePipeline: any = [
            { $match: queryObj }
        ];
        /* if detailed=false, only returns the fieldid in an array */ 
        if (detailed === false ) {
            aggregatePipeline.concat( [ { $group: {  _id: null, array: { $addToSet: '$fieldId' } } } ]);
        }

        const cursor = db.collections!.field_dictionary_collection.aggregate(aggregatePipeline);
        return cursor.toArray();
    }

}

export const fieldCore = Object.freeze(new FieldCore());