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

type JoinSessionResponse struct {
	Msg     string
	Session Session
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

type TMDBSearchResultResponse struct {
	ID               int64                  `json:"id"`
	Title            string                 `json:"title"`
	Overview         string                 `json:"overview"`
	PosterURL        string                 `json:"poster_url"`
	BackdropURL      string                 `json:"backdrop_url"`
	ReleaseDate      string                 `json:"release_date"`
	VoteAverage      float64                `json:"vote_average"`
	Popularity       float64                `json:"popularity"`
	OriginalLanguage string                 `json:"original_language"`
	GenreIds         []int                  `json:"genre_ids"`
	Metadata         map[string]interface{} `json:"metadata"`
}

type TMDBSearchResponse struct {
	Msg     string                     `json:"msg"`
	Results []TMDBSearchResultResponse `json:"results"`
	Page    int                        `json:"page"`
	Total   int                        `json:"total"`
}

type AddChoiceResponse struct {
	Msg    string `json:"msg"`
	Choice Choice `json:"choice"`
}

type GetChoicesResponse struct {
	Msg     string   `json:"msg"`
	Choices []Choice `json:"choices"`
}

type UpdateChoiceResponse struct {
	Msg    string `json:"msg"`
	Choice Choice `json:"choice"`
}
