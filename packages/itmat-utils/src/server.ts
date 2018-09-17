import express from 'express';

export abstract class Server<T> {
    protected readonly config: T;

    constructor(config: T) {
        this.config = config;
    }

    abstract initialise(): Promise<express.Application>;
}

