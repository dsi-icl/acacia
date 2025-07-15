import httpProxy from 'http-proxy';
import { WebSocketServer, WebSocket, RawData} from 'ws';
import { NextFunction, Request, Response} from 'express';
import http from 'node:http';
import * as net from 'net'; // For WebSocket handling (net.Socket)
import * as url from 'url'; // For handling target URLs
import qs from 'qs';
import {LxdManager, InstanceCore} from '@itmat-broker/itmat-cores';
import { Logger } from '@itmat-broker/itmat-commons';


// const textDecoder = new TextDecoder('utf-8');

export const registerContainSocketServer = (server: WebSocketServer, lxdManager: LxdManager) => {

    server.on('connection', (clientSocket, req) => {
        clientSocket.pause();
        let containerSocket: WebSocket | undefined;
        const query = qs.parse(req.url?.split('?')[1] || '');
        const operationId = query['o']?.toString() || '';
        const operationSecret = query['s']?.toString() || '';
        const clientMessageBuffers: Array<[Buffer, boolean]> = [];
        const containerMessageBuffers: Array<[Buffer, boolean]> = [];

        const flushClientMessageBuffers = () => {
            if (containerSocket && containerSocket.readyState === WebSocket.OPEN) {

                const curr = clientMessageBuffers[0];
                if (curr) {
                    containerSocket.send(curr[0], { binary: curr[1] }, (err) => {
                        if (err) {
                            Logger.error('Error sending message to container' + err);
                        } else {
                            clientMessageBuffers.shift();
                            if (clientMessageBuffers.length > 0)
                                flushClientMessageBuffers();
                        }
                    });
                }
            }
        };

        const flushContainerMessageBuffers = () => {
            if (clientSocket.readyState === WebSocket.OPEN) {
                const curr = containerMessageBuffers[0];
                if (curr) {
                    clientSocket.send(curr[0], { binary: curr[1] }, (err) => {
                        if (err) {
                            Logger.error(`Error sending message to client ${JSON.stringify(err)}`);
                        } else {
                            containerMessageBuffers.shift();
                            if (containerMessageBuffers.length > 0)
                                flushContainerMessageBuffers();
                        }
                    });
                }
            }
        };
        // send test message to client
        clientSocket.on('open', () => {
            clientSocket.send('test message');
        });

        clientSocket.on('message', (message, isBinary) => {
            const tuple: [Buffer, boolean] = [Buffer.from(message as ArrayBuffer), isBinary];
            clientMessageBuffers.push(tuple);
            flushClientMessageBuffers();
        });

        clientSocket.on('close', (code, reason) => {
            if (containerSocket?.readyState === WebSocket.OPEN)
                containerSocket?.close(4110, `The client socket was closed with code ${code}: ${reason.toString()}`);
        });

        clientSocket.on('error', () => {
            if (containerSocket?.readyState === WebSocket.OPEN)
                containerSocket?.close(4115, 'The client socket errored');
        });

        try {
            containerSocket = lxdManager.getOperationSocket(operationId, operationSecret);

            containerSocket.pause();
            containerSocket.on('open', () => {
                flushClientMessageBuffers();
            });

            containerSocket.on('message', (message: ArrayBuffer | Uint8Array[], isBinary: boolean) => {
                const tuple: [Buffer, boolean] = [Buffer.from(message as ArrayBuffer), isBinary];
                containerMessageBuffers.push(tuple);
                flushContainerMessageBuffers();
            });

            containerSocket.on('close', (code, reason) => {
                flushContainerMessageBuffers();
                if (clientSocket?.readyState === WebSocket.OPEN)
                    clientSocket?.close(4010, `The container socket was closed with code${code}: ${reason.toString()}`);
            });

            containerSocket.on('error', () => {
                if (clientSocket?.readyState === WebSocket.OPEN)
                    clientSocket?.close(4015, 'The container socket errored');
            });

            containerSocket.resume();
            clientSocket.resume();

        } catch (e) {
            Logger.error(`Failed to create container WebSocket: ${JSON.stringify(e)}`);
            if (clientSocket?.readyState === WebSocket.OPEN)
                clientSocket?.close(4015, 'The container socket failed to open');
        }
    });
    server.on('error', (err) => {
        Logger.error(`LXD socket broker errored: ${JSON.stringify(err)}`);
    });
};



export const registerJupyterSocketServer = (server: WebSocketServer, instanceCore: InstanceCore) => {

    server.on('connection', (clientSocket, req) => {
        const handleConnection = async () => {

            clientSocket.pause();
            clientSocket.binaryType = 'arraybuffer';

            // Extract subprotocol from the client's WebSocket request
            const clientSubprotocol = req.headers['sec-websocket-protocol'] || '';

            let containerSocket: WebSocket | undefined;

            if ( !req.url ||!req.url?.startsWith('/jupyter')){
                Logger.log(`Error request ${req.url}`);
                clientSocket.close(4004, 'Invalid Jupyter path');
                return;
            }

            // get the instance_id from the url
            const instance_id = req.url?.split('/')[2] ?? '';
            if (!instance_id) {
                clientSocket.close(4004, 'Missing instance ID');
                return;
            }

            const clientMessageBuffers: Array<[RawData, boolean]> = [];
            const containerMessageBuffers: Array<[RawData, boolean]> = [];

            let ip = ''; // Initialize with a default value
            let port = 0; // Initialize with a default value
            try {
                // Get the container IP according to the instance_id
                const result = await getInstanceTarget(instance_id, instanceCore);
                ({ ip, port } = result); // Wrap destructuring in parentheses
            } catch (error) {
                Logger.error(`Failed to retrieve container IP: ${JSON.stringify(error)}`);
                clientSocket.close(4013, 'Failed to get container IP');
                return;
            }

            const targetUrl = `ws://${ip}:${port}${req.url}`;
            const flushClientMessageBuffers = () => {

                if (containerSocket && containerSocket.readyState === WebSocket.OPEN) {

                    if (clientMessageBuffers.length > 0) {
                        const buffer = clientMessageBuffers.shift();
                        if (buffer !== undefined) {
                            const [message, isBinary] = buffer;
                            containerSocket.send(message, { binary: isBinary }, (err) => {
                                if (err) {
                                    console.error('Error sending message to container:', err);
                                }
                            });
                            if (clientMessageBuffers.length > 0)
                                flushClientMessageBuffers();
                        } else {
                            console.error('Unexpected undefined buffer');
                        }
                    }
                }
            };

            const flushContainerMessageBuffers = () => {
                if (clientSocket.readyState === WebSocket.OPEN) {

                    if (containerMessageBuffers.length > 0) {
                        const buffer = containerMessageBuffers.shift();
                        if (buffer !== undefined) {
                            const [message, isBinary] = buffer;
                            clientSocket.send(message, { binary: isBinary }, (err) => {
                                if (err) {
                                    console.error('Error sending message to client:', err);
                                }
                            });
                            if (containerMessageBuffers.length > 0)
                                flushContainerMessageBuffers();
                        }
                    }

                }
            };
            clientSocket.on('message', (message, isBinary) => {
            // Buffer the message and send it to the containerSocket
                clientMessageBuffers.push([message, isBinary]);
                flushClientMessageBuffers();
            });
            clientSocket.on('open', () => {
                clientSocket.ping();
            }   );

            clientSocket.on('error', (error) => {
                Logger.error(`clientSocket error: ${JSON.stringify(error, null, 2)}`);
                if (containerSocket && containerSocket.readyState === WebSocket.OPEN) {
                    containerSocket.close(4000, 'Client WebSocket encountered an error.');
                }
            });

            clientSocket.on('close', (code, reason) => {
                console.log('clientSocket closed. Code:', code, 'Reason:', reason.toString());
                if (containerSocket && containerSocket.readyState === WebSocket.OPEN) {
                    containerSocket.close(4001, `Client WebSocket closed. Code: ${code}`);
                }
                // if is connecting, then set a interval to close the container socket
                else if (containerSocket && containerSocket.readyState === WebSocket.CONNECTING) {
                    const interval = setInterval(() => {
                        if (containerSocket?.readyState === WebSocket.OPEN) {
                            containerSocket?.close(4001, `Client WebSocket closed. Code: ${code}`);
                            clearInterval(interval);
                        }
                    }, 1000);
                }
            });


            try {

                // Determine the protocol for the Origin header
                const originProtocol = req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';

                // Create WebSocket connection to the backend (container)
                const headers = {
                    'Sec-WebSocket-Protocol': clientSubprotocol,  // Pass client's subprotocol if provided
                    'Sec-WebSocket-Key': req.headers['sec-websocket-key'],
                    'Sec-WebSocket-Version': req.headers['sec-websocket-version'],
                    'Sec-WebSocket-Extensions': req.headers['sec-websocket-extensions'],
                    'pragma': req.headers['pragma'],
                    'cache-control': req.headers['cache-control'],
                    'upgrade': req.headers['upgrade'],
                    'connection': req.headers['connection'],
                    'Accept-Encoding': req.headers['accept-encoding'],
                    'Accept-Language': req.headers['accept-language'],
                    'User-Agent': req.headers['user-agent'],
                    'Host': `${ip}:${port}`, // Set the Host header
                    'Origin': `${originProtocol}://${ip}:${port}` // Set the Origin header
                };

                // Create WebSocket connection to the backend (container)
                containerSocket = new WebSocket(targetUrl,
                    clientSubprotocol ? [clientSubprotocol] : [],
                    { headers });
                containerSocket.binaryType = 'arraybuffer';

                containerSocket.pause();


                // Set maximum listeners to prevent memory leaks
                containerSocket.setMaxListeners(20);
                clientSocket.setMaxListeners(20);

                containerSocket.on('message', (message, isBinary) => {
                    containerMessageBuffers.push([message, isBinary]);
                    flushContainerMessageBuffers();
                });

                containerSocket.on('open', () => {
                    flushClientMessageBuffers();
                });

                containerSocket.on('error', (error) => {
                    Logger.error(`Container WebSocket error: ${JSON.stringify(error, null, 2)}`);
                    if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
                        clientSocket.close(4002, 'Container WebSocket encountered an error.');
                    }
                });

                containerSocket.on('close', (code, reason) => {
                    flushContainerMessageBuffers();
                    if (clientSocket?.readyState === WebSocket.OPEN)
                        clientSocket?.close(4010, `The container socket was closed with code${code}: ${reason.toString()}`);
                });

                containerSocket.resume();
                clientSocket.resume();


            } catch (error) {
                console.error('Failed to create container WebSocket:', error);
                if (clientSocket?.readyState === WebSocket.OPEN)
                    clientSocket?.close(4015, 'The container socket failed to open');
                if (containerSocket?.readyState === WebSocket.OPEN)
                    containerSocket?.close(4015, 'The container socket failed to open');
            }
        };
        // Call the async function
        handleConnection().catch((error) => {
            Logger.error(`Error handling jupyter connection: ${JSON.stringify(error)}`);
            clientSocket.close();
        });
    });
    server.on('error', (err) => {
        Logger.error(`LXD Jupyter socket broker errored: ${JSON.stringify(err)}`);
    });
};



// Enhanced ProxyCache interface with lastUsed timestamp
interface ProxyCache {
    [instance_id: string]: {
        proxy: httpProxy;
        ip: string;
        port: number;
        lastUsed: number; // timestamp when last used
    };
}

// How long a proxy should remain cached without being used (30 minutes)
const PROXY_CACHE_TTL = 30 * 60 * 1000;

const proxyCache: ProxyCache = {};
const vncProxyCache: ProxyCache = {};

// Track our cleanup interval ID to prevent duplicate intervals
let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Cleanup function for proxy caches
 * Removes entries that haven't been used for PROXY_CACHE_TTL milliseconds
 */
function cleanupProxyCaches() {
    const now = Date.now();

    // Clean HTTP proxy cache
    Object.entries(proxyCache).forEach(([instanceId, cacheEntry]) => {
        if (now - cacheEntry.lastUsed > PROXY_CACHE_TTL) {
            Logger.log(`Cleaning up stale proxy cache for instance ${instanceId}`);
            // Close the proxy to clean up any open connections
            cacheEntry.proxy.close();
            delete proxyCache[instanceId];
        }
    });

    // Clean VNC proxy cache
    Object.entries(vncProxyCache).forEach(([instanceId, cacheEntry]) => {
        if (now - cacheEntry.lastUsed > PROXY_CACHE_TTL) {
            Logger.log(`Cleaning up stale VNC proxy cache for instance ${instanceId}`);
            cacheEntry.proxy.close();
            delete vncProxyCache[instanceId];
        }
    });
}

/**
 * Initialize the cleanup interval if it hasn't been initialized yet.
 * This function is idempotent and can be called multiple times safely.
 */
export function initializeProxyCacheCleanup() {
    if (!cleanupIntervalId) {
        cleanupIntervalId = setInterval(cleanupProxyCaches, 30 * 60 * 1000);
        Logger.log('Proxy cache cleanup interval initialized');

        // Make sure we clear the interval when the process exits
        process.once('SIGTERM', stopProxyCacheCleanup);
        process.once('SIGINT', stopProxyCacheCleanup);
    }
}

/**
 * Stop the cleanup interval explicitly if needed
 */
export function stopProxyCacheCleanup() {
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
        Logger.log('Proxy cache cleanup interval stopped');

        // Close all active proxies
        Object.entries(proxyCache).forEach(([instanceId, entry]) => {
            entry.proxy.close();
            Logger.log(`Closed Jupyter proxy for ${instanceId} on shutdown`);
        });

        Object.entries(vncProxyCache).forEach(([instanceId, entry]) => {
            entry.proxy.close();
            Logger.log(`Closed VNC proxy for ${instanceId} on shutdown`);
        });
    }
}

// Helper functions to update cache entries with current timestamp
function updateProxyCache(instanceId: string, proxy: httpProxy, ip: string, port: number) {
    proxyCache[instanceId] = { proxy, ip, port, lastUsed: Date.now() };
}

function updateVncProxyCache(instanceId: string, proxy: httpProxy, ip: string, port: number) {
    vncProxyCache[instanceId] = { proxy, ip, port, lastUsed: Date.now() };
}

// Verify if the user has access to the specified instance
async function verifyInstanceAccess(instance_id: string, user_id: string | undefined, instanceCore: InstanceCore): Promise<boolean> {
    if (!user_id) {
        return false;
    }

    try {
        // Get the instance information from the database
        const instance = await instanceCore.getInstanceById(instance_id);

        // Verify that the requesting user owns this instance
        if (instance.userId !== user_id) {
            Logger.warn(`User ${user_id} attempted to access instance ${instance_id} owned by ${instance.userId}`);
            return false;
        }

        return true;
    } catch (error) {
        Logger.error(`Error verifying instance ownership: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

// Replace the existing getInstanceTarget function
const getInstanceTarget = async (instance_id: string, instanceCore: InstanceCore, user_id?: string | undefined) => {
    // Get the instance information from the database
    const instance = await instanceCore.getInstanceById(instance_id);

    if (!instance) {
        throw new Error('Failed to retrieve instance');
    }

    // If we have both hostIp and hostMapPort, use those directly
    if (instance.lxdState?.hostIp && instance.hostMapPort) {

        return {
            ip: instance.lxdState.hostIp,
            port: instance.hostMapPort
        };
    }



    // Fall back to the previous approach if no host IP or mapped port is available
    const containerIP = await instanceCore.getContainerIP(instance_id, user_id);
    if (!containerIP || !containerIP.ip) {
        throw new Error('Failed to retrieve container IP');
    }

    return {
        ip: containerIP.ip,
        port: containerIP.port || 8888
    };
};

// Middleware to handle HTTP and WebSocket proxying for Jupyter instances
export const jupyterProxyMiddleware = async (req: Request & { user?: { id: string } }, res: Response, next: NextFunction, instanceCore: InstanceCore) => {

    const instance_id = req.params['instance_id'];

    if (!instance_id) {
        if (!res.headersSent) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Instance not found');
        }
        return;
    }

    // Verify instance ownership
    const hasAccess = await verifyInstanceAccess(instance_id, req.user?.id, instanceCore);
    if (!hasAccess) {
        if (!res.headersSent) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Access denied');
        }
        return;
    }

    try {
        // Retrieve the instance-specific target if not already cached
        if (!proxyCache[instance_id]) {
            const { ip, port } = await getInstanceTarget(instance_id, instanceCore, req.user?.id);
            if (!ip) {
                throw new Error(`Could not determine IP for instance ${instance_id}`);
            }

            const target = `http://${ip}:${port}`;
            Logger.log(`Creating new proxy for instance ${instance_id} to ${target}`);

            // Create proxy instance
            const proxy = httpProxy.createProxyServer({
                target,
                xfwd: true,
                autoRewrite: true,
                changeOrigin: true
            });

            // Add event listeners (same as before)
            proxy.on('proxyReq', (proxyReq: http.ClientRequest, req: http.IncomingMessage & { body?: unknown }) => {
                if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
                    return;
                }

                const instancePrefix = `/jupyter/${instance_id}`;
                proxyReq.path = (req.url || '').startsWith(instancePrefix)
                    ? (req.url || '')
                    : `${instancePrefix}${req.url || ''}`;

                // Set the request headers
                proxyReq.setHeader('Host', `${ip}:${port}`);
                proxyReq.setHeader('Origin', `http://${ip}:${port}`);

                if (req.body && Object.keys(req.body).length) {
                    const contentType = proxyReq.getHeader('Content-Type');

                    const writeBody = (bodyData: string) => {
                        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                        proxyReq.write(bodyData);
                        proxyReq.end();
                    };

                    if (contentType === 'application/json') {
                        writeBody(JSON.stringify(req.body));
                    } else if (contentType === 'application/x-www-form-urlencoded') {
                        writeBody(qs.stringify(req.body));
                    }
                }
            });

            proxy.on('error', (err: Error, req: http.IncomingMessage, res: http.ServerResponse | net.Socket, target?: string | url.UrlObject) => {
                Logger.error(`Proxy error for target ${JSON.stringify(target)}: error ${err.message}`);

                if (res instanceof http.ServerResponse && !res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Proxy Error');
                } else if (res instanceof net.Socket) {
                    res.end('Proxy Error');
                }
            });

            // Store in cache with timestamp using helper function
            updateProxyCache(instance_id, proxy, ip, port);

            // Make sure cleanup is initialized
            initializeProxyCacheCleanup();
        } else {
            // Update the lastUsed timestamp
            proxyCache[instance_id].lastUsed = Date.now();
        }

        // Handle the request
        proxyCache[instance_id].proxy.web(req, res);
        return; // Add explicit return for consistency with vncProxyMiddleware
    } catch (error) {
        Logger.error(`Jupyter proxy error: ${JSON.stringify(error)}`);
        if (!res.headersSent) {
            res.status(500).send('Proxy setup error occurred. Please contact an administrator.');
        }
        next(error); // Consider if you want to call next with the error or just return
    }

};


export const vncProxyMiddleware = async (
    req: Request & { user?: { id: string } },
    res: Response,
    next: NextFunction,
    instanceCore: InstanceCore
) => {
    const instance_id = req.params['instance_id'];

    if (!instance_id) {
        if (!res.headersSent) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Instance not found');
        }
        return;
    }

    // Verify instance ownership
    const hasAccess = await verifyInstanceAccess(instance_id, req.user?.id, instanceCore);
    if (!hasAccess) {
        if (!res.headersSent) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Access denied: You do not have permission to access this instance');
        }
        return;
    }

    try {
        // Get or create proxy instance
        if (!vncProxyCache[instance_id]) {
            const { ip, port } = await getInstanceTarget(instance_id, instanceCore, req.user?.id);
            if (!ip) {
                throw new Error(`Could not determine IP for instance ${instance_id}`);
            }

            const target = `http://${ip}:${port}`;
            Logger.log(`Creating new VNC proxy for instance ${instance_id} to ${target}`);

            const proxy = httpProxy.createProxyServer({
                target: target,
                xfwd: true,
                autoRewrite: true,
                changeOrigin: true,
                secure: false
            });

            // Add event listeners (same as before)
            proxy.on('proxyReq', (proxyReq: http.ClientRequest, req: http.IncomingMessage & { body?: unknown }) => {
                const originalUrl = req.url || '';
                const instancePrefix = `/matlab/${instance_id}`;

                // If `originalUrl` is missing that prefix, add it
                if (!originalUrl.startsWith(instancePrefix)) {
                    proxyReq.path = `${instancePrefix}${originalUrl}`;
                } else {
                    proxyReq.path = originalUrl;
                }

                // Set the request headers
                proxyReq.setHeader('Host', `${ip}:${port}`);
                proxyReq.setHeader('Origin', `http://${ip}:${port}`);

                if (req.body && Object.keys(req.body).length) {
                    const contentType = proxyReq.getHeader('Content-Type');

                    const writeBody = (bodyData: string) => {
                        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                        proxyReq.write(bodyData);
                        proxyReq.end();
                    };

                    if (contentType === 'application/json') {
                        writeBody(JSON.stringify(req.body));
                    } else if (contentType === 'application/x-www-form-urlencoded') {
                        writeBody(qs.stringify(req.body));
                    }
                }
            });

            proxy.on('error', (err: Error) => {
                Logger.error(`VNC Proxy error: ${err.message}`);
                if (!res.headersSent) {
                    res.status(502).send('VNC Proxy Error');
                }
            });

            // Store with timestamp using helper function
            updateVncProxyCache(instance_id, proxy, ip, port);

            // Make sure cleanup is initialized
            initializeProxyCacheCleanup();
        } else {
            // Update timestamp on use
            vncProxyCache[instance_id].lastUsed = Date.now();
        }

        // Handle the request
        vncProxyCache[instance_id].proxy.web(req, res);
        return;
    } catch (error) {
        Logger.error(`VNC proxy error: ${error}`);
        if (!res.headersSent) {
            res.status(500).send('Proxy setup error occurred. Please contact an administrator.');
        }
        next(error);
        return;
    }
};

/**
 * Function to explicitly clear caches when instances are terminated
 */
export function clearProxyCacheForInstance(instanceId: string): void {
    if (proxyCache[instanceId]) {
        proxyCache[instanceId].proxy.close();
        delete proxyCache[instanceId];
        Logger.log(`Explicitly cleared Jupyter proxy cache for instance ${instanceId}`);
    }

    if (vncProxyCache[instanceId]) {
        vncProxyCache[instanceId].proxy.close();
        delete vncProxyCache[instanceId];
        Logger.log(`Explicitly cleared VNC proxy cache for instance ${instanceId}`);
    }
}

// WebSocket handler for VNC
export const registerVNCSocketServer = (server: WebSocketServer, instanceCore: InstanceCore) => {
    server.on('connection', (clientSocket, req) => {
        const handleConnection = async () => {
            clientSocket.pause();
            clientSocket.binaryType = 'arraybuffer';

            // Extract subprotocol from the client's WebSocket request
            const clientSubprotocol = req.headers['sec-websocket-protocol'] || '';


            let containerSocket: WebSocket | undefined;

            if (!req.url?.startsWith('/matlab')) {
                Logger.log(`error request ${req.url}`);
                clientSocket.close(4004, 'Invalid VNC path');
                return;
            }

            const instance_id = req.url.split('/')[2];
            if (!instance_id) {
                clientSocket.close(4004, 'Missing instance ID');
                return;
            }

            const clientMessageBuffers: Array<[RawData, boolean]> = [];
            const containerMessageBuffers: Array<[RawData, boolean]> = [];


            let ip = ''; // Initialize with a default value
            let port = 0; // Initialize with a default value
            try {
                const result = await getInstanceTarget(instance_id, instanceCore);

                // ip = 'localhost';
                ({ ip, port } = result);
            } catch (error) {
                Logger.error(`Failed to retrieve container IP: ${JSON.stringify(error)}`);
                clientSocket.close(4013, 'Failed to get container IP');
                return;
            }

            // const targetUrl = `ws://${ip}:8888`;
            // also need to combine the path of the original request
            const targetUrl = `ws://${ip}:${port}${req.url}`;

            const flushClientMessageBuffers = () => {
                if (containerSocket?.readyState === WebSocket.OPEN && clientMessageBuffers.length > 0) {
                    const buffer = clientMessageBuffers.shift();
                    if (buffer) {
                        const [message, isBinary] = buffer;
                        containerSocket.send(message, { binary: isBinary }, (err) => {
                            if (err) console.error('Error sending to container:', err);
                        });
                        if (clientMessageBuffers.length > 0) flushClientMessageBuffers();
                    }
                }
            };

            const flushContainerMessageBuffers = () => {
                if (clientSocket.readyState === WebSocket.OPEN && containerMessageBuffers.length > 0) {
                    const buffer = containerMessageBuffers.shift();
                    if (buffer) {
                        const [message, isBinary] = buffer;
                        clientSocket.send(message, { binary: isBinary }, (err) => {
                            if (err) console.error('Error sending to client:', err);
                        });
                        if (containerMessageBuffers.length > 0) flushContainerMessageBuffers();
                    }
                }
            };

            try {


                // Determine the protocol for the Origin header
                const originProtocol = req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';

                // Create WebSocket connection to the backend (container)
                const headers = {
                    'Sec-WebSocket-Protocol': clientSubprotocol,  // Pass client's subprotocol if provided
                    'Sec-WebSocket-Key': req.headers['sec-websocket-key'],
                    'Sec-WebSocket-Version': req.headers['sec-websocket-version'],
                    'Sec-WebSocket-Extensions': req.headers['sec-websocket-extensions'],
                    'pragma': req.headers['pragma'],
                    'cache-control': req.headers['cache-control'],
                    'upgrade': req.headers['upgrade'],
                    'connection': req.headers['connection'],
                    'Accept-Encoding': req.headers['accept-encoding'],
                    'Accept-Language': req.headers['accept-language'],
                    'User-Agent': req.headers['user-agent'],
                    'Host': `${ip}:${port}`, // Set the Host header
                    'Origin': `${originProtocol}://${ip}:${port}` // Set the Origin header
                };


                // containerSocket = new WebSocket(targetUrl, { headers });
                containerSocket = new WebSocket(targetUrl,
                    clientSubprotocol ? [clientSubprotocol] : [],
                    { headers });

                containerSocket.binaryType = 'arraybuffer';
                containerSocket.pause();

                containerSocket.setMaxListeners(20);
                clientSocket.setMaxListeners(20);

                clientSocket.on('message', (message, isBinary) => {
                    clientMessageBuffers.push([message, isBinary]);
                    flushClientMessageBuffers();
                });

                containerSocket.on('message', (message, isBinary) => {
                    containerMessageBuffers.push([message, isBinary]);
                    flushContainerMessageBuffers();
                });

                clientSocket.on('close', (code, reason) => {
                    console.log('VNC client closed:', code, reason.toString());
                    if (containerSocket?.readyState === WebSocket.OPEN) {
                        containerSocket.close(4001, `Client closed: ${code}`);
                    }
                });

                containerSocket.on('close', (code, reason) => {
                    flushContainerMessageBuffers();
                    if (clientSocket?.readyState === WebSocket.OPEN) {
                        clientSocket.close(4010, `Container closed: ${code}: ${reason}`);
                    }
                });

                containerSocket.on('error', (error) => {
                    Logger.error(`VNC container error: ${JSON.stringify(error, null, 2)}`);
                    clientSocket.close(4011, 'Container error');
                });

                clientSocket.on('error', (error) => {
                    Logger.error(`VNC client error: ${JSON.stringify(error, null, 2)}`);
                    containerSocket?.close(4012, 'Client error');
                });

                containerSocket.on('open', () => {
                    flushClientMessageBuffers();
                    containerSocket?.resume();
                    clientSocket.resume();
                });

            } catch (error) {
                Logger.error(`VNC connection error: ${error}`);
                clientSocket.close(4015, 'Failed to establish connection');
                containerSocket?.close(4015, 'Failed to establish connection');
            }
        };

        handleConnection().catch((error) => {
            Logger.error(`Error handling VNC connection: ${JSON.stringify(error)}`);
            clientSocket.close(4013, 'Connection error');
        });
    });

    server.on('error', (err) => {
        Logger.error(`VNC socket broker error: ${JSON.stringify(err)}`);
    });
};