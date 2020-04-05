import request from 'request';
import Account from './account';

/**
 * @class Container
 * @param account {Account} Account the container belongs to. SHOULD be in a connected state
 * @param name {String} container name or identifier
 * @constructor
 */
export class Container {
    _name: string;
    _account: Account;

    constructor(account: Account, name: string) {
        //Init member attributes
        this._name = name;
        this._account = account;
    }

    /**
     * @fn create
     * @desc Creates/updates container instance in object storage
     * @return {Promise} Resolves to object storage response on success, on error rejects a native js Error
     */
    create = (): Promise<any | Error> => {
        const _this = this;
        return new Promise(function (resolve, reject) {
            if (_this._account.isConnected() === false) {
                reject(new Error('Container needs a connect account'));
                return;
            }
            const options = {
                method: 'PUT',
                baseUrl: _this._account.getStorageUrl(),
                uri: '/' + _this._name,
                headers: {
                    'X-Auth-Token': _this._account.getToken()
                }
            };
            request(options, function (error, response, body) {
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
     * @return {Promise} Resolves to true on success, on error rejects a native js Error
     */
    delete = (): Promise<true | Error> => {
        const _this = this;
        return new Promise(function (resolve, reject) {
            if (_this._account.isConnected() === false) {
                reject(new Error('Container needs a connect account'));
                return;
            }
            const options = {
                method: 'DELETE',
                baseUrl: _this._account.getStorageUrl(),
                uri: '/' + _this._name,
                headers: {
                    'X-Auth-Token': _this._account.getToken()
                }
            };
            request(options, function (error, response, __unused__body) {
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
    setMetadata = (metadata): Promise<true | Error> => {
        const _this = this;
        return new Promise(function (resolve, reject) {
            if (_this._account.isConnected() === false) {
                reject(new Error('Container needs a connect account'));
                return;
            }

            const metas = {};
            for (const m in metadata) {
                const meta_name = 'X-Container-Meta-' + m;
                metas[meta_name] = metadata[m];
            }
            const heads = Object.assign({}, {
                'X-Auth-Token': _this._account.getToken()
            }, metas);
            const options = {
                method: 'POST',
                baseUrl: _this._account.getStorageUrl(),
                uri: '/' + _this._name,
                headers: heads
            };

            request(options, function (error, response, __unused__body) {
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
    getMetadata = (): Promise<any | Error> => {
        const _this = this;
        return new Promise(function (resolve, reject) {
            if (_this._account.isConnected() === false) {
                reject(new Error('Container needs a connect account'));
                return;
            }
            const options = {
                method: 'HEAD',
                baseUrl: _this._account.getStorageUrl(),
                uri: '/' + _this._name,
                headers: {
                    'X-Auth-Token': _this._account.getToken()
                }
            };
            request(options, function (error, response, __unused__body) {
                if (error) {
                    reject(error);
                    return;
                }
                if (response.statusCode !== 204) {
                    reject(new Error(response.statusMessage));
                    return;
                }

                const metas = {};
                for (const m in response.headers) {
                    if (m.toLowerCase().includes('x-container-meta-')) {//Add to metas
                        const meta_name = m.substr(17);
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
    listObjects = (): Promise<any | Error> => {
        const _this = this;
        return new Promise(function (resolve, reject) {
            if (_this._account.isConnected() === false) {
                reject(new Error('Container needs a connect account'));
                return;
            }
            const options = {
                method: 'GET',
                baseUrl: _this._account.getStorageUrl(),
                uri: '/' + _this._name,
                json: true,
                headers: {
                    'X-Auth-Token': _this._account.getToken()
                }
            };
            request(options, function (error, response, body) {
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
    setAccount = (account): Account => {
        this._account = account;
        return this._account;
    };

    /**
     * @fn getAccount
     * @desc Getter on account member
     * @return {Account}
     */
    getAccount = (): Account => {
        return this._account;
    };

    /**
     * @fn setName
     * @desc Setter for name member
     * @param name {String} New value for name member
     * @return {String} Assigned  member value
     */
    setName = (name: string): string => {
        this._name = name;
        return this._name;
    };

    /**
     * @fn getName
     * @desc Getter on container member name
     * @return {String} Container name
     */
    getName = (): string => {
        return this._name;
    };
}

export default Container;