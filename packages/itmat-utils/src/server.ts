import express from 'express';

export abstract class Server<T> {
    protected readonly config: T;

    constructor(config: T) {
        this.config = config;
    }

    protected abstract initialise(): Promise<express.Application>;
    public abstract start(): Promise<void>; //start() calls initialise();
}

