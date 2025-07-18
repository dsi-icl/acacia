import { FileUploadSchema, IAST, enumASTNodeTypes, enumConditionOps, enumDataTransformationOperation, enumDataTypes, enumMathOps } from '@itmat-broker/itmat-types';
import { z } from 'zod';
import { TRPCBaseProcedure, TRPCRouter } from './trpc';
import { DataCore } from '@itmat-broker/itmat-cores';

const ZAST: z.ZodType<IAST> = z.lazy(() => z.object({
    type: z.nativeEnum(enumASTNodeTypes),
    operator: z.union([z.nativeEnum(enumMathOps), z.null()]),
    value: z.union([z.number(), z.string(), z.null()]),
    parameters: z.record(z.string(), z.unknown()),
    children: z.union([z.array(ZAST), z.null()]) // null for lead node; OPERATION type should not be a lead node.
}));

const ZValueVerifier = z.object({
    formula: ZAST,
    condition: z.nativeEnum(enumConditionOps),
    value: z.union([z.string(), z.number()]),
    parameters: z.record(z.string(), z.unknown())
});

const ZFieldProperty = z.object({
    name: z.string(),
    verifier: z.optional(z.array(z.array(ZValueVerifier))),
    description: z.optional(z.string()),
    required: z.boolean()
});

const ZCategoricalOption = z.object({
    code: z.string(),
    description: z.string()
});

const CreateFieldInputSchema = z.object({
    studyId: z.string(),
    fieldName: z.string(),
    fieldId: z.string(),
    description: z.optional(z.string()),
    dataType: z.nativeEnum(enumDataTypes),
    categoricalOptions: z.optional(z.array(ZCategoricalOption)),
    unit: z.optional(z.string()),
    comments: z.optional(z.string()),
    verifier: z.optional(z.array(z.array(ZValueVerifier))),
    properties: z.optional(z.array(ZFieldProperty)),
    metadata: z.optional(z.record(z.string(), z.unknown()))
});

const EditFieldInputSchema = CreateFieldInputSchema;

const ZDataClipInput = z.object({
    fieldId: z.string(),
    value: z.string(),
    timestamps: z.optional(z.number()),
    properties: z.optional(z.any())
});

export class DataRouter {
    baseProcedure: TRPCBaseProcedure;
    router: TRPCRouter;
    dataCore: DataCore;
    constructor(baseProcedure: TRPCBaseProcedure, router: TRPCRouter, dataCore: DataCore) {
        this.baseProcedure = baseProcedure;
        this.router = router;
        this.dataCore = dataCore;
    }

    _router() {
        return this.router({
            /**
             * Get the list of fields of a study.
             *
             * @param studyId - The id of the study.
             * @param projectId - The id of the project.
             * @param versionId - The id of the version. By default, we will return data until this version. If not specificed, will return the latest versioned data.
             *
             * @return IField - The list of objects of IField.
             */
            getStudyFields: this.baseProcedure.input(z.object({
                studyId: z.string(),
                versionId: z.optional(z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])),
                fieldIds: z.optional(z.array(z.string()))
            })).query(async (opts) => {
                return await this.dataCore.getStudyFields(opts.ctx.user, opts.input.studyId, opts.input.versionId, opts.input.fieldIds);
            }),
            /**
             * Create a field of a study. To adjust to data versioning, create an existing field wil not throw an error.
             *
             * @param studyId - The id of the study.
             * @param fieldName - The name of the field.
             * @param fieldId - The value of the id of the field. Should be unique.
             * @param description - The description of the field.
             * @param dataType - The dataType of the field.
             * @param categoricalOptions - The options of the field if the field is a categorical field.
             * @param unit - The unit of the field.
             * @param comments - The comments of the field.
             * @param verifier - The verifier of the field.
             * @param properties - The properties of the field.
             *
             * @return IField
             */
            createStudyField: this.baseProcedure.input(CreateFieldInputSchema).mutation(async (opts) => {
                return await this.dataCore.createField(opts.ctx.user, {
                    studyId: opts.input.studyId,
                    fieldName: opts.input.fieldName,
                    fieldId: opts.input.fieldId,
                    description: opts.input.description,
                    dataType: opts.input.dataType,
                    categoricalOptions: opts.input.categoricalOptions,
                    unit: opts.input.unit,
                    comments: opts.input.comments,
                    verifier: opts.input.verifier,
                    properties: opts.input.properties,
                    metadata: opts.input.metadata
                });
            }),
            /**
             * Edit a field of a study.
             *
             * @param studyId - The id of the study.
             * @param fieldName - The name of the field.
             * @param fieldId - The value of the id of the field. Should be unique.
             * @param description - The description of the field.
             * @param dataType - The dataType of the field.
             * @param categoricalOptions - The options of the field if the field is a categorical field.
             * @param unit - The unit of the field.
             * @param comments - The comments of the field.
             * @param verifier - The verifier of the field.
             * @param properties - The properties of the field.
             *
             * @return IField
             */
            editStudyField: this.baseProcedure.input(EditFieldInputSchema).mutation(async (opts) => {
                return await this.dataCore.editField(opts.ctx.user, {
                    studyId: opts.input.studyId,
                    fieldName: opts.input.fieldName,
                    fieldId: opts.input.fieldId,
                    description: opts.input.description,
                    dataType: opts.input.dataType,
                    categoricalOptions: opts.input.categoricalOptions,
                    unit: opts.input.unit,
                    comments: opts.input.comments,
                    verifier: opts.input.verifier,
                    properties: opts.input.properties
                });
            }),
            /**
             * Delete a field of a study.
             *
             * @param studyId - The id of the stduy.
             * @param fieldId - The id of the field.
             *
             * @return IGenericResponse
             */
            deleteStudyField: this.baseProcedure.input(z.object({
                studyId: z.string(),
                fieldId: z.string()
            })).mutation(async (opts) => {
                return await this.dataCore.deleteField(opts.ctx.user, opts.input.studyId, opts.input.fieldId);
            }),
            /**
             * Upload data clips to a study.
             *
             * @param requester - The id of the requester.
             * @param studyId - The id of the study.
             * @param data - The list of data clips.
             *
             * @return IGenericResponse - The list of objects of IGenericResponse
             */
            uploadStudyData: this.baseProcedure.input(z.object({
                studyId: z.string(),
                data: z.array(ZDataClipInput)
            })).mutation(async (opts) => {
                return await this.dataCore.uploadData(
                    opts.ctx.req.user,
                    opts.input.studyId,
                    opts.input.data
                );
            }),
            /**
             * Get the data of a study.
             *
             * @param studyId - The id of the study.
             * @param versionId - The id of the data version. By default not specified for the latest version.
             * @param aggregation - The aggregation pipeline. Used for data post preocessing.
             * @param fieldIds - The list of fields to return.
             * @param useCache - Whether to use fetch the data from cache.
             * @param forceUpdate - Whether to update the cache with the results from this call.
             *
             * @return Partial<IData>[] - The list of objects of Partial<IData>
             */
            getStudyData: this.baseProcedure.input(z.object({
                studyId: z.string(),
                versionId: z.optional(z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])),
                aggregation: z.optional(z.record(z.string(), z.array(z.object({
                    operationName: z.nativeEnum(enumDataTransformationOperation),
                    params: z.record(z.string(), z.unknown())
                })))),
                fieldIds: z.optional(z.array(z.string())),
                useCache: z.optional(z.boolean()),
                forceUpdate: z.optional(z.boolean()),
                fromCold: z.optional(z.boolean())
            })).query(async (opts) => {
                return await this.dataCore.getData(
                    opts.ctx.req.user,
                    opts.input.studyId,
                    opts.input.fieldIds,
                    opts.input.versionId,
                    opts.input.aggregation,
                    opts.input.useCache,
                    opts.input.forceUpdate,
                    opts.input.fromCold
                );
            }),
            /**
                 * Get the data of a study filtered by dataVersion. This is a simplified version of the getData function.
                 *
                 * @param studyId - The id of the study.
                 * @param versionId - The id of the data version. By default not specified for the latest version.
                 * @param aggregation - The aggregation pipeline. Used for data post preocessing.
                 * @param fieldIds - The list of fields to return.
                 * @param useCache - Whether to use fetch the data from cache.
                 * @param forceUpdate - Whether to update the cache with the results from this call.
                 *
                 * @return Partial<IData>[] - The list of objects of Partial<IData>
                 */
            getStudyDataLatest: this.baseProcedure.input(z.object({
                studyId: z.string(),
                fieldIds: z.optional(z.array(z.string()))
            })).query(async (opts) => {
                return await this.dataCore.getDataLatest(
                    opts.ctx.req.user,
                    opts.input.studyId,
                    opts.input.fieldIds
                );
            }),
            /**
             * Delete data of a study. We add a deleted document in the database.
             *
             * @param requester - The id of the requester.
             * @param studyId - The id of the study.
             * @param documentId - The id of the mongo document.
             *
             * @return IGenreicResponse - The object of IGenericResponse.
             */
            deleteStudyData: this.baseProcedure.input(z.object({
                studyId: z.string(),
                fieldId: z.string(),
                properties: z.optional(z.any())
            })).mutation(async (opts) => {
                return await this.dataCore.deleteData(
                    opts.ctx.req.user,
                    opts.input.studyId,
                    opts.input.fieldId,
                    opts.input.properties
                );
            }),
            /**
             * Upload a data file.
             *
             * @param studyId - The id of the study.
             * @param file - The file to upload.
             * @param properties - The properties of the file. Need to match field properties if defined.
             * @param fieldId - The id of the field.
             *
             * @return IData
             */
            uploadStudyFileData: this.baseProcedure.input(z.object({
                studyId: z.string(),
                files: z.object({
                    file: z.array(FileUploadSchema)
                }),
                properties: z.optional(z.string()), // pass the json string of the properties
                fieldId: z.string()
            })).mutation(async (opts) => {
                return await this.dataCore.uploadFileData(
                    opts.ctx.req.user,
                    opts.input.studyId,
                    opts.input.files.file?.[0],
                    opts.input.fieldId,
                    opts.input.properties
                );
            }),
            /**
             * Get the files of a study.
             *
             * @param studyId - The id of the study.
             * @param versionId - The id of the data version. By default not specified for the latest version.
             * @param fieldIds - The list of fields to return.
             *
             * @return IFile[] - The list of objects of IFile.
             */
            getFiles: this.baseProcedure.input(z.object({
                studyId: z.string(),
                versionId: z.optional(z.union([z.string(), z.null(), z.array(z.union([z.string(), z.null()]))])),
                fieldIds: z.optional(z.array(z.string())),
                readable: z.optional(z.boolean()),
                useCache: z.optional(z.boolean()),
                forceUpdate: z.optional(z.boolean())
            })).query(async (opts) => {
                return await this.dataCore.getStudyFiles(
                    opts.ctx.req.user,
                    opts.input.studyId,
                    opts.input.fieldIds,
                    opts.input.versionId,
                    opts.input.readable,
                    opts.input.useCache,
                    opts.input.forceUpdate
                );
            }),
            /**
             * Get the latest files of a study.
             *
             * @param studyId - The id of the study.
             * @param versionId - The id of the data version. By default not specified for the latest version.
             * @param fieldIds - The list of fields to return.
             *
             * @return IFile[] - The list of objects of IFile.
             */
            getFilesLatest: this.baseProcedure.input(z.object({
                studyId: z.string(),
                versionId: z.optional(z.string()),
                fieldIds: z.optional(z.array(z.string())),
                readable: z.optional(z.boolean()),
                useCache: z.optional(z.boolean()),
                forceUpdate: z.optional(z.boolean())
            })).query(async (opts) => {
                return await this.dataCore.getStudyFilesLatest(
                    opts.ctx.req.user,
                    opts.input.studyId,
                    opts.input.fieldIds,
                    opts.input.versionId,
                    opts.input.readable,
                    opts.input.useCache,
                    opts.input.forceUpdate
                );
            }),
            /**
             * Get the file of a study.
             *
             * @param fileId - The id of the file.
             *
             * @return IFile - The object of IFile.
             */
            deleteFile: this.baseProcedure.input(z.object({
                fileId: z.string()
            })).mutation(async (opts) => {
                return await this.dataCore.deleteFile(opts.ctx.req.user, opts.input.fileId);
            }),
            /**
             * Get the summary of a study.
             *
             * @param studyId - The id of the study.
             *
             * @return The object of IStudySummary.
             */
            getStudyDataSummary: this.baseProcedure.input(z.object({
                studyId: z.string(),
                useCache: z.optional(z.boolean()),
                forceUpdate: z.optional(z.boolean())
            })).query(async (opts) => {
                return await this.dataCore.getStudySummary(opts.ctx.req.user, opts.input.studyId, opts.input.useCache, opts.input.forceUpdate);
            })
        });
    }
}


/** Example of data versioning aggregation */
/**
{
            clinical: [
                { operationName: 'Group', params: { keys: ['fieldId', 'properties.Participant ID', 'properties.Visit ID'], skipUnmatch: true } },
                { operationName: 'LeaveOne', params: { scoreFormula: { type: enumASTNodeTypes.VARIABLE, operator: null, value: 'life.createdTime', parameters: {}, children: null }, isDescend: true } },
                {
                    operationName: 'Filter', params: {
                        filters: {
                            deleted: {
                                formula: {
                                    type: enumASTNodeTypes.VARIABLE,
                                    operation: null,
                                    value: 'life.deletedTime',
                                    parameter: {},
                                    children: null
                                },
                                condition: enumConditionOps.GENERALISNULL,
                                value: '',
                                parameters: {}
                            }
                        }
                    }
                }
            ],
            device: [
                { operationName: 'Group', params: { keys: ['properties.Participant ID', 'properties.Device Type', 'properties.Device ID', 'properties.Start Date', 'properties.End Date'], skipUnmatch: true } },
                { operationName: 'LeaveOne', params: { scoreFormula: { type: enumASTNodeTypes.VARIABLE, operator: null, value: 'life.createdTime', parameters: {}, children: null }, isDescend: true } },
                {
                    operationName: 'Filter', params: {
                        filters: {
                            deleted: {
                                formula: {
                                    type: enumASTNodeTypes.VARIABLE,
                                    operation: null,
                                    value: 'life.deletedTime',
                                    parameter: {},
                                    children: null
                                },
                                condition: enumConditionOps.GENERALISNULL,
                                value: '',
                                parameters: {}
                            }
                        }
                    }
                }
                // { operationName: 'Concat', params: { concatKeys: ['properties', 'life'] } }
            ]
        }

*/
