import { Express, Request, Response, NextFunction } from 'express';
import { OpenStackSwiftObjectStore } from '../OpenStackObjectStore';
import * as mongo from 'mongodb';

export function healthCheck(mongoClient: mongo.MongoClient, objectStore: OpenStackSwiftObjectStore) {
    // const connectionChecker = new ConnectionChecker(mongoClient, objectStore);
    // return async (req: Request, res: Response): Promise<void> => {
    //     if (await connectionChecker.checkConnection()) {
    //         res.status(200).json({ message: 'All good.'});
    //     } else {
    //         res.status(500).json({ message: 'Server is down.'})
    //     }
    //     return;
    // }
}