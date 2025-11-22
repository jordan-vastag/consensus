package main

type ErrorResponse struct {
	Error string
}

type CreateSessionResponse struct {
	Msg  string
	Code int
}

type JoinSessionResponse struct {
	Msg      string
	MemberID int
	Session  Session
}

type GetSessionResponse struct {
	Msg     string
	Session Session
}

type UpdateSessionConfigResponse struct {
	Msg string
	Old SessionConfig
	New SessionConfig
}

type CloseSessionResponse struct {
	Msg string
}
