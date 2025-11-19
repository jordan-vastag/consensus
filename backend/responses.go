package main

type ErrorResponse struct {
	Error string `json:"error"`
}

type CreateSessionResponse struct {
	Msg       string `json:"msg" binding:"required"`
	SessionID string `json:"sessionId" binding:"required"`
	Code      string `json:"code" binding:"required"`
}

type JoinSessionResponse struct {
	Msg       string   `json:"msg" binding:"required"`
	SessionID string   `json:"sessionId" binding:"required"`
	MemberID  string   `json:"memberId" binding:"required"`
	MemberIDs []string `json:"memberIds" binding:"required"`
}
