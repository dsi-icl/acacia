import express from 'express';

export abstract class Server<T> {
    protected readonly config: T;

    constructor(config: T) {
        this.config = config;
    }

    protected abstract initialise(): Promise<express.Application>;
    public abstract start(): Promise<void>; //start() calls initialise();
}

/**
 * @description returns false if one or more of the keys are not present.
 * @param keys 
 * @param req 
 */
export function checkIfReqKeysArePresent(keys: string[], req: express.Request): boolean {
    if (!req.body) {
        return false;
    }
    for (let each of keys) {
        if (!req.body[each]) {
            return false;
        }
    }
    return true;
}