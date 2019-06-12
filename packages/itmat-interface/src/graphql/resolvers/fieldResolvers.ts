import { Models } from 'itmat-utils';
import { Database } from '../../database/database';
import { ForbiddenError, ApolloError, UserInputError, withFilter } from 'apollo-server-express';
import { IFieldEntry } from 'itmat-utils/dist/models/field';
import uuid from 'uuid/v4';
import mongodb from 'mongodb';
import { studyCore} from '../core/studyCore';
import { IProject, IStudy } from 'itmat-utils/dist/models/study';
import { errorCodes } from '../errors';
import { fieldCore } from '../core/fieldCore';


export const fieldResolvers = {
    Query: {
        getAvailableFields: async(parent: object, args: { projectId?: string, studyId: string}, context: any, info: any): Promise<IFieldEntry[]> => {
            const requester: Models.UserModels.IUser = context.req.user;

            const { studyId, projectId } = args;

            /* check whether user has at least provided one id */
            if (studyId === undefined && projectId === undefined) {
                throw new ApolloError('Please provide either study id or project id.', errorCodes.CLIENT_MALFORMED_INPUT);
            }

            /* constructing queryObj; if projectId is provided then only those in the approved fields are returned */
            let queryObj: any = { studyId };
            let approvedFields;
            if (studyId && projectId) {  // if both study id and project id are provided then just make sure they belong to each other
                const projectSearchResult = await studyCore.findOneProject_throwErrorIfNotExist(projectId);
                if (projectSearchResult.studyId !== studyId) {
                    throw new ApolloError('The project provided does not belong to the study provided', errorCodes.CLIENT_MALFORMED_INPUT);
                }
                approvedFields = projectSearchResult.approvedFields;
                queryObj = { studyId, fieldId: { $in: approvedFields } };
            }

            /* getting the fields */
            return fieldCore.getFieldsOfStudy(studyId, true, (projectId && approvedFields) as any);
        }
    },
    Mutation: {},
    Subscription: {}
};