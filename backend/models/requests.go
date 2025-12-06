package models

type CreateSessionRequest struct {
	DisplayName string        `json:"displayName" binding:"required"`
	Title       string        `json:"title" binding:"required"`
	Config      SessionConfig `json:"config"`
}

type JoinSessionRequest struct {
	DisplayName string `json:"displayName" binding:"required"`
}

type UpdateSessionConfigRequest struct {
	Code      string        `json:"code" binding:"required"`
	MemberID  int           `json:"memberId" bind:"required"`
	NewConfig SessionConfig `json:"newConfig" bind:"required"`
}

type CloseSessionRequest struct {
	Code     string `json:"code" binding:"required"`
	MemberID int    `json:"memberId" binding:"required"`
}
