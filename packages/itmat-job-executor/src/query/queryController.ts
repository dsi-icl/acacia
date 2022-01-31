// TEST QUERY example
//
// const query_test = {
//     id : '474b9676-8b2c-4983-9dbe-a6ba84370288',
//     queryString : '{"31.0.0":"Male"}',
//     study : null,
//     requester : 'admin',
//     status : 'PROCESSING',
//     error : null,
//     cancelled : false,
//     lastClaimed : 1542288352356.0,
//     queryResult : {},
//     data_requested: [ '31.0.0',  '102.0.1', '102.0.2'],
//     cohort: [
//         [{ field: '102.0',
//             value: '> 1',
//             op: 'count'},
//         { field: '31.0.0',
//             value: 'Male',
//             op: '='}],
//         [{ field: '31.0.0',
//             value: 'Female',
//             op: '='},
//         { field: '102.0.1',
//             value: '',
//             op: 'exists'}]
//     ],
//     new_fields: [
//         {
//             name: 'BMI',
//             value: {
//                 left: {
//                     left: '12143.0.0',
//                     right: '',
//                     op: 'field'
//                 },
//                 right: {
//                     left: '12144.0.0',
//                     right: '2',
//                     op: '^'
//                 },
//                 op: '/'
//             },
//             op: 'derived'
//         }
//     ]
// };

/// **
// * @fn getStatus
// * @desc HTTP method GET handler on this service status
// * @param req Incoming message
// * @param res Server Response
// */
// QueryController.prototype.processQuery = function(req, res) {
//    let _this = this;
//    let queryId = req.body.query_id;
//    try {
//        _this._queryCollection.findOne({id : queryId}).then(function(query){
//
//            let pipeline = _this._queryHelper.buildPipeline(query);
//
//            if(pipeline === 'Error'){
//                res.status(500);
//                res.json('Error while building the pipeline: ' + query);
//            }
//
//            _this._dataCollection.aggregate(pipeline).toArray().then(function (results) {
//                res.status(200);
//                res.json(results);
//            },function(error){
//                res.status(500).json(error + ' ' + error.toString());
//
//            });
//        },function(error){
//            res.status(401);
//            res.json('Error while processing the query ' + queryId + error.toString());
//        });
//    }
//    catch (error) {
//        res.status(510);
//        res.json('Error occurred', error);
//    }
// };
//
//
// module.exports = QueryController;
//
