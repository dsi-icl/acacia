import { Request, Response } from 'express';
import { IFile } from '@itmat/commons';
import { db } from '../database/database';
import { objStore } from '../objStore/objStore';

export const fileDownloadController = async (req: Request, res: Response) => {
    const requestedFile = req.params.fileId;

    try {
        /* check permission */

        /* download file */
        const file: IFile = await db.collections!.files_collection.findOne({ id: requestedFile, deleted: null })!;
        if (!file) {
            res.status(404).json({ error: 'File not found. ' });
            return;
        }
        const stream = await objStore.downloadFile(file.studyId, file.uri);
        if (stream instanceof Error)
            return;

        res.set('Content-Type', 'application/octet-stream');
        res.set('Content-Type', 'application/download');
        res.set('Content-Disposition', `attachment; filename="${file.fileName}"`);
        stream.pipe(res, { end: true });
        return;
    } catch (e) {
        res.status(500).json(e);
    }
};
