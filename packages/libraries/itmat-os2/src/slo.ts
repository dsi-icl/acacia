import request from 'request';
import MemoryStream from 'memorystream';
import DynamicLargeObject from './dlo';
import Segment from './segment';
import { Container } from './container';

type Manifest = {
    path: string;
}

/**
 * @class StaticLargeObject
 * @param container {Container} Container the segment is stored into
 * @param name {String} Name of this segment
 * @constructor
 */
export class StaticLargeObject extends DynamicLargeObject {
    constructor(container: Container, name: string) {
        //Call super constructor
        super(container, name, '');

    }

    //Default chunk size used across the file
    //const maxChunkSize = 5368709120;
    maxChunkSize = 1024 * 1024 * 1024 - 1;

    /**
     * @fn createManifest
     * @desc creates or updates this SLO manifest
     * @param manifestContent {Array<Manifest>} json list, where each element is an object representing a segment.
     * These objects may contain the following attributes:
     * path (required). The container and object name in the format: {container-name}/{object-name}
     * etag (optional). If provided, this value must match the ETag of the segment object. This was included in the response headers when the segment was created. Generally, this will be the MD5 sum of the segment.
     * size_bytes (optional). The size of the segment object. If provided, this value must match the Content-Length of that object.
     * range (optional). The subset of the referenced object that should be used for segment data. This behaves similar to the Range header. If omitted, the entire object will be used.
     * Providing the optional etag and size_bytes attributes for each segment ensures that the upload cannot corrupt your data.
     * @return {Promise} Resolves to true on success, reject a js native Error otherwise
     */
    createManifest = (manifestContent: Manifest[] | null = null): Promise<true | Error> => {
        const _this = this;
        const manifest_url_param = '?multipart-manifest=put';

        return new Promise(function (resolve, reject) {
            if (manifestContent === undefined || manifestContent === null) {
                reject(new Error('Create StaticLargeObject needs a manifest body'));
                return;
            }
            const options = {
                method: 'PUT',
                baseUrl: _this._container.getAccount().getStorageUrl(),
                uri: _this._container.getName() + '/' + _this._name + manifest_url_param,
                json: true,
                headers: {
                    'X-Auth-Token': _this._container.getAccount().getToken()
                },
                body: manifestContent
            };
            request(options, function (error, response, __unused__body) {
                if (error) {
                    reject(error);
                    return;
                }
                if (response.statusCode !== 201) {
                    reject(new Error(response.statusMessage));
                    return;
                }
                resolve(true);
            });
        });
    };

    /**
     * @fn createFromStreams
     * @desc Create a SLO from multiple data streams, where each stream is stored as a segment
     * The created SLO contains the concatenated content of the streams, ordered as received
     * @param streams {Array} An array of streams to get the data from
     * @return {Promise} Resolves a map of segments:status on success or reject a js Error type
     */
    createFromStreams = (streams): Promise<any | Error> => {
        const _this = this;
        const segments: Segment[] = [];
        const segmentsPromises: Promise<true | Error>[] = [];
        const manifest: Manifest[] = [];
        return new Promise(function (resolve, reject) {
            // Create one segment per read stream. Generates {prefix/uuidv4} names
            for (let stream_idx = 0; stream_idx < streams.length; stream_idx++) {
                const stream = streams[stream_idx];
                const segment_name = _this._generateSegmentName(stream_idx);
                const segment = new Segment(_this._container, segment_name);
                segments.push(segment);
                segmentsPromises.push(segment.createFromStream(stream));
                manifest.push({
                    path: _this._container.getName() + '/' + segment_name
                });
            }
            // Asynchronous execution of all segments creation
            Promise.all(segmentsPromises).then(function (ok_array) {
                const result = {};
                segments.forEach(function (s, idx) {
                    result[s.getName()] = ok_array[idx];
                });
                _this.createManifest(manifest).then(function (__unused__ok) {
                    resolve(result);
                }, function (error) {
                    reject(error);
                });
            }, function (error) {
                reject(error);
            });
        });
    };

    /**
     * @fn createFromStream
     * @desc Overload Segment interface to create a a SLO from a single stream.
     * @see createFromStreams
     * @param stream {Readable} A stream to retrieve the content
     * @param chunkSize {Integer} Optional maximum size of the generated segments. Default and max to 1Go
     * @return {Promise} Resolves to a map of segments:status on success or reject a js Error type
     */
    createFromStream = (stream, chunkSize = this.maxChunkSize): Promise<any | Error> => {
        const _this = this;
        if (chunkSize > this.maxChunkSize) //Max to maxChunkSize
            chunkSize = this.maxChunkSize;
        return new Promise(function (resolve, reject) {
            const stream_process: {
                streams: MemoryStream[];
                stream_idx: number;
                stream_ptr: number;
                segments: Segment[];
                segmentsPromises: Promise<true | Error>[];
            } = {
                streams: [],
                stream_idx: 0,
                stream_ptr: 0,
                segments: [],
                segmentsPromises: []
            };
            //let dbg = [];
            const manifest: Manifest[] = [];

            const pipeNewStream = (): void => {
                const new_stream = new MemoryStream();
                stream_process.streams.push(new_stream); //Insert current stream
                stream_process.stream_ptr = 0; //Current segment has size 0
                stream_process.stream_idx = stream_process.streams.length - 1; //Last index in the array
                const segment = new Segment(_this._container, _this._generateSegmentName(stream_process.stream_idx)); //Create segment object
                stream_process.segments.push(segment);
                manifest.push({
                    path: _this._container.getName() + '/' + segment.getName()
                });
                stream_process.segmentsPromises.push(segment.createFromStream(new_stream)); //Start reading from new stream
            };
            const unpipeOldStream = (): void => {
                stream_process.streams[stream_process.stream_idx].end(); //Manually end current stream
            };

            //Start processing control stream
            pipeNewStream();

            stream.on('data', function (chunk) {
                if (Buffer.isBuffer(chunk) === false) // Forces chunk to be a Buffer object
                    chunk = Buffer.from(chunk);

                stream.pause(); //Stop stream because we may stop consuming data for a moment
                if (stream_process.stream_ptr + chunk.length >= chunkSize) { // chunkSize limit reached
                    const overflowedChunk = chunk.slice(chunkSize - stream_process.stream_ptr);
                    const flowingChunk = chunk.slice(0, -overflowedChunk.length);

                    stream_process.streams[stream_process.stream_idx].write(flowingChunk); //Write until chunkSize in current segment
                    stream_process.stream_ptr += flowingChunk.length; //Increment current stream pointer
                    // dbg.push({ type : 'overflow', recvSize: chunk.length, flowingSize: flowingChunk.length, overFlowSize: overflowedChunk.length, streamIndex: stream_process.stream_idx, stream_ptr: stream_process.stream_ptr});
                    unpipeOldStream();
                    pipeNewStream();

                    stream.unshift(overflowedChunk); // un-consume the stream

                } else { // Less than chunkSize
                    stream_process.streams[stream_process.stream_idx].write(chunk);
                    stream_process.stream_ptr += chunk.length; // Increment current stream pointer
                    // dbg.push({ type : 'less', recvSize: chunk.length, flowingSize: chunk.length, overFlowSize: 0,  streamIndex: stream_process.stream_idx, stream_ptr: stream_process.stream_ptr});
                }
                stream.resume(); // Return to normal consume mode
            });

            stream.on('end', function () {
                unpipeOldStream();
                stream.unpipe();
                if (stream_process.stream_ptr === 0) { // The last Segment is empty, remove it
                    const segment = stream_process.segments[stream_process.stream_idx];
                    const creation_promise = stream_process.segmentsPromises[stream_process.segmentsPromises.length - 1];
                    const deletion_promise = new Promise<true | Error>(function (resolve, reject) {
                        creation_promise.then(function (__unused___create_ok) {
                            segment.delete().then(function (delete_ok) {
                                stream_process.segments.pop();
                                manifest.pop();
                                resolve(delete_ok);

                            }, function (error) {
                                reject(error);
                            });
                        }, function (error) {
                            reject(error);
                        });
                    });
                    stream_process.segmentsPromises.push(deletion_promise);
                }


                // Async wait for all segments
                Promise.all(stream_process.segmentsPromises).then(function (ok_array) {
                    const result = {};
                    stream_process.segments.forEach(function (s, idx) {
                        result[s.getName()] = ok_array[idx];
                    });
                    // reject(JSON.stringify(dbg, null, 2));
                    _this.createManifest(manifest).then(function (__unused__ok) {
                        resolve(result);
                    }, function (error) {
                        reject(error);
                    });
                }, function (error) {
                    reject(error);
                });
            });

            stream.on('error', function (error) {
                reject(error);
            });
        });
    };

    /**
     * @fn getContentStream
     * @desc Get this SLO content or its manifest content.
     * @param manifest {Boolean} Set to true to get the manifest, false for the content. defaults to false
     * @return {Promise} Resolve to a NodeJS.ReadableStream on success or reject a js Error
     */
    getContentStream = (manifest = false): Promise<NodeJS.ReadableStream | Error> => {
        const _this = this;
        const manifest_url_param = '?multipart-manifest=get';

        if (manifest === false) { // Get content from DLO implementation
            return Segment.prototype.getContentStream.call(this);
        }
        return new Promise(function (resolve, reject) {
            const options = {
                method: 'GET',
                baseUrl: _this._container.getAccount().getStorageUrl(),
                uri: _this._container.getName() + '/' + _this._name + manifest_url_param,
                headers: {
                    'X-Auth-Token': _this._container.getAccount().getToken()
                }
            };
            request(options)
                .on('response', function (response) {
                    if (response.statusCode !== 200) {
                        reject(new Error(response.statusMessage));
                        return;
                    }
                    const stream = new MemoryStream([]);
                    response.on('data', function (data) {
                        stream.write(data);
                    });
                    response.on('end', function () {
                        stream.end();
                    });
                    resolve(stream);
                })
                .on('error', function (error) {
                    reject(error);
                });
        });
    };

    /**
     * @fn deleteWithContent
     * @desc Delete this static large object and its segments
     * @return {Promise} Resolves to true on success, rejects a Native Js Error on error
     */
    deleteWithContent = (): Promise<true | Error> => {
        const _this = this;
        const manifest_url_param = '?multipart-manifest=delete';

        return new Promise(function (resolve, reject) {
            const options = {
                method: 'DELETE',
                baseUrl: _this._container.getAccount().getStorageUrl(),
                uri: _this._container.getName() + '/' + _this._name + manifest_url_param,
                headers: {
                    'X-Auth-Token': _this._container.getAccount().getToken()
                }
            };
            request(options, function (error, response, __unused__body) {
                if (error) {
                    reject(error);
                    return;
                }
                if (response.statusCode !== 200) {
                    reject(response.statusMessage);
                    return;
                }
                resolve(true);
            });
        });
    };
}

export default StaticLargeObject;
