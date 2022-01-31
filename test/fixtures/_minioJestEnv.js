const { createContext, runInContext } = require('vm');
const { LegacyFakeTimers, ModernFakeTimers } = require('@jest/fake-timers');
const { ModuleMocker } = require('jest-mock');
const { installCommonGlobals } = require('jest-util');
const { minioContainerSetup, minioContainerTeardown } = require('./_minioHelper');

class CustomEnvironment {

    constructor(config, context) {
        this.context = createContext();
        const global = (this.global = runInContext(
            'this',
            Object.assign(this.context, config.testEnvironmentOptions),
        ));
        global.global = global;
        global.clearInterval = clearInterval;
        global.clearTimeout = clearTimeout;
        global.setInterval = setInterval;
        global.setTimeout = setTimeout;
        global.Buffer = Buffer;
        global.setImmediate = setImmediate;
        global.clearImmediate = clearImmediate;
        global.ArrayBuffer = ArrayBuffer;
        // TextEncoder (global or via 'util') references a Uint8Array constructor
        // different than the global one used by users in tests. This makes sure the
        // same constructor is referenced by both.
        global.Uint8Array = Uint8Array;

        // URL and URLSearchParams are global in Node >= 10
        if (typeof URL !== 'undefined' && typeof URLSearchParams !== 'undefined') {
            global.URL = URL;
            global.URLSearchParams = URLSearchParams;
        }
        // TextDecoder and TextDecoder are global in Node >= 11
        if (
            typeof TextEncoder !== 'undefined' &&
            typeof TextDecoder !== 'undefined'
        ) {
            global.TextEncoder = TextEncoder;
            global.TextDecoder = TextDecoder;
        }
        // queueMicrotask is global in Node >= 11
        if (typeof queueMicrotask !== 'undefined') {
            global.queueMicrotask = queueMicrotask;
        }
        // AbortController is global in Node >= 15
        if (typeof AbortController !== 'undefined') {
            global.AbortController = AbortController;
        }
        // AbortSignal is global in Node >= 15
        if (typeof AbortSignal !== 'undefined') {
            global.AbortSignal = AbortSignal;
        }
        // Event is global in Node >= 15.4
        if (typeof Event !== 'undefined') {
            global.Event = Event;
        }
        // EventTarget is global in Node >= 15.4
        if (typeof EventTarget !== 'undefined') {
            global.EventTarget = EventTarget;
        }
        // performance is global in Node >= 16
        if (typeof performance !== 'undefined') {
            global.performance = performance;
        }
        installCommonGlobals(global, config.globals);

        this.moduleMocker = new ModuleMocker(global);

        const timerIdToRef = (id) => ({
            id,
            ref() {
                return this;
            },
            unref() {
                return this;
            },
        });

        const timerRefToId = (timer) =>
            (timer && timer.id) || undefined;

        const timerConfig = {
            idToRef: timerIdToRef,
            refToId: timerRefToId,
        };

        this.fakeTimers = new LegacyFakeTimers({
            config,
            global,
            moduleMocker: this.moduleMocker,
            timerConfig,
        });

        this.fakeTimersModern = new ModernFakeTimers({ config, global });
        this.testPath = context.testPath;
        this.docblockPragmas = context.docblockPragmas;
        this.minioContainerName = undefined;
    }

    async setup() {
        this.global.hasMinio = false;
        if (this.docblockPragmas.with === 'Minio') {
            const containerSetup = await minioContainerSetup().then(res => {
                this.global.hasMinio = true;
                return res;
            }).catch(() => {
                this.global.hasMinio = false;
            });

            if (containerSetup) {
                const [minioContainer, minioPort] = containerSetup;
                this.minioContainerName = minioContainer;
                this.global.minioContainerPort = minioPort;
            }
        }
    }

    async teardown() {
        if (this.minioContainerName)
            await minioContainerTeardown(this.minioContainerName);
        if (this.fakeTimers) {
            this.fakeTimers.dispose();
        }
        if (this.fakeTimersModern) {
            this.fakeTimersModern.dispose();
        }
        this.context = null;
        this.fakeTimers = null;
        this.fakeTimersModern = null;
    }

    getVmContext() {
        return this.context;
    }
}

module.exports = CustomEnvironment;
