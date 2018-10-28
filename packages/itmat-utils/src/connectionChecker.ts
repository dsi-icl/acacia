import mongo from 'mongodb';
import { OpenStackSwiftObjectStore } from './OpenStackObjectStore';

export class ConnectionChecker {
    constructor(private readonly mongoClient: mongo.MongoClient, private readonly objectStore: OpenStackSwiftObjectStore) {}

    public async checkConnection(): Promise<boolean> {
        return (await this.objectStore.isConnected() && this.mongoClient.isConnected()) ;
    }
}