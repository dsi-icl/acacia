import mongo from 'mongodb';
import { Models, OpenStackSwiftObjectStore, IOpenSwiftObjectStoreConfig } from 'itmat-utils';
import { UKBDataCurator } from '../curation/UKBData';
import { objectStore } from '../objectStore/OpenStackObjectStore'; 

 
interface IMongoChangeFeed {
}

async function changeStreamListener(change: any): Promise<void> {
    console.log('register change');
    if (change.fullDocument.numberOfTransferredFiles !== change.fullDocument.numberOfFilesToTransfer) {
        return;
    }
    const fileName = Models.JobModels.jobTypes.UKB_CSV_UPLOAD.requiredFiles[0];
    const { id: jobId } = change.fullDocument;

    const downloadFileStream: NodeJS.ReadableStream = await objectStore.downloadFile(fileName, jobId);

    const curator = new UKBDataCurator(jobId, fileName, downloadFileStream);
    curator.processIncomingStreamAndUploadToMongo();
} 