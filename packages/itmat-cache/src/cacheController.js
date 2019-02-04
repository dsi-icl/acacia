const { Constants, ErrorHelper } =  require('eae-utils');

/**
 * @fn CacheController
 * @desc Controller of the cache service
 * @param db
 * @constructor
 */
function CacheController(db) {
    this.db = db;

    this.postQuery = CacheController.prototype.postQuery.bind(this);
    this._waitingForQueryResult = CacheController.prototype._waitingForQueryResult.bind(this);
}

/**
 * @fn postQuery
 * @desc Submit a new query.
 * If the query has been submitted before and the result is already in the database, then
 * it sends back the result.
 * If the query has been submitted before but the result is not yet in the database, then
 * it sends back a message saying the interface to wait and try later.
 * If the query has not been submitted before, then it sends back a message saying that.
 * @param req Incoming message
 * @param res Server Response
 */
CacheController.prototype.postQuery = function(req, res) {
    let _this = this;

    if (!req.body.job) {
        // Request is invalid
        res.status(400);
        res.send({error: 'Request does not contain a job in its body'});
    }

    let query = req.body.job;

    let filter = {
        'params.startDate': new Date(query.params.startDate),
        'params.endDate': new Date(query.params.endDate),
        'params.algorithmName': query.params.algorithmName,
        'params.resolution': query.params.resolution,
        'params.keySelector': query.params.keySelector,
        'params.sample': query.params.sample
    };

    _this.db.collection(Constants.EAE_COLLECTION_JOBS).findOne(filter).then(function(retrievedQuery) {
        if (!retrievedQuery) {
            // Query has never been submitted to the system
            res.status(200);
            res.send({result: null, waiting: false});
        } else {
            if (_this._waitingForQueryResult(retrievedQuery)) {
                // Query has already been submitted to the system, but the system is still waiting for the result
                res.status(200);
                res.send({result: null, waiting: true, status: retrievedQuery.status[0]});
            } else {
                // Query has already been already submitted to the system and the system has the result
                res.status(200);
                res.send({result: retrievedQuery.output, waiting: false});
            }
        }
    }, function (error) {
        res.status(500);
        res.json(ErrorHelper('Internal Mongo Error', error));
    });
};

/**
 * @fn _waitingForQueryResult
 * @desc returns whether we are waiting for the result of the query
 * @param query
 */
CacheController.prototype._waitingForQueryResult = function(query) {
    let waiting_statuses = [
        Constants.EAE_JOB_STATUS_CREATED,
        Constants.EAE_JOB_STATUS_QUEUED,
        Constants.EAE_JOB_STATUS_SCHEDULED,
        Constants.EAE_JOB_STATUS_TRANSFERRING_DATA,
        Constants.EAE_JOB_STATUS_RUNNING
    ];

    return waiting_statuses.includes(query.status[0]);
};

module.exports = CacheController;
