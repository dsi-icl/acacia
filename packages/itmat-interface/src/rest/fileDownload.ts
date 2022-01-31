import { Request, Response } from 'express';
import { db } from '../database/database';
import { objStore } from '../objStore/objStore';
import { permissionCore } from '../graphql/core/permissionCore';
import { Models, task_required_permissions } from 'itmat-commons';

export const fileDownloadController = async (req: Request, res: Response): Promise<void> => {
    const requester = req.user as Models.UserModels.IUser;
    const requestedFile = req.params.fileId;

    if (!requester) {
        res.status(403).json({ error: 'Please log in.' });
        return;
    }

    try {
        /* download file */
        const file = await db.collections!.files_collection.findOne({ id: requestedFile, deleted: null })!;
        if (!file) {
            res.status(404).json({ error: 'File not found or you do not have the necessary permission.' });
            return;
        }

        /* check permission */
        const hasPermission = await permissionCore.userHasTheNeccessaryPermission(
            task_required_permissions.access_project_data,
            requester,
            file.studyId
        );
        if (!hasPermission) {
            res.status(404).json({ error: 'File not found or you do not have the necessary permission.' });
            return;
        }

        const stream = await objStore.downloadFile(file.studyId, file.uri);
        res.set('Content-Type', 'application/octet-stream');
        res.set('Content-Type', 'application/download');
        res.set('Content-Disposition', `attachment; filename="${file.fileName}"`);
        stream.pipe(res, { end: true });
        return;
    } catch (e) {
        res.status(500).json(e);
        return;
    }
};
