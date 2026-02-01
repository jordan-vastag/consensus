package models

type CreateSessionRequest struct {
	Name   string        `json:"name" binding:"required"`
	Title  string        `json:"title" binding:"required"`
	Config SessionConfig `json:"config"`
}

type JoinSessionRequest struct {
	Name string `json:"name" binding:"required"`
}

type LeaveSessionRequest struct {
	Name string `json:"name" binding:"required"`
}

type UpdateSessionConfigRequest struct {
	Code      string        `json:"code" binding:"required"`
	NewConfig SessionConfig `json:"newConfig" bind:"required"`
}

type CloseSessionRequest struct {
	Name string `json:"name" binding:"required"`
}

type UpdateMemberRequest struct {
	NewName string `json:"newName" binding:"required"`
}

type TMDBSearchRequest struct {
	Query string `form:"q" binding:"required"`
	Page  int    `form:"page" binding:"min=1"`
}

type AddChoiceRequest struct {
	Title         string `json:"title" binding:"required"`
	Integration   string `json:"integration"`
	IntegrationID string `json:"integrationID"`
	Description   string `json:"description"`
	Rank          int    `json:"rank"`
}

type UpdateChoiceRequest struct {
	Title         string `json:"title" binding:"required"`
	Integration   string `json:"integration"`
	IntegrationID string `json:"integrationID"`
	Description   string `json:"description"`
	Rank          int    `json:"rank"`
}
