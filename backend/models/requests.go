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
