package repository

import (
	"consensus/database"
	"consensus/models"
	"context"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

const COLLECTION_NAME string = "session"

type SessionRepository struct {
	collection *mongo.Collection
}

func NewSessionRepository(dbName string) *SessionRepository {
	return &SessionRepository{
		collection: database.GetCollection(dbName, COLLECTION_NAME),
	}
}

func (repo *SessionRepository) Create(ctx context.Context, session *models.Session) (err error) {
	_, err = repo.collection.InsertOne(ctx, session)
	if err != nil {
		return err
	}
	return nil
}

func (repo *SessionRepository) FindByCode(ctx context.Context, code string) (session *models.Session, err error) {
	return
}

func (repo *SessionRepository) Update(ctx context.Context, newConfig *models.SessionConfig) (oldConfig *models.SessionConfig, err error) {
	return
}

func (repo *SessionRepository) Delete(ctx context.Context, code string) (err error) {
	return
}

func (repo *SessionRepository) FindActiveSessions(ctx context.Context) (activeSessions []models.Session, err error) {
	filter := bson.D{{"closedAt", bson.D{{"$eq", time.Time{}}}}}

	cursor, err := repo.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	if err = cursor.All(ctx, &activeSessions); err != nil {
		return nil, err
	}

	return activeSessions, nil
}
