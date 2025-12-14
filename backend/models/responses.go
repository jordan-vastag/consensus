package models

type ErrorResponse struct {
	Error string
}

type MsgResponse struct {
	Msg string
}

type CreateSessionResponse struct {
	Msg  string
	Code string
}

type GetSessionResponse struct {
	Msg     string
	Session Session
}

type GetSessionsResponse struct {
	Msg      string
	Sessions []Session
}

type UpdateSessionConfigResponse struct {
	Msg string
	Old SessionConfig
	New SessionConfig
}

type CloseSessionResponse struct {
	Msg string
}

type GetMemberResponse struct {
	Msg    string
	Member Member
}

type GetMembersResponse struct {
	Msg     string
	Members []Member
}

type UpdateMemberResponse struct {
	Msg     string
	OldName string
	NewName string
}
