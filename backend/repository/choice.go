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
		{"member", bson.D{{"$eq", nil}}},
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

func (repo *ChoiceRepository) FindChoicesByMember(ctx context.Context, code string, member string) ([]models.Choice, error) {
	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
		{"member", bson.D{{"$eq", member}}},
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

func (repo *ChoiceRepository) UpdateChoice(ctx context.Context, code string, member string, name string, newChoice *models.Choice) error {
	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
		{"member", bson.D{{"$eq", member}}},
		{"name", bson.D{{"$eq", name}}},
	}

	now := time.Now()
	update := bson.D{
		{"$set", bson.D{
			{"name", newChoice.Name},
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

func (repo *ChoiceRepository) RemoveAllChoicesByMember(ctx context.Context, code string, member string) error {
	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
		{"member", bson.D{{"$eq", member}}},
	}

	result, err := repo.choice.DeleteMany(ctx, filter)
	if err != nil {
		return err
	} else if result.DeletedCount == 0 {
		return fmt.Errorf("failed to find choices for member")
	}

	return nil
}

func (repo *ChoiceRepository) RemoveChoice(ctx context.Context, code string, member string, name string) error {
	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
		{"member", bson.D{{"$eq", member}}},
		{"name", bson.D{{"$eq", name}}},
	}

	result, err := repo.choice.DeleteOne(ctx, filter)
	if err != nil {
		return err
	} else if result.DeletedCount == 0 {
		return fmt.Errorf("failed to find choice")
	}

	return nil
}
