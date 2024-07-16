import { FileUpload } from 'graphql-upload-minimal';
import { DBType, DataCore, errorCodes } from '@itmat-broker/itmat-cores';
import { CoreError, deviceTypes, enumCoreErrors, enumReservedKeys } from '@itmat-broker/itmat-types';
import { GraphQLError } from 'graphql';

export class FileResolvers {
    db: DBType;
    dataCore: DataCore;
    constructor(db: DBType, dataCore: DataCore) {
        this.db = db;
        this.dataCore = dataCore;
    }

    async uploadFile(_parent, args: { fileLength?: bigint, studyId: string, file: Promise<FileUpload>, description: string, hash?: string }, context) {
        // The pre-processing is for IDEA-FAST device data only
        // For new studies, use the new API
        let targetFieldId: string | undefined = undefined;
        let parsedDescription: Record<string, string> | undefined = undefined;

        try {
            parsedDescription = JSON.parse(args.description);
            if (!parsedDescription) {
                throw new GraphQLError(
                    'File description is invalid.',
                    { extensions: { code: enumCoreErrors.CLIENT_MALFORMED_INPUT } }
                );
            }
            if (parsedDescription['fieldId']) {
                targetFieldId = parsedDescription['fieldId'].toString();
            } else {
                // individual device data
                if (parsedDescription['deviceId']) {
                    const device = parsedDescription['deviceId']?.slice(0, 3);
                    targetFieldId = `Device_${deviceTypes[device].replace(/ /g, '_')}`;
                } else {
                    // study level data
                    targetFieldId = enumReservedKeys.STUDY_LEVEL_DATA;
                }
            }
        } catch {
            throw new GraphQLError(
                'File description is invalid.',
                { extensions: { code: enumCoreErrors.CLIENT_MALFORMED_INPUT } }
            );
        }
        if (!targetFieldId) {
            throw new GraphQLError(
                'Field Id not found.',
                { extensions: { code: enumCoreErrors.CLIENT_MALFORMED_INPUT } }
            );
        } else {
            try {
                const res = await this.dataCore.uploadFileData(context.req.user, args.studyId, await args.file, targetFieldId, args.description);
                const fileEntry = await this.db.collections.files_collection.findOne({ id: res.id });
                if (args.fileLength) {
                    if (args.fileLength.toString() !== fileEntry?.fileSize.toString()) {
                        throw new GraphQLError(
                            'File size mismatch.',
                            { extensions: { code: enumCoreErrors.CLIENT_MALFORMED_INPUT } }
                        );
                    }
                }
                if (args.hash) {
                    if (args.hash !== fileEntry?.hash) {
                        throw new GraphQLError(
                            'File hash not match.',
                            { extensions: { code: enumCoreErrors.CLIENT_MALFORMED_INPUT } }
                        );
                    }
                }
                return {
                    ...fileEntry,
                    description: JSON.stringify(fileEntry?.properties),
                    uploadTime: fileEntry?.life.createdTime,
                    uploadedBy: fileEntry?.life.createdUser,
                    metadata: {
                        ...fileEntry?.properties
                    }
                };
            } catch (e) {
                throw new GraphQLError((e as CoreError).message, { extensions: { code: errorCodes.CLIENT_MALFORMED_INPUT } });
            }
        }
    }
    /**
     * Deprecated API.
     *
     */
    async deleteFile(_parent, args: { fileId: string }, context) {
        const data = await this.db.collections.data_collection.findOne({ value: args.fileId });
        if (!data) {
            throw new CoreError(
                enumCoreErrors.CLIENT_ACTION_ON_NON_EXISTENT_ENTRY,
                'Data entry not found.'
            );
        }
        return await this.dataCore.deleteData(context.req.user, data.studyId, data.fieldId, data.properties);
    }

    getResolvers() {
        return {
            Mutation: {
                uploadFile: this.uploadFile.bind(this),
                deleteFile: this.deleteFile.bind(this)
            }
        };
    }
}