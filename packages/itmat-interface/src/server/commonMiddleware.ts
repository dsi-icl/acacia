import jwt from 'jsonwebtoken';
import { DataCore, DataTransformationCore, FileCore, PermissionCore, userRetrieval, UtilsCore } from '@itmat-broker/itmat-cores';
import { db } from '../database/database';
import Busboy from 'busboy';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import { enumConfigType, IStudyConfig, defaultSettings, enumFileTypes, IFile, enumFileCategories, CoreError } from '@itmat-broker/itmat-types';
import { objStore } from '../objStore/objStore';
import { PassThrough } from 'stream';

const fileCore = new FileCore(db, objStore);
const permissionCore = new PermissionCore(db);
const utilsCore = new UtilsCore();
const dataTransformationCore = new DataTransformationCore(utilsCore);
const dataCore = new DataCore(db, objStore, fileCore, permissionCore, utilsCore, dataTransformationCore);

export const tokenAuthentication = async (token: string) => {
    if (token !== '') {
        const decodedPayload = jwt.decode(token);

        if (decodedPayload !== null && typeof decodedPayload === 'object') {
            // Check if it's a system token
            if (decodedPayload['isSystemToken'] === true) {

                try {
                    jwt.verify(token, decodedPayload['publicKey']);
                    return await userRetrieval(db, decodedPayload['publicKey'], true, decodedPayload['userId']);
                } catch {
                    return false;
                }
            }

            // Handle regular user token
            const pubkey = decodedPayload['publicKey'];
            if (!pubkey) {
                return false;
            }

            try {
                jwt.verify(token, pubkey);
                return await userRetrieval(db, pubkey);
            } catch {
                return false;
            }
        }
        return false;
    }
    return null;
};

export async function uploadFileData(req, res) {
    const busboy = new Busboy({ headers: req.headers });
    const variables: Record<string, string> = {}; // To hold form fields
    let fileName: string;
    let fileSize = 0;
    const config = await db.collections.configs_collection.findOne({ type: enumConfigType.STUDYCONFIG, key: variables['studyId'] });
    const fileConfig = config ? config.properties : defaultSettings.studyConfig;
    const fileSizeLimit = (fileConfig as IStudyConfig).defaultMaximumFileSize;
    const hash_ = crypto.createHash('sha256');

    busboy.on('field', (fieldname, val) => {
        variables[fieldname] = val;  // Capture fields
    });
    let passThrough: PassThrough;
    // Capture file stream and upload it immediately
    busboy.on('file', (fieldname, file, filename) => {
        fileName = filename; // Store the filename
        const fileUri = uuid(); // Generate unique file identifier

        passThrough = new PassThrough(); // Create a passthrough stream

        // Start the MinIO upload using the PassThrough stream
        // const minioUploadPromise = objStore.uploadFile(passThrough, variables['studyId'], fileUri, fileSize);

        // Listen for data chunks to calculate size and hash while piping to MinIO
        file.on('data', (chunk) => {
            fileSize += chunk.length; // Increment file size
            hash_.update(chunk); // Update the hash with the chunk of data

            if (fileSize > fileSizeLimit) {
                file.destroy(); // Stop the stream if the file size exceeds the limit
                passThrough.end(); // End the passThrough to stop MinIO upload
                res.status(400).json({ message: 'File size exceeds the limit' });
                return;
            }

            // Pass the chunk to MinIO via the PassThrough stream
            passThrough.write(chunk);
        });

        // When the file stream ends
        file.on('end', async () => {
            try {
                // Upload file to MinIO
                const minioUploadPromise = objStore.uploadFile(passThrough, variables['studyId'], fileUri, fileSize);
                passThrough.end(); // Signal the end of the PassThrough stream
                await minioUploadPromise;
            } catch (err: unknown) {
                // Return a response with the error message
                return res.status(500).json({ message: 'Error uploading file to MinIO', error: { message: (err as CoreError).message } });
            }

            // Hash the file and proceed with the file entry creation
            const hashString = hash_.digest('hex');
            const fileType = (filename.split('.').pop() as string).toUpperCase();
            if (!Object.keys(enumFileTypes).includes(fileType)) {
                return res.status(400).json({ error: { message: `File type ${fileType} not supported.` } });
            }

            // Create the file entry object
            const fileEntry: IFile = {
                id: uuid(),
                studyId: variables['studyId'],
                userId: null,
                fileName: fileName,
                fileSize: fileSize,
                description: variables['description'],
                uri: fileUri,
                hash: hashString,
                fileType: fileType as enumFileTypes,
                fileCategory: enumFileCategories.STUDY_DATA_FILE,
                properties: variables['properties'] ? JSON.parse(variables['properties']) : {},
                sharedUsers: [],
                life: {
                    createdTime: Date.now(),
                    createdUser: req.user.id,
                    deletedTime: null,
                    deletedUser: null
                },
                metadata: {}
            };
            try {

                // Perform any additional processing and insert file data into the database
                const response = await dataCore.uploadFileDataWithFileEntry(req.user,
                    variables['studyId'],
                    variables['fieldId'],
                    fileEntry,
                    JSON.stringify({
                        ...JSON.parse(variables['properties'] ?? '{}'),
                        FileName: fileName
                    })
                );

                await db.collections.files_collection.insertOne(fileEntry);
                // Send success response
                res.status(200).json({ result: { data: response } });
            } catch (err: unknown) {
                // Handle any error during processing or insertion
                return res.status(400).json({ message: 'Failed to upload file.', error: { message: (err as CoreError).message } });
            }
        });

        file.on('error', (err) => {
            return res.status(400).json({ message: 'Failed to upload file.', error: { message: (err as CoreError).message } });
        });
    });

    // When Busboy finishes processing
    busboy.on('finish', () => {
        // No need to respond here; we already send the response after upload completion
    });

    // Pipe the request into Busboy to handle the file stream
    req.pipe(busboy);
}
