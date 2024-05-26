import { Readable } from 'stream';
import { z } from 'zod';

export const FileUploadSchema = z.object({
    createReadStream: z.function().returns(z.instanceof(Readable)),
    filename: z.string(),
    mimetype: z.string(),
    encoding: z.string()
});