package database

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var DBClient *mongo.Client

func Connect(uri string) error {
	// Set client timeout to 10 seconds and connect to MongoDB
	clientOptions := options.Client().ApplyURI(uri).SetConnectTimeout(10 * time.Second)
	client, err := mongo.Connect(clientOptions)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	// Ping the DB to verify connection
	err = client.Ping(ctx, nil)
	if err != nil {
		return err
	}

	DBClient = client
	log.Println("Connected to MongoDB!")
	return nil
}

func GetCollection(dbName string, collectionName string) *mongo.Collection {
	return DBClient.Database(dbName).Collection(collectionName)
}

func Close() {
	if DBClient == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := DBClient.Disconnect(ctx); err != nil {
		log.Fatal(err)
	}
	log.Println("Connection to MongoDB closed.")
}
