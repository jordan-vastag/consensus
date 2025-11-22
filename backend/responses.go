package main

type ErrorResponse struct {
	Error string `json:"error"`
}

type CreateSessionResponse struct {
	Msg  string `json:"msg" binding:"required"`
	Code int    `json:"code" binding:"required"`
}

type JoinSessionResponse struct {
	Msg      string  `json:"msg" binding:"required"`
	MemberID int     `json:"memberId" binding:"required"`
	Session  Session `json:"session" binding:"required"`
}

type GetSessionResponse struct {
	Msg     string  `json:"msg" binding:"required"`
	Session Session `json:"session" binding:"required"`
}

type UpdateSessionConfigResponse struct {
	Msg string        `json:"msg" binding:"required"`
	Old SessionConfig `json:"old" bind:"required"`
	New SessionConfig `json:"new" bind:"required"`
}

type CloseSessionResponse struct {
	Msg string `json:"msg" binding:"required"`
}
