package repository

import (
	"consensus/database"
	"consensus/models"

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

func (repo *SessionRepository) Create(session *models.Session) (code string, err error) {
	return
}

func (repo *SessionRepository) FindByCode(code string) (session *models.Session, err error) {
	return
}

func (repo *SessionRepository) Update(session *models.Session) (err error) {
	return
}

func (repo *SessionRepository) Delete(code string) (err error) {
	return
}
