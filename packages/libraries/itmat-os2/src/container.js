const request = require('request');

/**
 * @class Container
 * @param account {Account} Account the container belongs to. SHOULD be in a connected state
 * @param name {String} container name or identifier
 * @constructor
 */
function Container(account, name) {
    //Init member attributes
    this._name = name;
    this._account = account;

    //Bind member functions
    this.create = Container.prototype.create.bind(this);
    this.delete = Container.prototype.delete.bind(this);
    this.setMetadata = Container.prototype.setMetadata.bind(this);
    this.getMetadata = Container.prototype.getMetadata.bind(this);
    this.listObjects = Container.prototype.listObjects.bind(this);
    this.setAccount = Container.prototype.setAccount.bind(this);
    this.getAccount = Container.prototype.getAccount.bind(this);
    this.setName = Container.prototype.setName.bind(this);
    this.getName = Container.prototype.getName.bind(this);
}

/**
 * @fn create
 * @desc Creates/updates container instance in object storage
 * @return {Promise} Resolves to object storage response on success, on error rejects a native js Error
 */
Container.prototype.create = function() {
    let _this = this;
    return new Promise(function(resolve, reject) {
        if (_this._account.isConnected() === false) {
            reject(new Error('Container needs a connect account'));
            return;
        }
        let options = {
            method: 'PUT',
            baseUrl: _this._account.getStorageUrl(),
            uri: '/' + _this._name,
            headers: {
                'X-Auth-Token': _this._account.getToken()
            }
        };
        request(options, function(error, response, body) {
            if (error) {
                reject(error);
                return;
            }
            if (response.statusCode === 204) {
                reject(new Error(response.statusMessage));
                return;
            }
            resolve(body);
        });
    });
};

/**
 * @fn delete
 * @desc Delete container instance in object storage
 * @return {Promise} Resolves to object storage response on success, on error rejects a native js Error
 */
Container.prototype.delete = function() {
    let _this = this;
    return new Promise(function(resolve, reject) {
        if (_this._account.isConnected() === false) {
            reject(new Error('Container needs a connect account'));
            return;
        }
        let options = {
            method: 'DELETE',
            baseUrl: _this._account.getStorageUrl(),
            uri: '/' + _this._name,
            headers: {
                'X-Auth-Token': _this._account.getToken()
            }
        };
        request(options, function(error, response, __unused__body) {
            if (error) {
                reject(error);
                return;
            }
            if (response.statusCode === 404 || response.statusCode === 409) {
                reject(new Error(response.statusMessage));
                return;
            }
            resolve(true);
        });
    });
};

/**
 * @fn setMetadata
 * @desc Sets some metadata on this container, connected state is required
 * @param metadata Plain js object, each key:value is a metadata field
 * @return {Promise} resolves to true on success, on error rejects a native js Error
 */
Container.prototype.setMetadata = function(metadata) {
    let _this = this;
    return new Promise(function(resolve, reject) {
        if (_this._account.isConnected() === false) {
            reject(new Error('Container needs a connect account'));
            return;
        }

        let metas = {};
        for (let m in metadata) {
            let meta_name = 'X-Container-Meta-' + m;
            metas[meta_name] = metadata[m];
        }
        let heads = Object.assign({}, {
                'X-Auth-Token': _this._account.getToken()
            }, metas);
        let options = {
            method: 'POST',
            baseUrl: _this._account.getStorageUrl(),
            uri: '/' + _this._name,
            headers: heads
        };

        request(options, function(error, response, __unused__body) {
            if (error) {
                reject(error);
                return;
            }
            if (response.statusCode !== 204) {
                reject(new Error(response.statusMessage));
                return;
            }
            resolve(true);
        });
    });
};

/**
 * @fn getMetadata
 * @desc Retrieve stored metadata for this container
 * @return {Promise} resolve to a json object containing the metadata or rejects a js Error
 */
Container.prototype.getMetadata = function() {
    let _this = this;
    return new Promise(function(resolve, reject) {
        if (_this._account.isConnected() === false) {
            reject(new Error('Container needs a connect account'));
            return;
        }
        let options = {
            method: 'HEAD',
            baseUrl: _this._account.getStorageUrl(),
            uri: '/' + _this._name,
            headers: {
                'X-Auth-Token': _this._account.getToken()
            }
        };
        request(options, function(error, response, __unused__body) {
            if (error) {
                reject(error);
                return;
            }
            if (response.statusCode !== 204) {
                reject(new Error(response.statusMessage));
                return;
            }

            let metas = {};
            for (let m in response.headers) {
                if (m.toLowerCase().includes('x-container-meta-')) {//Add to metas
                    let meta_name = m.substr(17);
                    metas[meta_name] = response.headers[m];
                }
            }
            resolve(metas);
        });
    });
};

/**
 * @fn listObjects
 * @desc Get details and objects list for this container
 * @return {Promise} Resolves to json content of the container, rejects to native js error
 */
Container.prototype.listObjects = function() {
    let _this = this;
    return new Promise(function(resolve, reject) {
        if (_this._account.isConnected() === false) {
            reject(new Error('Container needs a connect account'));
            return;
        }
        let options = {
            method: 'GET',
            baseUrl: _this._account.getStorageUrl(),
            uri: '/' + _this._name,
            json: true,
            headers: {
                'X-Auth-Token': _this._account.getToken()
            }
        };
        request(options, function(error, response, body) {
            if (error) {
                reject(error);
                return;
            }
            if (response.statusCode !== 200 && response.statusCode !== 204) {
                reject(new Error(response.statusMessage));
                return;
            }
            resolve(body);
        });
    });
};

/**
 * @fn setAccount
 * @param account {Account} New value for account member
 * @return {Account} Assigned account member value
 */
Container.prototype.setAccount = function(account) {
    this._account = account;
    return this._account;
};

/**
 * @fn getAccount
 * @desc Getter on account member
 * @return {Account}
 */
Container.prototype.getAccount = function() {
    return this._account;
};

/**
 * @fn setName
 * @desc Setter for name member
 * @param name {String} New value for name member
 * @return {String} Assigned  member value
 */
Container.prototype.setName = function(name) {
    this._name = name;
    return this._name;
};

/**
 * @fn getName
 * @desc Getter on container member name
 * @return {String} Container name
 */
Container.prototype.getName = function() {
    return this._name;
};

module.exports = Container;