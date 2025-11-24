package models

type CreateSessionRequest struct {
	MemberID    int           `json:"memberId" binding:"required"`
	DisplayName string        `json:"displayName" binding:"required"`
	Title       string        `json:"title" binding:"required"`
	Config      SessionConfig `json:"config"`
}

type JoinSessionRequest struct {
	DisplayName string `json:"displayName" binding:"required"`
}

type UpdateSessionConfigRequest struct {
	Code     string        `json:"code" binding:"required"`
	MemberID int           `json:"memberId" bind:"required"`
	Old      SessionConfig `json:"old" bind:"required"`
}

type CloseSessionRequest struct {
	Code     string `json:"code" binding:"required"`
	MemberID int    `json:"memberId" binding:"required"`
}
