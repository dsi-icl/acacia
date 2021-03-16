package db

type Db interface {
	Connect()
	GetOneRecord(req *DbDMLRequest) bool
	GetManyRecords(req *DbDMLRequest) bool
	InsertRecord(req *DbDMLRequest) bool
	EditRecord(req *DbDMLRequest) bool
}

type DbDMLRequest interface {
	serialise() interface{}
}

//type DbInsertRecordRequest interface {
//    serialise() DbSerialisedRequest
//}

//type DbEditRecordRequest interface {
//}
//
//type DbGetRecordRequest interface {
//}
