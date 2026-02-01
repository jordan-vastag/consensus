package repository

import (
	"consensus/database"
	"consensus/models"
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type ChoiceRepository struct {
	choice *mongo.Collection
}

func NewChoiceRepository(dbName string) *ChoiceRepository {
	return &ChoiceRepository{
		choice: database.GetCollection(dbName, "choice"),
	}
}

func (repo *ChoiceRepository) CreateChoice(ctx context.Context, choice *models.Choice) error {
	now := time.Now()
	choice.CreatedAt = now
	choice.UpdatedAt = now

	_, err := repo.choice.InsertOne(ctx, choice)
	return err
}

func (repo *ChoiceRepository) CreateAggregateChoices(ctx context.Context, choices []models.Choice) error {
	if len(choices) == 0 {
		return nil
	}

	now := time.Now()
	docs := make([]any, len(choices))

	for i, choice := range choices {
		docs[i] = bson.D{
			{"code", choice.Code},
			{"memberName", nil},
			{"title", choice.Title},
			{"integration", choice.Integration},
			{"integrationID", choice.IntegrationID},
			{"description", choice.Description},
			{"rank", choice.Rank},
			{"createdAt", now},
			{"updatedAt", now},
		}
	}

	_, err := repo.choice.InsertMany(ctx, docs)
	return err
}

func (repo *ChoiceRepository) FindChoicesByCode(ctx context.Context, code string) ([]models.Choice, error) {
	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
	}
	cursor, err := repo.choice.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var choices []models.Choice
	err = cursor.All(ctx, &choices)
	if err != nil {
		return nil, err
	}

	return choices, nil
}

func (repo *ChoiceRepository) FindAggregateChoices(ctx context.Context, code string) ([]models.Choice, error) {
	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
		{"memberName", bson.D{{"$eq", nil}}},
	}
	cursor, err := repo.choice.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var choices []models.Choice
	err = cursor.All(ctx, &choices)
	if err != nil {
		return nil, err
	}

	return choices, nil
}

func (repo *ChoiceRepository) FindChoicesByMemberName(ctx context.Context, code string, memberName string) ([]models.Choice, error) {
	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
		{"memberName", bson.D{{"$eq", memberName}}},
	}
	cursor, err := repo.choice.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var choices []models.Choice
	err = cursor.All(ctx, &choices)
	if err != nil {
		return nil, err
	}

	return choices, nil
}

func (repo *ChoiceRepository) UpdateChoice(ctx context.Context, code string, memberName string, title string, newChoice *models.Choice) error {
	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
		{"memberName", bson.D{{"$eq", memberName}}},
		{"title", bson.D{{"$eq", title}}},
	}

	now := time.Now()
	update := bson.D{
		{"$set", bson.D{
			{"title", newChoice.Title},
			{"integration", newChoice.Integration},
			{"integrationID", newChoice.IntegrationID},
			{"description", newChoice.Description},
			{"rank", newChoice.Rank},
			{"updatedAt", now},
		}},
	}

	result, err := repo.choice.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	} else if result.MatchedCount == 0 {
		return fmt.Errorf("failed to find choice")
	}

	return nil
}

func (repo *ChoiceRepository) RemoveAllChoicesByMemberName(ctx context.Context, code string, memberName string) error {
	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
		{"memberName", bson.D{{"$eq", memberName}}},
	}

	result, err := repo.choice.DeleteMany(ctx, filter)
	if err != nil {
		return err
	} else if result.DeletedCount == 0 {
		return fmt.Errorf("failed to find choices for member name")
	}

	return nil
}

func (repo *ChoiceRepository) RemoveChoice(ctx context.Context, code string, memberName string, title string) error {
	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
		{"memberName", bson.D{{"$eq", memberName}}},
		{"title", bson.D{{"$eq", title}}},
	}

	result, err := repo.choice.DeleteOne(ctx, filter)
	if err != nil {
		return err
	} else if result.DeletedCount == 0 {
		return fmt.Errorf("failed to find choice")
	}

	return nil
}
