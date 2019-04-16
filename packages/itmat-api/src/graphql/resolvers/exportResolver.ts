import { Models, permissions } from 'itmat-utils';
import { Database } from '../../database/database';
import { ForbiddenError, ApolloError, UserInputError, withFilter } from 'apollo-server-express';
import { IStudy } from 'itmat-utils/dist/models/study';
import { makeGenericReponse } from '../responses';
import { IQueryEntry } from 'itmat-utils/dist/models/query';
import uuid from 'uuid/v4';
import mongodb from 'mongodb';
import { pubsub, subscriptionEvents } from '../pubsub';
import { IUser } from 'itmat-utils/dist/models/user';
import { exportCore } from '../core/exportCore';
import { permissionCore } from '../core/permissionCore';
import { IJob, IJobEntry } from 'itmat-utils/dist/models/job';

export const queryResolvers = {
    Query: {
    },
    Mutation: {
        createExportJob: async(parent: object, args: { studyId: string, projectId?: string }, context: any, info: any): Promise<IJobEntry<undefined>> => {
            const requester: IUser = context.req.user;
            const { studyId, projectId } = args;

            /* check for permission first */
            await permissionCore.userHasTheNeccessaryPermission_throwErrorIfNot([
                permissions.all_study.all_projects_data_access,
                permissions.all_study.all_studies_data_access,
                permissions.specific_study.specific_study_data_access,
                permissions.specific_study.specific_study_data_access_to_all_projects,
                permissions.specific_project.specific_project_data_access
            ], requester, studyId, projectId);

            /* check whether project/study exists */
            
            /* create export job */
            const job = await exportCore.createExportJob(studyId, requester, projectId);
            return job;
        }
    },
    Subscription: {}
};
