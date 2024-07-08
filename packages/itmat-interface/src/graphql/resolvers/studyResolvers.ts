import {
    IStudy,
    studyType,
    IDataClip,
    IQueryString,
    IGenericResponse,
    CoreError,
    IGroupedData
} from '@itmat-broker/itmat-types';
import { GraphQLErrorDecroator, TRPCDataCore, TRPCDataTransformationCore, TRPCFileCore, TRPCPermissionCore, TRPCStudyCore, V2CreateFieldInput, V2EditFieldInput, convertV2CreateFieldInputToV3, convertV2DataClipInputToV3, convertV2EditFieldInputToV3, convertV3FieldToV2Field } from '@itmat-broker/itmat-cores';
import { DMPResolversMap } from './context';
import { db } from '../../database/database';
import { objStore } from '../../objStore/objStore';
import { TRPCUtilsCore } from 'packages/itmat-cores/src/trpcCore/utilsCore';

const fileCore = new TRPCFileCore(db, objStore);
const permissionCore = new TRPCPermissionCore(db);
const utilsCore = new TRPCUtilsCore();
const studyCore = new TRPCStudyCore(db, objStore, permissionCore, fileCore);
const dataCore = new TRPCDataCore(db, fileCore, permissionCore, utilsCore, new TRPCDataTransformationCore(utilsCore));

export const studyResolvers: DMPResolversMap = {
    Query: {
        getStudy: async (_parent, args: { studyId: string }, context) => {
            try {
                const study = (await studyCore.getStudies(context.req.user, args.studyId))[0];
                return {
                    ...study,
                    createdBy: study.life.createdUser,
                    deleted: study.life.deletedTime,
                    dataVersions: study.dataVersions.map(el => {
                        return {
                            ...el,
                            updateDate: el.life.createdTime.toString(),
                            contentId: el.id
                        };
                    })
                };
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        getProject: async () => {
            // TO BE REMOVED
            return null;
        },
        getStudyFields: async (_parent, { studyId, versionId }: { studyId: string, versionId?: string | null }, context) => {
            try {
                // V3 and V2 parse version id as different logic; for compatibility, we need to convert the version id to V3 version id
                let dataVersion: string | Array<string | null> | null | undefined = versionId;
                if (versionId === null) {
                    const study = (await studyCore.getStudies(context.req.user, studyId))[0];
                    dataVersion = study.dataVersions.map(el => el.id);
                    dataVersion.push(null);
                }
                const fields = await dataCore.getStudyFields(context.req.user, studyId, dataVersion);
                return convertV3FieldToV2Field(fields).sort((a, b) => a.fieldId.localeCompare(b.fieldId));
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        getOntologyTree: async () => {
            // TO BE REIMPLEMENTED
            return null;
        },
        getDataRecords: async (_parent, { studyId, queryString, versionId }: { queryString: IQueryString, studyId: string, versionId: string | null | undefined }, context) => {
            try {
                const result = (await dataCore.getData(context.req.user, studyId, queryString.data_requested, versionId))['raw'];
                const groupedResult: IGroupedData = {};
                for (let i = 0; i < result.length; i++) {
                    const { m_subjectId, m_visitId } = result[i].properties;
                    const m_fieldId = result[i].fieldId;
                    const value = result[i].value;
                    if (!groupedResult[m_subjectId]) {
                        groupedResult[m_subjectId] = {};
                    }
                    if (!groupedResult[m_subjectId][m_visitId]) {
                        groupedResult[m_subjectId][m_visitId] = {};
                    }
                    groupedResult[m_subjectId][m_visitId][m_fieldId] = value;
                }
                return {
                    data: groupedResult
                };
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        }
    },
    Study: {
        projects: async () => {
            // TO BE REMOVED
            return [];
        },
        jobs: async () => {
            // TO BE REIMPLEMENTED
            return [];
        },
        roles: async (study: IStudy, _args: never, context) => {
            try {
                return await permissionCore.getRolesOfStudy(context.req.user, study.id);
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        files: async (study: IStudy, _args: never, context) => {
            try {
                const files = await dataCore.getStudyFiles(context.req.user, study.id);
                return files.map(el => {
                    return {
                        ...el,
                        fileSize: el.fileSize.toString(),
                        uploadTime: el.life.createdTime.toString(),
                        uploadedBy: el.life.createdUser
                    };
                });
            } catch (e) {
                return [];
            }
        },
        subjects: async () => {
            // TO BE REMOVED
            return [[], []];
        },
        visits: async () => {
            // TO BE REMOVED
            return [[], []];
        },
        numOfRecords: async () => {
            // TO_BE_REMOVED
            return [0, 0];
        },
        currentDataVersion: async (study: IStudy) => {
            return study.currentDataVersion;
        }
    },
    // TO_BE_REMOVED
    Project: {
        fields: async () => {
            return [];
        },
        jobs: async () => {
            return [];
        },
        files: async () => {
            return [];
        },
        dataVersion: async () => {
            return null;
        },
        summary: async () => {
            return {};
        },
        patientMapping: async () => {
            return {};
        },
        roles: async () => {
            return [];
        },
        iCanEdit: async () => { // TO_DO
            return true;
        }
    },
    Mutation: {
        createStudy: async (_parent, { name, description }: { name: string, description: string, type?: studyType }, context) => {
            try {
                const res = await studyCore.createStudy(context.req.user, name, description);
                return {
                    ...res,
                    type: studyType.SENSOR
                };
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        editStudy: async (_parent, { studyId, description }: { studyId: string, description: string }, context) => {
            try {
                return await studyCore.editStudy(context.req.user, studyId, undefined, description);
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        createNewField: async (_parent, { studyId, fieldInput }: { studyId: string, fieldInput: V2CreateFieldInput[] }, context) => {
            try {
                const responses: IGenericResponse[] = [];
                const converted = convertV2CreateFieldInputToV3(studyId, fieldInput);
                for (let i = 0; i < converted.length; i++) {
                    try {
                        const res = await dataCore.createField(context.req.user, converted[i]);
                        responses.push({ id: undefined, successful: true, description: `Field ${res.fieldId}-${res.fieldName} is created successfully.` });
                    } catch (e) {
                        responses.push({ id: undefined, successful: false, description: (e as CoreError).message });
                    }
                }
                return responses;
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        editField: async (_parent, { studyId, fieldInput }: { studyId: string, fieldInput: V2EditFieldInput }, context) => {
            try {
                return await dataCore.editField(context.req.user, convertV2EditFieldInputToV3(studyId, [fieldInput])[0]);
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        deleteField: async (_parent, { studyId, fieldId }: { studyId: string, fieldId: string }, context) => {
            try {
                await dataCore.deleteField(context.req.user, studyId, fieldId);
                const fields = await db.collections.field_dictionary_collection.find({ 'studyId': studyId, 'fieldId': fieldId, 'life.deletedTime': { $exists: true } }).toArray();
                const lastField = fields[fields.length - 1];
                return convertV3FieldToV2Field([lastField])[0];
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        uploadDataInArray: async (_parent, { studyId, data }: { studyId: string, data: IDataClip[] }, context) => {
            try {
                return await dataCore.uploadData(context.req.user, studyId, convertV2DataClipInputToV3(data));
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        createNewDataVersion: async (_parent, { studyId, dataVersion, tag }: { studyId: string, dataVersion: string, tag: string }, context) => {
            try {
                const version = await studyCore.createDataVersion(context.req.user, studyId, tag, dataVersion);
                return {
                    ...version,
                    updateDate: version.life.createdTime.toString(),
                    contentId: version.id
                };
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        createOntologyTree: async () => {
            // TO BE REIMPLEMENTED
            return null;
        },
        deleteOntologyTree: async () => {
            // TO BE REIMPLEMENTED
            return null;
        },
        createProject: async () => {
            // TO BE REMOVED
            return null;
        },
        deleteProject: async () => {
            // TO BE REMOVED
            return null;
        },
        deleteStudy: async (_parent, { studyId }: { studyId: string }, context) => {
            try {
                return await studyCore.deleteStudy(context.req.user, studyId);
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        },
        setDataversionAsCurrent: async (_parent, { studyId, dataVersionId }: { studyId: string, dataVersionId: string }, context) => {
            try {
                await studyCore.setDataversionAsCurrent(context.req.user, studyId, dataVersionId);
                const study = (await studyCore.getStudies(context.req.user, studyId))[0];
                return {
                    id: studyId,
                    currentDataVersion: study.currentDataVersion,
                    dataVersions: study.dataVersions.map(el => {
                        return {
                            ...el,
                            updateDate: el.life.createdTime.toString(),
                            contentId: el.id
                        };
                    })
                };
            } catch (e) {
                return GraphQLErrorDecroator(e as CoreError);
            }
        }
    },
    Subscription: {}
};
