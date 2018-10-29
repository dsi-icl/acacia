import mongo from 'mongodb';
import { Models, OpenStackSwiftObjectStore, IOpenSwiftObjectStoreConfig } from 'itmat-utils';
import { UKBCSVDataCurator }from '../curation/curationImplementations/implementation1';
import { objectStore } from '../objectStore/OpenStackObjectStore'; 

 
interface IMongoChangeFeed {
}

export async function changeStreamListener(change: any): Promise<void> {
    console.log('register change');
    if (change.fullDocument.numberOfTransferredFiles !== change.fullDocument.numberOfFilesToTransfer) {
        return;
    }
    const fileName = Models.JobModels.jobTypes.UKB_CSV_UPLOAD.requiredFiles[0];
    const { id: jobId } = change.fullDocument;

    const downloadFileStream: NodeJS.ReadableStream = await objectStore.downloadFile(fileName, jobId);

    const curator = new UKBCSVDataCurator(jobId, fileName, downloadFileStream);
    curator.processIncomingStreamAndUploadToMongo();
} 