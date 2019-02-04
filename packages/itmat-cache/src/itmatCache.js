//External node module imports
const MongoClient = require('mongodb').MongoClient;
const redis = require("redis");
const express = require('express');
const body_parser = require('body-parser');
const { ErrorHelper, StatusHelper, Constants } =  require('eae-utils');

const package_json = require('../package.json');


function ItmatCache(config) {
    // Init member attributes
    this.config = config;
    this.app = express();
    global.itmat_cache_config = config;

    // Bind public member functions
    this.start = ItmatCache.prototype.start.bind(this);
    this.stop = ItmatCache.prototype.stop.bind(this);

    // Bind private member functions
    this._connectDbs = ItmatCache.prototype._connectDbs.bind(this);
    this._setupStatusController = ItmatCache.prototype._setupStatusController.bind(this);
    this._setupCacheControllers = ItmatCache.prototype._setupCacheControllers.bind(this);
}

/**
 * @fn start
 * @desc Starts the eae compute service
 * @return {Promise} Resolves to a Express.js Application router on success,
 * rejects an error stack otherwise
 */
ItmatCache.prototype.start = function() {
    let _this = this;
    return new Promise(function (resolve, reject) {
        _this._connectDbs().then(function () {
            // Setup route using controllers
            _this._setupStatusController();
            _this._setupCacheControllers();

            // Start status periodic update
            _this.status_helper.startPeriodicUpdate(5 * 1000); // Update status every 5 seconds

            resolve(_this.app); // All good, returns application
        }, function (error) {
            reject(ErrorHelper('Cannot establish mongoDB connection', error));
        });
    });
};

/**
 * @fn stop
 * @desc Stop the eae compute service
 * @return {Promise} Resolves to true on success,
 * rejects an error stack otherwise
 */
ItmatCache.prototype.stop = function() {
    let _this = this;
    return new Promise(function (resolve, reject) {
        // Stop status update
        _this.status_helper.stopPeriodicUpdate();
        // Disconnect DB --force
        _this.mongo_client.close(true).then(function(error) {
            if (error)
                reject(ErrorHelper('Closing mongoDB connection failed', error));
            else
                resolve(true);
        });
    });
};

/**
 * @fn _connectDb
 * @desc Setup the connections with mongoDB
 * @return {Promise} Resolves to true on success
 * @private
 */
ItmatCache.prototype._connectDbs = function () {
    let _this = this;
    return new Promise(function (resolve, reject) {
        // Create a new MongoClient
        const mongo_client = new MongoClient(_this.config.mongoURL);
        mongo_client.connect(function (err) {
            if (err !== null && err !== undefined) {
                reject(ErrorHelper('Failed to connect to mongoDB', err));
                return;
            }
            _this.mongo_client = client;
            _this.mongo_db = _this.client.db(_this.config.mongoDb);

            // Create a new Redis client
            _this.redis_client = redis.createClient();
            resolve(true);
        });
    });
};

/**
 * @fn _setupStatusController
 * @desc Initialize status service routes and controller
 */
ItmatCache.prototype._setupStatusController = function () {
    let _this = this;

    let statusOpts = {
        version: package_json.version,
        clusters: global.eae_compute_config.clusters
    };
    _this.status_helper = new StatusHelper(Constants.EAE_SERVICE_TYPE_COMPUTE, global.eae_compute_config.port, null, statusOpts);
    _this.status_helper.setCollection(_this.db.collection(Constants.EAE_COLLECTION_STATUS));
    _this.status_helper.setComputeType(global.eae_compute_config.computeType);

    _this.statusController = new StatusController(_this.status_helper);
    _this.app.get('/status', _this.statusController.getStatus); // GET status
    _this.app.get('/specs', _this.statusController.getFullStatus); // GET Full status
};

/**
 * @fn _setupJobController
 * @desc Initialize job execution service routes and controller
 */
ItmatCache.prototype._setupCacheControllers = function () {
    let _this = this;

    _this.jobController = new JobController(_this.db.collection(Constants.EAE_COLLECTION_JOBS), _this.status_helper);
    _this.app.post('/run', _this.jobController.runJob); // POST run a job from ID
    _this.app.post('/cancel', _this.jobController.cancelJob); // POST cancel current job
};



module.exports = ItmatCache;
