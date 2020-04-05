import request from 'request';

/**
 * @class Store
 * @desc Describes an OpenStack Object Storage API endpoint
 * @param url {String} Object storage API url
 * @constructor
 */
export class Store {
    _url: string;

    constructor(url = 'http://127.0.0.1:8080') {
        //Init member attributes
        this._url = url;
    }

    /**
     * @fn getURL
     * @desc Getter on url member
     * @return {String} The store url
     */
    getURL = (): string => {
        return this._url;
    };

    /**
     * @fn setURL
     * @desc Setter on url member
     * @param url {String} New value for url member
     * @return {String} Newly assigned value
     */
    setURL = (url): string => {
        this._url = url;
        return this._url;
    };


    /**
     * @fn info
     * @desc Attempts to list activated capabilities on this Store
     * @return {Promise} Resolves to the list on success, rejects top native javascript Error otherwise
     */
    info = (): Promise<any | Error> => {
        const _this = this;

        return new Promise(function (resolve, reject) {
            const options = {
                method: 'GET',
                baseUrl: _this._url,
                uri: '/info',
                json: true
            };

            request(options, function (error, response, body) {
                if (error)
                    reject(error);
                else if ([200, 204].indexOf(response.statusCode) < 0)
                    reject(new Error(response.statusMessage));
                else
                    resolve(body);
            });
        });
    };
}

export default Store;