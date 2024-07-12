import { Readable } from 'stream';
import { z } from 'zod';

const readStreamRefinement = z.instanceof(Readable).refine(
    (val): val is Readable => val instanceof Readable
);

export const FileUploadSchema = z.object({
    createReadStream: z.function().returns(readStreamRefinement),
    filename: z.string(),
    mimetype: z.string(),
    encoding: z.string(),
    fieldName: z.string()
});