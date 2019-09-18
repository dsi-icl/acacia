import { Express, Request, Response, NextFunction } from 'express';
import { db } from '../database/database';
import { fieldCore } from '../graphql/core/fieldCore';
import { IFile } from 'itmat-utils/dist/models/file';
import { objStore } from '../objStore/objStore';

export const fileDownloadController = async (req: Request, res: Response) => { 
    const requester = req.user;
    const requestedFile = req.params.fileId;

    try {
        /* check permission */

        /* download file */
        const file: IFile = await db.collections!.files_collection.findOne({ id: requestedFile, deleted: false })!;
        if (!file) {
            res.status(404).json({ error: 'File not found. '});
            return;
        }
        const stream = await objStore.downloadFile(file.studyId, file.uri);
        res.set('Content-Type', 'application/octet-stream');
        res.set('Content-Type', 'application/download');
        res.set('Content-Disposition',  `attachment; filename="${file.fileName}"`);
        stream.pipe(res, { end: true });
        return;
    } catch (e) {
        res.status(500).json(e);
        return;
    }
};