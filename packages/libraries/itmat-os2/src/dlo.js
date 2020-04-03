const request = require('request');
const MemoryStream = require('memorystream');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const Segment = require('./segment.js');


/**
 * @class DynamicLargeObject
 * @param container {Container} Container the segment is stored into
 * @param name {String} Name of this segment
 * @param prefix {String} Prefix is a string that all segment objects have in common
 * @constructor
 */
function DynamicLargeObject(container, name, prefix = 'default') {
    //Call super constructor
    Segment.call(this, container, name);

    //Init member attributes
    this._prefix = prefix;

    //Bind private member functions
    this._generateSegmentName = DynamicLargeObject.prototype._generateSegmentName.bind(this);
    //Bind public member functions
    this.createManifest = DynamicLargeObject.prototype.createManifest.bind(this);
    this.createFromDisk = DynamicLargeObject.prototype.createFromDisk.bind(this);
    this.createFromStream = DynamicLargeObject.prototype.createFromStream.bind(this);
    this.createFromStreams = DynamicLargeObject.prototype.createFromStreams.bind(this);
    this.getContentStream = DynamicLargeObject.prototype.getContentStream.bind(this);
    this.getPrefix = DynamicLargeObject.prototype.getPrefix.bind(this);
    this.setPrefix = DynamicLargeObject.prototype.setPrefix.bind(this);
}

DynamicLargeObject.prototype = Object.create(Segment.prototype); //Inherit js Style
DynamicLargeObject.prototype.constructor = DynamicLargeObject;

//Default chunk size used across the file
//const maxChunkSize = 5368709120;
const maxChunkSize = 1024 * 1024 * 1024 - 1;

/**
 * @fn _generateSegmentName
 * @desc Generates a unique segment name within this DLO. Format is: [{prefix}/]{padded_index}_{uuidv4}
 * Where prefix is the prefix property, if defined,
 * padded_index is the index parameter left padded with up to 8 zeros
 * and uuidv4 a string generated using the uuid package.
 * @param index {Integer} The filename will begin by this index. Defaults to 0
 * @return {String} The generated segment name
 * @private
 */
DynamicLargeObject.prototype._generateSegmentName = function (index = 0) {
    let prefix = this._prefix ? this._prefix + '/' : '';
    return prefix + ('000000000' + index).slice(-9) + '_' + uuidv4();
};


/**
 * @fn createManifest
 * @desc creates or updates this DLO manifest
 * @return {Promise} Resolves to true on success, reject a js native Error otherwise
 */
DynamicLargeObject.prototype.createManifest = function () {
    let _this = this;
    return new Promise(function (resolve, reject) {
        // Create a DLO in the object storage using the container/prefix urlencoded header
        let object_manifest = encodeURIComponent(_this._container.getName());
        object_manifest += '/' + encodeURIComponent(_this._prefix);

        let options = {
            method: 'PUT',
            baseUrl: _this._container.getAccount().getStorageUrl(),
            uri: _this._container.getName() + '/' + _this._name,
            headers: {
                'X-Auth-Token': _this._container.getAccount().getToken(),
                'X-Object-Manifest': object_manifest
            }
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
 * @fn createFromDisk
 * @desc Create a dlo from a file on disk. The file gets split in segments if needed
 * @param path {String} Path of the file on the disk
 * @param chunkSize Optional maximum size of the generated segments. Default to 5Go
 * @return {Promise} Resolves to a map of segments:status on success or reject a js Error type
 */
DynamicLargeObject.prototype.createFromDisk = function (path, chunkSize = maxChunkSize) {
    let _this = this;
    if (chunkSize > maxChunkSize) //Max to maxChunkSize
        chunkSize = maxChunkSize;
    return new Promise(function (resolve, reject) {
        fs.stat(path, function (error, stats) {
            if (error) {
                reject(error);
                return;
            }

            let streams = [];
            let end = 0;

            // Generate read streams of 5Go chunks in the file
            for (let start = 0; end < (stats.size - 1); start += chunkSize) {
                end = start + chunkSize - 1;
                if (end >= stats.size)
                    end = stats.size - 1;
                streams.push(fs.createReadStream(path, { start: start, end: end }));
            }

            //Create from multiple streams
            _this.createFromStreams(streams).then(function (ok) {
                resolve(ok);
            }, function (error) {
                reject(error);
            });
        });
    });
};

/**
 * @fn createFromStreams
 * @desc Create a DLO from multiple data streams, where each stream is stored as a segment
 * The created DLO contains the concatenated content of the streams, ordered as received
 * @param streams {Array} An array of streams to get the data from, each individual stream MUST NOT exceed 5Go of content
 * @return {Promise} Resolves a map of segments:status on success or reject a js Error type
 */
DynamicLargeObject.prototype.createFromStreams = function (streams) {
    let _this = this;
    let segments = [];
    let segmentsPromises = [];

    return new Promise(function (resolve, reject) {
        // Create one segment per read stream. Generates {prefix/uuidv4} names
        for (let stream_idx = 0; stream_idx < streams.length; stream_idx++) {
            let stream = streams[stream_idx];
            let segment = new Segment(_this._container, _this._generateSegmentName(stream_idx));
            segments.push(segment);
            segmentsPromises.push(segment.createFromStream(stream));
        }
        // Asynchronous execution of all segments creation
        Promise.all(segmentsPromises).then(function (ok_array) {
            let result = {};
            segments.forEach(function (s, idx) {
                result[s.getName()] = ok_array[idx];
            });
            _this.createManifest().then(function (__unused__ok) {
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
 * @desc Overload Segment interface to create a a DLO from a single stream.
 * @see createFromStreams
 * @param stream {Readable} A stream to retrieve the content
 * @param chunkSize {Integer} Optional maximum size of the generated segments. Default and max to 1Go
 * @return {Promise} Resolves to a map of segments:status on success or reject a js Error type
 */
DynamicLargeObject.prototype.createFromStream = function (stream, chunkSize = maxChunkSize) {
    let _this = this;
    if (chunkSize > maxChunkSize) //Max to maxChunkSize
        chunkSize = maxChunkSize;
    return new Promise(function (resolve, reject) {
        let stream_process = {
            streams: [],
            stream_idx: 0,
            stream_ptr: [],
            segments: [],
            segmentsPromises: []
        };

        let pipeNewStream = function () {
            let new_stream = new MemoryStream();
            stream_process.streams.push(new_stream); //Insert current stream
            stream_process.stream_ptr = 0; //Current segment has size 0
            stream_process.stream_idx = stream_process.streams.length - 1; //Last index in the array
            let segment = new Segment(_this._container, _this._generateSegmentName(stream_process.stream_idx)); //Create segment object
            stream_process.segments.push(segment);
            stream_process.segmentsPromises.push(segment.createFromStream(new_stream)); //Start reading from new stream
        };
        let unpipeOldStream = function () {
            stream_process.streams[stream_process.stream_idx].end(); //Manually end current stream
        };

        //Start processing control stream
        pipeNewStream();

        stream.on('data', function (chunk) {
            if (Buffer.isBuffer(chunk) === false) // Forces chunk to be a Buffer object
                chunk = Buffer.from(chunk);

            stream.pause(); //Stop stream because we may stop consuming data for a moment
            if (stream_process.stream_ptr + chunk.length >= chunkSize) { // chunkSize limit reached
                let overflowedChunk = chunk.slice(chunkSize - stream_process.stream_ptr);
                let flowingChunk = chunk.slice(0, -overflowedChunk.length);

                stream_process.streams[stream_process.stream_idx].write(flowingChunk); //Write until chunkSize in current segment
                stream_process.stream_ptr += flowingChunk.length; //Increment current stream pointer
                unpipeOldStream();
                pipeNewStream();

                stream.unshift(overflowedChunk); // un-consume the stream

            } else { // Less than chunkSize
                stream_process.streams[stream_process.stream_idx].write(chunk);
                stream_process.stream_ptr += chunk.length; // Increment current stream pointer
            }
            stream.resume(); // Return to normal consume mode
        });

        stream.on('end', function () {
            unpipeOldStream();
            stream.unpipe();
            if (stream_process.stream_ptr === 0) { // The last Segment is empty, remove it
                let segment = stream_process.segments[stream_process.stream_idx];
                let creation_promise = stream_process.segmentsPromises[stream_process.segmentsPromises.length - 1];
                let deletion_promise = new Promise(function (resolve, reject) {
                    creation_promise.then(function (__unused___create_ok) {
                        segment.delete().then(function (delete_ok) {
                            stream_process.segments.pop();
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

            //Async wait for all segments
            Promise.all(stream_process.segmentsPromises).then(function (ok_array) {
                let result = {};
                stream_process.segments.forEach(function (s, idx) {
                    result[s.getName()] = ok_array[idx];
                });
                _this.createManifest().then(function (__unused__ok) {
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
 * @desc Get this DLO content or its manifest content.
 * @param manifest {Boolean} Set to true to get the manifest, false for the content. defaults to false
 * @return {Promise} Resolve to a ReadableStream on success or reject a js Error
 */
DynamicLargeObject.prototype.getContentStream = function (manifest = false) {
    let _this = this;
    const manifest_url_param = '?multipart-manifest=get';

    if (manifest === false) { // Get content from Segment implementation
        return Segment.prototype.getContentStream.call(this);
    }
    return new Promise(function (resolve, reject) {
        let options = {
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
                let stream = new MemoryStream([]);
                response.on('data', function (data) {
                    stream.write(data);
                });
                response.on('end', function () {
                    stream.end(response.headers['x-object-manifest']);
                });
                resolve(stream);
            })
            .on('error', function (error) {
                reject(error);
            });
    });
};

/**
 * @fn getPrefix
 * @desc Getter on this DLO segments prefix
 * @return {String} Assigned segments prefix
 */
DynamicLargeObject.prototype.getPrefix = function () {
    return this._prefix;
};

/**
 * @fn setPrefix
 * @desc Setter on DLO segments prefix
 * @return {String} Assigned segments prefix
 */
DynamicLargeObject.prototype.setPrefix = function (prefix) {
    this._prefix = prefix;
    return this._prefix;
};

module.exports = DynamicLargeObject;
