package db

import (
	"context"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
	"log"
	"time"
)

var (
	DbCon MongoUserCollection
)

type MongoReq struct {
	Bson interface{}
}

func (self *MongoReq) serialise() interface{} {
	return self.Bson
}

type MongoUserCollection struct {
	client *mongo.Client
	db     *mongo.Database
	col    *mongo.Collection
}

func (self *MongoUserCollection) Connect() {
	ctx, _ := context.WithTimeout(context.Background(), 10*time.Second)
	client, err := mongo.Connect(ctx, options.Client().ApplyURI("mongodb://localhost:27017"))
	collection := client.Database("local").Collection("users")
	if err = client.Ping(ctx, readpref.Primary()); err != nil {
		log.Fatal(err)
	}
	self.client = client
	self.db = client.Database("local")
	self.col = collection
}

func (self *MongoUserCollection) GetOneRecord(req DbDMLRequest, v interface{}) (interface{}, error) {
	ctx, _ := context.WithTimeout(context.Background(), 5*time.Second)
	err := self.col.FindOne(ctx, req.serialise()).Decode(v)
	return v, err
}

func (self *MongoUserCollection) InsertRecord(req DbDMLRequest) error {
	ctx, _ := context.WithTimeout(context.Background(), 5*time.Second)
	_, err := self.col.InsertOne(ctx, req.serialise())
	return err

}
