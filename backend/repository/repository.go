package repository

import (
	"consensus/database"
	"consensus/models"
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type SessionRepository struct {
	session *mongo.Collection
}

func NewSessionRepository(dbName string) *SessionRepository {
	return &SessionRepository{
		session: database.GetCollection(dbName, "session"),
	}
}

func (repo *SessionRepository) CreateSession(ctx context.Context, session *models.Session) (err error) {
	now := time.Now()
	session.CreatedAt = now
	session.UpdatedAt = now
	session.Config.CreatedAt = now
	session.Config.UpdatedAt = now
	for i := range session.Members {
		session.Members[i].CreatedAt = now
		session.Members[i].UpdatedAt = now
	}
	if session.Choices == nil {
		session.Choices = []models.Choice{}
	}
	for i := range session.Choices {
		session.Choices[i].CreatedAt = now
		session.Choices[i].UpdatedAt = now
		if session.Choices[i].Votes == nil {
			session.Choices[i].Votes = []models.Vote{}
		}
		for j := range session.Choices[i].Votes {
			session.Choices[i].Votes[j].CreatedAt = now
			session.Choices[i].Votes[j].UpdatedAt = now
		}
	}
	_, err = repo.session.InsertOne(ctx, session)
	if err != nil {
		return err
	}
	return nil
}

func (repo *SessionRepository) FindSessionByCode(ctx context.Context, code string) (session *models.Session, err error) {
	filter := bson.D{{"code", bson.D{{"$eq", code}}}}
	result := repo.session.FindOne(ctx, filter)

	session = &models.Session{}
	err = result.Decode(session)
	if err != nil {
		return nil, err
	}

	return session, nil
}

func (repo *SessionRepository) UpdateSessionConfig(ctx context.Context, newConfig *models.SessionConfig) (oldConfig *models.SessionConfig, err error) {
	return
}

func (repo *SessionRepository) CloseSession(ctx context.Context, code string) (err error) {
	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
	}

	currentTime := time.Now()
	update := bson.D{
		{"$set", bson.D{
			{"closedAt", currentTime},
			{"updatedAt", currentTime},
		}},
	}

	result, err := repo.session.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	} else if result.MatchedCount == 0 {
		return fmt.Errorf("failed to find session")
	}

	return nil
}

func (repo *SessionRepository) DeleteSession(ctx context.Context, code string) (err error) {
	filter := bson.D{{"code", bson.D{{"$eq", code}}}}
	_, err = repo.session.DeleteOne(ctx, filter)
	if err != nil {
		return err
	}

	return nil
}

func (repo *SessionRepository) FindAllSessions(ctx context.Context) (sessions []models.Session, err error) {
	cursor, err := repo.session.Find(ctx, bson.D{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	err = cursor.All(ctx, &sessions)
	if err != nil {
		return nil, err
	}

	return sessions, nil
}

func (repo *SessionRepository) FindActiveSessions(ctx context.Context) (activeSessions []models.Session, err error) {
	filter := bson.D{{"closedAt", bson.D{{"$eq", time.Time{}}}}}

	cursor, err := repo.session.Find(ctx, filter)
	if err != nil {
		log.Println(err)
		return nil, err
	}
	defer cursor.Close(ctx)

	err = cursor.All(ctx, &activeSessions)
	if err != nil {
		return nil, err
	}

	return activeSessions, nil
}

func (repo *SessionRepository) RemoveMemberFromSession(ctx context.Context, code string, name string) error {
	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
	}

	update := bson.D{
		{"$pull", bson.D{
			{"members", bson.D{{"name", name}}},
		}},
		{"$set", bson.D{
			{"updatedAt", time.Now()},
		}},
	}

	result, err := repo.session.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	} else if result.MatchedCount == 0 {
		return fmt.Errorf("failed to find session")
	}

	return nil
}

func (repo *SessionRepository) AddMemberToSession(ctx context.Context, code string, member models.Member) (err error) {
	now := time.Now()
	member.CreatedAt = now
	member.UpdatedAt = now

	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
	}

	update := bson.D{
		{"$push", bson.D{
			{"members", member},
		}},
		{"$set", bson.D{
			{"updatedAt", now},
		}},
	}

	result, err := repo.session.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	} else if result.MatchedCount == 0 {
		return fmt.Errorf("failed to find session")
	}

	return nil
}

func (repo *SessionRepository) UpdateMember(ctx context.Context, code string, name string, newName string) (err error) {
	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
		{"members.name", bson.D{{"$eq", name}}},
	}

	currentTime := time.Now()
	update := bson.D{
		{"$set", bson.D{
			{"members.$.name", newName},
			{"members.$.updatedAt", currentTime},
			{"updatedAt", currentTime},
		}},
	}

	result, err := repo.session.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	} else if result.MatchedCount == 0 {
		return fmt.Errorf("failed to find member")
	}

	return nil
}

func (repo *SessionRepository) FindMember(ctx context.Context, code string, name string) (member *models.Member, err error) {
	session, err := repo.FindSessionByCode(ctx, code)
	if err != nil {
		return nil, err
	}

	for _, m := range session.Members {
		if m.Name == name {
			return &m, nil
		}
	}

	return nil, fmt.Errorf("member not found")
}

func (repo *SessionRepository) FindAllMembers(ctx context.Context, code string) (members []models.Member, err error) {
	session, err := repo.FindSessionByCode(ctx, code)
	if err != nil {
		return nil, err
	}

	return session.Members, nil
}

func (repo *SessionRepository) AddChoice(ctx context.Context, code string, choice models.Choice) error {
	now := time.Now()
	choice.CreatedAt = now
	choice.UpdatedAt = now
	choice.Votes = []models.Vote{}

	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
	}

	update := bson.D{
		{"$push", bson.D{
			{"choices", choice},
		}},
		{"$set", bson.D{
			{"updatedAt", now},
		}},
	}

	result, err := repo.session.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	} else if result.MatchedCount == 0 {
		return fmt.Errorf("failed to find session")
	}

	return nil
}

func (repo *SessionRepository) FindChoicesByMemberName(ctx context.Context, code string, memberName string) ([]models.Choice, error) {
	session, err := repo.FindSessionByCode(ctx, code)
	if err != nil {
		return nil, err
	}

	var choices []models.Choice
	for _, c := range session.Choices {
		if c.MemberName == memberName {
			choices = append(choices, c)
		}
	}

	return choices, nil
}

func (repo *SessionRepository) FindAllChoices(ctx context.Context, code string) ([]models.Choice, error) {
	session, err := repo.FindSessionByCode(ctx, code)
	if err != nil {
		return nil, err
	}

	return session.Choices, nil
}

func (repo *SessionRepository) UpdateChoice(ctx context.Context, code string, memberName string, title string, newChoice *models.Choice) error {
	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
		{"choices.memberName", bson.D{{"$eq", memberName}}},
		{"choices.title", bson.D{{"$eq", title}}},
	}

	now := time.Now()
	update := bson.D{
		{"$set", bson.D{
			{"choices.$[choice].title", newChoice.Title},
			{"choices.$[choice].integration", newChoice.Integration},
			{"choices.$[choice].integrationID", newChoice.IntegrationID},
			{"choices.$[choice].description", newChoice.Description},
			{"choices.$[choice].updatedAt", now},
			{"updatedAt", now},
		}},
	}

	arrayFilters := []any{
		bson.D{
			{"choice.memberName", memberName},
			{"choice.title", title},
		},
	}

	result, err := repo.session.UpdateOne(ctx, filter, update, options.UpdateOne().SetArrayFilters(arrayFilters))
	if err != nil {
		return err
	} else if result.MatchedCount == 0 {
		return fmt.Errorf("failed to find choice")
	}

	return nil
}

func (repo *SessionRepository) RemoveChoice(ctx context.Context, code string, memberName string, title string) error {
	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
	}

	update := bson.D{
		{"$pull", bson.D{
			{"choices", bson.D{
				{"memberName", memberName},
				{"title", title},
			}},
		}},
		{"$set", bson.D{
			{"updatedAt", time.Now()},
		}},
	}

	result, err := repo.session.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	} else if result.MatchedCount == 0 {
		return fmt.Errorf("failed to find session")
	}

	return nil
}

func (repo *SessionRepository) RemoveAllChoicesByMemberName(ctx context.Context, code string, memberName string) error {
	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
	}

	update := bson.D{
		{"$pull", bson.D{
			{"choices", bson.D{
				{"memberName", memberName},
			}},
		}},
		{"$set", bson.D{
			{"updatedAt", time.Now()},
		}},
	}

	result, err := repo.session.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	} else if result.MatchedCount == 0 {
		return fmt.Errorf("failed to find session")
	}

	return nil
}

// Vote operations

func (repo *SessionRepository) AddVote(ctx context.Context, code string, choiceTitle string, vote models.Vote) error {
	now := time.Now()
	vote.CreatedAt = now
	vote.UpdatedAt = now

	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
		{"choices.title", bson.D{{"$eq", choiceTitle}}},
	}

	update := bson.D{
		{"$push", bson.D{
			{"choices.$[choice].votes", vote},
		}},
		{"$set", bson.D{
			{"choices.$[choice].updatedAt", now},
			{"updatedAt", now},
		}},
	}

	arrayFilters := []any{
		bson.D{
			{"choice.title", choiceTitle},
		},
	}

	result, err := repo.session.UpdateOne(ctx, filter, update, options.UpdateOne().SetArrayFilters(arrayFilters))
	if err != nil {
		return err
	} else if result.MatchedCount == 0 {
		return fmt.Errorf("failed to find choice")
	}

	return nil
}

func (repo *SessionRepository) UpdateVote(ctx context.Context, code string, choiceTitle string, memberName string, newValue int) error {
	now := time.Now()

	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
		{"choices.title", bson.D{{"$eq", choiceTitle}}},
		{"choices.votes.memberName", bson.D{{"$eq", memberName}}},
	}

	update := bson.D{
		{"$set", bson.D{
			{"choices.$[choice].votes.$[vote].value", newValue},
			{"choices.$[choice].votes.$[vote].updatedAt", now},
			{"choices.$[choice].updatedAt", now},
			{"updatedAt", now},
		}},
	}

	arrayFilters := []any{
		bson.D{
			{"choice.title", choiceTitle},
		},
		bson.D{
			{"vote.memberName", memberName},
		},
	}

	result, err := repo.session.UpdateOne(ctx, filter, update, options.UpdateOne().SetArrayFilters(arrayFilters))
	if err != nil {
		return err
	} else if result.MatchedCount == 0 {
		return fmt.Errorf("failed to find vote")
	}

	return nil
}

func (repo *SessionRepository) RemoveVote(ctx context.Context, code string, choiceTitle string, memberName string) error {
	now := time.Now()

	filter := bson.D{
		{"code", bson.D{{"$eq", code}}},
		{"choices.title", bson.D{{"$eq", choiceTitle}}},
	}

	update := bson.D{
		{"$pull", bson.D{
			{"choices.$[choice].votes", bson.D{
				{"memberName", memberName},
			}},
		}},
		{"$set", bson.D{
			{"choices.$[choice].updatedAt", now},
			{"updatedAt", now},
		}},
	}

	arrayFilters := []any{
		bson.D{
			{"choice.title", choiceTitle},
		},
	}

	result, err := repo.session.UpdateOne(ctx, filter, update, options.UpdateOne().SetArrayFilters(arrayFilters))
	if err != nil {
		return err
	} else if result.MatchedCount == 0 {
		return fmt.Errorf("failed to find choice")
	}

	return nil
}
