const request = require('request');
const fs = require('fs');
const MemoryStream = require('memorystream');

/**
 * @class Segment
 * @param container {Container} Container the segment is stored into
 * @param name {String} Name of this segment
 * @constructor
 */
function Segment(container, name) {
    //Init member attributes
    this._container = container;
    this._name = name;

    //Bind member functions
    this.createFromDisk = Segment.prototype.createFromDisk.bind(this);
    this.createFromStream = Segment.prototype.createFromStream.bind(this);
    this.delete = Segment.prototype.delete.bind(this);
    this.copy = Segment.prototype.copy.bind(this);
    this.getContentStream = Segment.prototype.getContentStream.bind(this);
    this.getMetadata = Segment.prototype.getMetadata.bind(this);
    this.setMetadata = Segment.prototype.setMetadata.bind(this);
    this.getContainer = Segment.prototype.getContainer.bind(this);
    this.setContainer = Segment.prototype.setContainer.bind(this);
    this.getName = Segment.prototype.getName.bind(this);
    this.setName = Segment.prototype.setName.bind(this);
}


/**
 * @fn createFromDisk
 * @desc Performs a creation operation for this Segment, replaces its content if already exists
 * @param filepath Absolute or relative path to the file on disk
 * @return {Promise} resolve to true on success, on error rejects with a native js Error
 */
Segment.prototype.createFromDisk = function(filepath) {
    let readStream = fs.createReadStream(filepath);

    return this.createFromStream(readStream);
};

/**
 * @fn createFromStream
 * @desc Performs a creation operation for this Segment, replaces its content if already exists
 * @param readStream Segment content in the form of a Node.js stream.Readable instance
 * @return {Promise} resolve to true on success, on error rejects with a native js Error
 */
Segment.prototype.createFromStream = function(readStream) {
    let _this = this;
    return new Promise(function(resolve, reject) {
        let options = {
            method: 'PUT',
            baseUrl: _this._container.getAccount().getStorageUrl(),
            uri: _this._container.getName() + '/' + _this._name,
            headers: {
                'X-Auth-Token': _this._container.getAccount().getToken()
            },
            body: readStream
        };
        request(options, function(error, response, __unused__body) {
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
 * @fn delete
 * @desc Delete this object form the Object Storage
 * @return {Promise} Resolve to true on success, otherwise a native js Error is rejected
 */
Segment.prototype.delete = function() {
    let _this = this;
    return new Promise(function(resolve, reject) {
        let options = {
            method: 'DELETE',
            baseUrl: _this._container.getAccount().getStorageUrl(),
            uri: _this._container.getName() + '/' + _this._name,
            headers: {
                'X-Auth-Token': _this._container.getAccount().getToken()
            }
        };
        request(options, function(error, response, __unused__body) {
            if (error) {
                reject(error);
                return;
            }
            if (response.statusCode !== 204) {
                reject(response.statusMessage);
                return;
            }
            resolve(true);
        });
    });
};

/**
 * @fn copy
 * @desc Copies this object to the destination object.
 * If the destination object is already created in the Object storage, it is replaced
 * If the source segment is a Large Object, the manifest is copied, referencing the same content.
 * @param object {Segment} Destination object
 * @return {Promise} Resolves to true on success, rejects a js native Error otherwise
 */
Segment.prototype.copy = function(object) {
    let _this = this;
    return new Promise(function(resolve, reject) {
        let heads = {
            'X-Auth-Token': _this._container.getAccount().getToken(),
            'Destination': object.getContainer().getName() + '/' + object.getName(),
            'Destination-Account': object.getContainer().getAccount().getName()
        };
        let options = {
            method: 'COPY',
            baseUrl: _this._container.getAccount().getStorageUrl(),
            uri: '/' + _this._name + '?multipart-manifest=get',
            headers: heads
        };
        request(options, function(error, response, __unused__body) {
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
 * @fn getContentStream
 * @desc Get the stored object content
 * @return {Promise} resolve to a ReadableStream on success, rejects a js Error otherwise
 */
Segment.prototype.getContentStream = function() {
    let _this = this;
    return new Promise(function(resolve, reject) {
        let options = {
            method: 'GET',
            baseUrl: _this._container.getAccount().getStorageUrl(),
            uri: _this._container.getName() + '/' + _this._name,
            headers: {
                'X-Auth-Token': _this._container.getAccount().getToken()
            }
        };
        request(options)
            .on('response', function(response) {
                if (response.statusCode !== 200) {
                    reject(new Error(response.statusMessage));
                    return;
                }

                let stream = new MemoryStream([]);
                response.on('data', function(data) {
                    stream.write(data);
                });
                response.on('end', function() {
                    stream.end();
                });
                resolve(stream);
            })
            .on('error', function(error) {
                reject(error);
            });
    });
};

/**
 * @fn getMetadata
 * @desc Get the stored metadata on this segment
 * @return {Promise} Resolves to js object where each key:value pair is one metadata entry,
 * reject to js native error otherwise
 */
Segment.prototype.getMetadata = function() {
    let _this = this;
    return new Promise(function(resolve, reject) {
        if (_this._container.getAccount().isConnected() === false) {
            reject(new Error('Segment needs a connected  container/account'));
            return;
        }
        let options = {
            method: 'HEAD',
            baseUrl: _this._container.getAccount().getStorageUrl(),
            uri: _this._container.getName() + '/' + _this._name,
            headers: {
                'X-Auth-Token': _this._container.getAccount().getToken()
            }
        };
        request(options, function(error, response, __unused__body) {
            if (error) {
                reject(error);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(response.statusMessage));
                return;
            }

            let metas = {};
            for (let m in response.headers) {
                if (m.toLowerCase().includes('x-object-meta-')) { // Add to metas
                    let meta_name = m.substr(14);
                    metas[meta_name] = response.headers[m];
                }
            }
            resolve(metas);
        });
    });
};

/**
 * @fn setMetadata
 * @desc Sets some metadata on this object, connected state is required
 * @param metadata Plain js object, each key:value is a metadata field
 * @return {Promise} resolves to true on success, on error rejects a native js Error
 */
Segment.prototype.setMetadata = function(metadata) {
    let _this = this;
    return new Promise(function(resolve, reject) {
        if (_this._container.getAccount().isConnected() === false) {
            reject(new Error('Segment needs a connected  container/account'));
            return;
        }

        let metas = {};
        for (let m in metadata) {
            let meta_name = 'X-Object-Meta-' + m;
            metas[meta_name] = metadata[m];
        }
        let heads = Object.assign({}, {
            'X-Auth-Token': _this._container.getAccount().getToken()
        }, metas);
        let options = {
            method: 'POST',
            baseUrl: _this._container.getAccount().getStorageUrl(),
            uri: _this._container.getName() + '/' + _this._name,
            headers: heads
        };

        request(options, function(error, response, __unused__body) {
            if (error) {
                reject(error);
                return;
            }
            if (response.statusCode !== 202) {
                reject(new Error(response.statusMessage));
                return;
            }
            resolve(true);
        });
    });
};
/**
 * @fn getName
 * @desc Getter on name member
 * @return {String} Segment name
 */
Segment.prototype.getName = function() {
    return this._name;
};

/**
 * @fn setName
 * @param name {String} New value for object name
 * @return {String} Assigned value for name member
 */
Segment.prototype.setName = function(name) {
    this.name = name;
    return this._name;
};

/**
 * @fn getContainer
 * @desc Getter on container member
 * @return {Container} Container member value
 */
Segment.prototype.getContainer = function() {
    return this._container;
};

/**
 * @fn setContainer
 * @param container New container
 * @return {Container} Assigned container value
 */
Segment.prototype.setContainer = function(container) {
    this._container = container;
    return this._container;
};

module.exports = Segment;