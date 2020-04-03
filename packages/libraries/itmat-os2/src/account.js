const request = require('request');
const Store = require('./store.js');

/**
 * @class Account
 * @param store {Store} A store instance this account belongs to
 * @param username {String} This account's username
 * @param password {String} This account password
 * @param storage_url {String} Exposed Object storage URL for this account
 * @param token {String} Authentication token for this account
 * @constructor
 */
function Account(store = null, username = null, password = null, storage_url = null, token = null) {
    //Init member attributes
    this._name = null;
    this._store = store;
    this._username = username;
    this._password = password;
    this._isAuth = false;
    this._storage_url = storage_url;
    this._storage_token = token;

    //Bind member functions
    this.connect = Account.prototype.connect.bind(this);
    this.disconnect = Account.prototype.disconnect.bind(this);
    this.listContainers = Account.prototype.listContainers.bind(this);
    this.getMetadata = Account.prototype.getMetadata.bind(this);
    this.setMetadata = Account.prototype.setMetadata.bind(this);
    this.isConnected = Account.prototype.isConnected.bind(this);
    this.getStore = Account.prototype.getStore.bind(this);
    this.setStore = Account.prototype.setStore.bind(this);
    this.getUsername = Account.prototype.getUsername.bind(this);
    this.setUsername = Account.prototype.setUsername.bind(this);
    this.getPassword = Account.prototype.getPassword.bind(this);
    this.setPassword = Account.prototype.setPassword.bind(this);
    this.getToken = Account.prototype.getToken.bind(this);
    this.getStorageUrl = Account.prototype.getStorageUrl.bind(this);
    this.getName = Account.prototype.getName.bind(this);
}

/**
 * @fn fromUsernameAndPassword
 * @desc Alternative constructor
 * @static
 * @param storeUrl {String} An OpenStack Object Storage URL
 * @param username {String} Account username
 * @param password {String} Account password
 * @return {Account}
 */
Account.fromUsernameAndPassword = function(storeUrl, username, password) {
    let store = new Store(storeUrl);
    return new Account(store, username, password);
};

/**
 * @fn fromNameAndToken
 * @desc Alternative constructor
 * @static
 * @param storeUrl {String} An OpenStack Object Storage URL
 * @param name {String} Account name
 * @param token {String} Authentication token
 * @return {Account}
 */
Account.fromNameAndToken = function(storeUrl, name, token) {
    let store = new Store(storeUrl);
    let account = new Account(store, null, null, storeUrl + '/v1/' + name, token);
    account._isAuth = true;
    account._name = name;
    return account;
};

/**
 * @fn connect
 * @desc Performs this account connection with the Store
 * Uses the /auth/v1.0 authentication mechanism of swift object storage
 * @return {Promise} Resolves to true on success or rejects a native js Error on failure
 */
Account.prototype.connect = function() {
    let _this = this;

    return new Promise(function(resolve, reject) {
        let options = {
            method: 'GET',
            uri: _this._store.getURL() + '/auth/v1.0/',
            headers: {
                'X-Auth-User': _this._username,
                'X-Auth-Key': _this._password
            }
        };
        request(options, function(error, response, __unused__body) {
            if (error) {
                reject(error);
                return;
            }
            if ([200, 204].indexOf(response.statusCode) < 0) {
                reject(new Error(response.statusMessage));
                return;
            }

            if (response.headers.hasOwnProperty('x-storage-token') === false ||
                response.headers.hasOwnProperty('x-storage-url') === false) {
                reject(new Error('Connected but failed to get a token'));
                return;
            }

            _this._isAuth = true;
            _this._storage_token = response.headers['x-storage-token'];
            _this._storage_url = response.headers['x-storage-url'];
            _this._name = _this._storage_url.substr(_this._storage_url.lastIndexOf('/'));
            resolve(true);
        });
    });
};

/**
 * @fn disconnect
 * @desc Disconnects this account from the store
 * @return {Promise} Always resolves to true
 */
Account.prototype.disconnect = function() {
    let _this = this;
    return new Promise(function(resolve, __unused__reject) {
        _this._isAuth = false;
        _this._storage_token = null;
        _this._storage_url = null;
        resolve(true);
    });
};

/**
 * @fn listContainers
 * @desc List all the containers in this account
 * @return {Promise} Resolves to a json array of containers no success, rejects a native JS Error otherwise
 */
Account.prototype.listContainers = function() {
    let _this = this;

    return new Promise(function(resolve, reject) {
        if (_this._isAuth === false) {
            reject(new Error('Account must be connected first'));
            return;
        }

        let options = {
            method: 'GET',
            uri: _this._storage_url,
            headers: {
                'X-Auth-Token': _this._storage_token
            }
        };
        request(options, function(error, __unused__response, body) {
            if (error) {
                reject(error);
                return;
            }
            resolve(body);
        });
    });
};

/**
 * @fn getMetadata
 * @desc Retrieve stored metadata for this account, MUST be connected
 * @return {Promise} Resolves to an object containing all the metadata on success, reject to native js Error otherwise
 */
Account.prototype.getMetadata = function() {
    let _this = this;

    return new Promise(function(resolve, reject) {
        if (_this._isAuth === false) {
            reject(new Error('Account must be connected first'));
            return;
        }

        let options = {
            method: 'HEAD',
            uri: _this._storage_url,
            headers: {
                'X-Auth-Token': _this._storage_token
            }
        };
        request.head(options, function(error, response, __unused__body) {
            if (error) {
                reject(error);
                return;
            }
            if ([200, 204].indexOf(response.statusCode) < 0) {
                reject(new Error(response.statusMessage));
                return;
            }

            let metas = {};
            for (let m in response.headers) {
                if (m.includes('x-account-meta-')) {//Add to metas
                    let meta_name = m.substr(15);
                    metas[meta_name] = response.headers[m];
                }
            }
            resolve(metas);
        });
    });
};

/**
 * @fn setMetadata
 * @desc Update metadata for this account. MUST be connected.
 * Omitted metadata items are unchanged, metadata items with null or undefined are removed
 * @param metadata Plain JS object, each attribute is considered to be metadata item
 * @return {Promise} Resolves to true on success, rejects with a native js Error on failure
 */
Account.prototype.setMetadata = function(metadata = {}) {
    let _this = this;

    return new Promise(function(resolve, reject) {
        if (_this._isAuth === false) {
            reject(new Error('Account must be connected first'));
            return;
        }
        var metas = {};
        for (let m in metadata) {
            var meta_name = 'X-Account-Meta-' + m;
            metas[meta_name] = metadata[m];
        }

        let heads = Object.assign({}, {
                'X-Auth-Token': _this._storage_token
            },
            metas);
        let options = {
            method: 'POST',
            uri: _this._storage_url,
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
 * @fn isConnected
 * @return {boolean} True if the account is connected
 */
Account.prototype.isConnected = function() {
    return this._isAuth;
};

/**
 * @fn getStore
 * @desc Getter on store member
 * @return {Store} Current store
 */
Account.prototype.getStore = function() {
    return this._store;
};

/**
 * @fn setStore
 * @desc Setter on store member, disconnects from previous store if any
 * @param store {Store} New store member value
 * @return {Store} Assigned store member value
 */
Account.prototype.setStore = function setStore(store) {
    let _this = this;
    this.disconnect().then(function() {
        _this._store = store;
    });
    return store;
};

/**
 * @fn getUsername
 * @desc Getter on username member var
 * @return {String} The username
 */
Account.prototype.getUsername = function() {
    return this._username;
};

/**
 * @fn setUsername
 * @desc Setter for account username, disconnects from previous store if any
 * @param username {String} The new value for username member
 * @return {String} The new value assigned to username
 */
Account.prototype.setUsername = function (username) {
    let _this = this;
    this.disconnect().then(function() {
        _this._username = username;
    });
    return username;
};

/**
 * @fn getPassword
 * @desc Getter on password member var
 * @return {String} The password
 */
Account.prototype.getPassword = function() {
    return this._password;
};

/**
 * @fn setPassword
 * @desc Setter for account password, disconnects from previous store if any
 * @param pass {String} The new value for password member
 * @return {String} The new value assigned to password
 */
Account.prototype.setPassword = function setPassword(pass) {
    let _this = this;
    this.disconnect().then(function() {
        _this._password = pass;
    });
    return pass;
};

/**
 * @fn getToken
 * @desc Get account authentication token
 * @return {String|null} Return the token if the account is connected, null otherwise
 */
Account.prototype.getToken = function() {
    if (this._isAuth)
        return this._storage_token;
    else
        return null;
};

/**
 * @fn getStorageUrl
 * @desc Get this account storage url
 * @return {String|null} The url oif connected, null otherwise
 */
Account.prototype.getStorageUrl = function() {
    if (this._isAuth)
        return this._storage_url;
    else
        return null;
};

/**
 * @fn getName
 * @desc Getter a account name
 * @return {null|String} The name if computed or defined, null otherwise
 */
Account.prototype.getName = function() {
    return this._name;
};

module.exports = Account;
