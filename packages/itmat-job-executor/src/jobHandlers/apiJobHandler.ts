import { UserCore, JobCore, InstanceCore, LxdManager } from '@itmat-broker/itmat-cores';
import { mailer } from '../emailer/emailer';
import configManager from '../utils/configManager';
import { objStore } from '../objStore/objStore';
import { JobHandler } from './jobHandlerInterface';
import { IJob, IJobActionReturn } from '@itmat-broker/itmat-types';
import {db} from '../database/database';

export class APIHandler extends JobHandler {
    private static _instance: APIHandler;
    public jobCore: JobCore;
    public instanceCore: InstanceCore;
    public lxdManager: LxdManager;

    constructor() {
        super();
        this.jobCore = new JobCore(db);
        this.instanceCore = new InstanceCore(db, mailer, configManager, this.jobCore, new UserCore(db, mailer, configManager, objStore));
        this.lxdManager = new LxdManager(configManager);
    }

    public static override async getInstance(): Promise<JobHandler> {
        if (!APIHandler._instance) {
            APIHandler._instance = new APIHandler();
        }
        return APIHandler._instance;
    }

    public async execute(document: IJob):Promise<IJobActionReturn>{
        try {
            if (!document.executor) {
                return { successful: false, error: 'No path found.' };
            }
            const [className, methodName] = document.executor.path.split('.');
            const instance = this[className as keyof this] as unknown;

            if (!instance || typeof (instance as Record<string, unknown>)[methodName] !== 'function') {
                throw new Error(`Method ${methodName} not found on class ${className}`);
            }

            const method = (instance as Record<string, (...args: unknown[]) => unknown>)[methodName];
            let parameters: unknown[] = [];
            if (Array.isArray(document.parameters)) {
                parameters = document.parameters;
            } else if (document.parameters && typeof document.parameters === 'object') {
                parameters = [document.parameters];
            }

            const result = await method(...parameters);
            return { successful: true, result };
        } catch (e) {
            return { successful: false, error: e instanceof Error ? e.message : JSON.stringify(e) };
        }
    }
}