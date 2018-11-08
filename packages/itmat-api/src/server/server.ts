import express from 'express';
import { Server, CustomError, IServerConfig, IOpenSwiftObjectStoreConfig } from 'itmat-utils';
import { APIDatabase, IAPIDatabaseConfig } from '../database/database';
import { Router } from './router';
import { Express, Request, Response, NextFunction } from 'express';
import { objectStore } from '../objectStore/OpenStackObjectStore';

interface IAPIServerConfig extends IServerConfig<IAPIDatabaseConfig> {
    bcrypt: {
        saltround: number
    }
}

export class APIServer extends Server<IAPIDatabaseConfig, APIDatabase, IAPIServerConfig> {
    protected async additionalChecks(): Promise<void> {
        if (isNaN(parseInt(this.config.bcrypt.saltround as any))) {
            console.log(
                new CustomError('Salt round must be a number')
            );
            process.exit(1);
        }
    }
}