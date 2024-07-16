import {
    IStudy,
    studyType,
    IDataClip,
    IQueryString,
    IGenericResponse,
    CoreError,
    IGroupedData
} from '@itmat-broker/itmat-types';
import { DBType, GraphQLErrorDecroator, DataCore, PermissionCore, StudyCore, V2CreateFieldInput, V2EditFieldInput, convertV2CreateFieldInputToV3, convertV2DataClipInputToV3, convertV2EditFieldInputToV3, convertV3FieldToV2Field } from '@itmat-broker/itmat-cores';
import { DMPResolversMap } from './context';

export class StudyResolvers {
    db: DBType;
    studyCore: StudyCore;
    dataCore: DataCore;
    permissionCore: PermissionCore;
    constructor(db: DBType, studyCore: StudyCore, dataCore: DataCore, permissionCore: PermissionCore) {
        this.db = db;
        this.studyCore = studyCore;
        this.dataCore = dataCore;
        this.permissionCore = permissionCore;
    }


    async getStudy(_parent, args: { studyId: string }, context) {
        try {
            const study = (await this.studyCore.getStudies(context.req.user, args.studyId))[0];
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
    }

    async getProject() {
        // TO BE REMOVED
        return null;
    }

    async getStudyFields(_parent, { studyId, versionId }: { studyId: string, versionId?: string | null }, context) {
        try {
            // V3 and V2 parse version id as different logic; for compatibility, we need to convert the version id to V3 version id
            let dataVersion: string | Array<string | null> | null | undefined = versionId;
            if (versionId === null) {
                const study = (await this.studyCore.getStudies(context.req.user, studyId))[0];
                dataVersion = study.dataVersions.map(el => el.id);
                dataVersion.push(null);
            }
            const fields = await this.dataCore.getStudyFields(context.req.user, studyId, dataVersion);
            return convertV3FieldToV2Field(fields).sort((a, b) => a.fieldId.localeCompare(b.fieldId));
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async getOntologyTree() {
        // TO BE REIMPLEMENTED
        return null;
    }

    async getDataRecords(_parent, { studyId, queryString, versionId }: { queryString: IQueryString, studyId: string, versionId: string | null | undefined }, context) {
        try {
            const result = (await this.dataCore.getData(context.req.user, studyId, queryString.data_requested, versionId))['raw'];
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

    async studyProjects() {
        // TO BE REMOVED
        return [];
    }

    async studyJobs() {
        // TO BE REIMPLEMENTED
        return [];
    }

    async studyRoles(study: IStudy, _args: never, context) {
        try {
            return await this.permissionCore.getRolesOfStudy(context.req.user, study.id);
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async studyFiles(study: IStudy, _args: never, context) {
        try {
            const files = await this.dataCore.getStudyFiles(context.req.user, study.id);
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
    }

    async studySubjects() {
        // TO BE REMOVED
        return [[], []];
    }

    async studyVisits() {
        // TO BE REMOVED
        return [[], []];
    }

    async studyNumOfRecords() {
        // TO_BE_REMOVED
        return [0, 0];
    }

    async studyCurrentDataVersion(study: IStudy) {
        return study.currentDataVersion;
    }

    // TO_BE_REMOVED
    async projectFields() {
        return [];
    }

    async projectJobs() {
        return [];
    }

    async projectFiles() {
        return [];
    }

    async projectDataVersion() {
        return null;
    }

    async projectSummary() {
        return {};
    }

    async projectPatientMapping() {
        return {};
    }

    async projectRoles() {
        return [];
    }

    async projectICanEdit() { // TO_DO
        return true;
    }

    async createStudy(_parent, { name, description }: { name: string, description: string, type?: studyType }, context) {
        try {
            const res = await this.studyCore.createStudy(context.req.user, name, description);
            return {
                ...res,
                type: studyType.SENSOR
            };
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async editStudy(_parent, { studyId, description }: { studyId: string, description: string }, context) {
        try {
            return await this.studyCore.editStudy(context.req.user, studyId, undefined, description);
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async createNewField(_parent, { studyId, fieldInput }: { studyId: string, fieldInput: V2CreateFieldInput[] }, context) {
        try {
            const responses: IGenericResponse[] = [];
            const converted = convertV2CreateFieldInputToV3(studyId, fieldInput);
            for (let i = 0; i < converted.length; i++) {
                try {
                    const res = await this.dataCore.createField(context.req.user, converted[i]);
                    responses.push({ id: undefined, successful: true, description: `Field ${res.fieldId}-${res.fieldName} is created successfully.` });
                } catch (e) {
                    responses.push({ id: undefined, successful: false, description: (e as CoreError).message });
                }
            }
            return responses;
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async editField(_parent, { studyId, fieldInput }: { studyId: string, fieldInput: V2EditFieldInput }, context) {
        try {
            return await this.dataCore.editField(context.req.user, convertV2EditFieldInputToV3(studyId, [fieldInput])[0]);
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async deleteField(_parent, { studyId, fieldId }: { studyId: string, fieldId: string }, context) {
        try {
            await this.dataCore.deleteField(context.req.user, studyId, fieldId);
            const fields = await this.db.collections.field_dictionary_collection.find({ 'studyId': studyId, 'fieldId': fieldId, 'life.deletedTime': { $exists: true } }).toArray();
            const lastField = fields[fields.length - 1];
            return convertV3FieldToV2Field([lastField])[0];
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async uploadDataInArray(_parent, { studyId, data }: { studyId: string, data: IDataClip[] }, context) {
        try {
            return await this.dataCore.uploadData(context.req.user, studyId, convertV2DataClipInputToV3(data));
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async createNewDataVersion(_parent, { studyId, dataVersion, tag }: { studyId: string, dataVersion: string, tag: string }, context) {
        try {
            const version = await this.studyCore.createDataVersion(context.req.user, studyId, tag, dataVersion);
            return {
                ...version,
                updateDate: version.life.createdTime.toString(),
                contentId: version.id
            };
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async createOntologyTree() {
        // TO BE REIMPLEMENTED
        return null;
    }

    async deleteOntologyTree() {
        // TO BE REIMPLEMENTED
        return null;
    }

    async createProject() {
        // TO BE REMOVED
        return null;
    }

    async deleteProject() {
        // TO BE REMOVED
        return null;
    }

    async deleteStudy(_parent, { studyId }: { studyId: string }, context) {
        try {
            return await this.studyCore.deleteStudy(context.req.user, studyId);
        } catch (e) {
            return GraphQLErrorDecroator(e as CoreError);
        }
    }

    async setDataversionAsCurrent(_parent, { studyId, dataVersionId }: { studyId: string, dataVersionId: string }, context) {
        try {
            await this.studyCore.setDataversionAsCurrent(context.req.user, studyId, dataVersionId);
            const study = (await this.studyCore.getStudies(context.req.user, studyId))[0];
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

    getResolvers(): DMPResolversMap {
        return {
            Query: {
                getStudy: this.getStudy.bind(this),
                getProject: this.getProject.bind(this),
                getStudyFields: this.getStudyFields.bind(this),
                getOntologyTree: this.getOntologyTree.bind(this),
                getDataRecords: this.getDataRecords.bind(this)
            },
            Study: {
                projects: this.studyProjects.bind(this),
                jobs: this.studyJobs.bind(this),
                roles: this.studyRoles.bind(this),
                files: this.studyFiles.bind(this),
                subjects: this.studySubjects.bind(this),
                visits: this.studyVisits.bind(this),
                numOfRecords: this.studyNumOfRecords.bind(this),
                currentDataVersion: this.studyCurrentDataVersion.bind(this)
            },
            Project: {
                fields: this.projectFields.bind(this),
                jobs: this.projectJobs.bind(this),
                files: this.projectFiles.bind(this),
                dataVersion: this.projectDataVersion.bind(this),
                summary: this.projectSummary.bind(this),
                patientMapping: this.projectPatientMapping.bind(this),
                roles: this.projectRoles.bind(this),
                iCanEdit: this.projectICanEdit.bind(this)
            },
            Mutation: {
                createStudy: this.createStudy.bind(this),
                editStudy: this.editStudy.bind(this),
                createNewField: this.createNewField.bind(this),
                editField: this.editField.bind(this),
                deleteField: this.deleteField.bind(this),
                uploadDataInArray: this.uploadDataInArray.bind(this),
                createNewDataVersion: this.createNewDataVersion.bind(this),
                createOntologyTree: this.createOntologyTree.bind(this),
                deleteOntologyTree: this.deleteOntologyTree.bind(this),
                deleteStudy: this.deleteStudy.bind(this),
                setDataversionAsCurrent: this.setDataversionAsCurrent.bind(this)
            }
        };
    }
}
