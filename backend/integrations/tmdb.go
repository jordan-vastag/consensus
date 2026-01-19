package integrations

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"
)

type TMDBClient struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

type TMDBSearchResponse struct {
	Results []TMDBMovie `json:"results"`
	Page    int         `json:"page"`
	Total   int         `json:"total_results"`
}

type TMDBMovie struct {
	ID               int64   `json:"id"`
	Title            string  `json:"title"`
	Overview         string  `json:"overview"`
	PosterPath       string  `json:"poster_path"`
	ReleaseDate      string  `json:"release_date"`
	VoteAverage      float64 `json:"vote_average"`
	Popularity       float64 `json:"popularity"`
	BackdropPath     string  `json:"backdrop_path"`
	OriginalLanguage string  `json:"original_language"`
	GenreIds         []int   `json:"genre_ids"`
}

type TMDBMetadata struct {
	Source           string  `json:"source"`
	TMDBID           int64   `json:"tmdb_id"`
	Title            string  `json:"title"`
	Overview         string  `json:"overview"`
	PosterPath       string  `json:"poster_path"`
	BackdropPath     string  `json:"backdrop_path"`
	ReleaseDate      string  `json:"release_date"`
	VoteAverage      float64 `json:"vote_average"`
	Popularity       float64 `json:"popularity"`
	OriginalLanguage string  `json:"original_language"`
	GenreIds         []int   `json:"genre_ids"`
	PosterURL        string  `json:"poster_url"`
	BackdropURL      string  `json:"backdrop_url"`
}

func NewTMDBClient() *TMDBClient {
	apiKey := os.Getenv("TMDB_API_KEY")
	if apiKey == "" {
		apiKey = "demo_key" // For development
	}

	return &TMDBClient{
		apiKey:  apiKey,
		baseURL: "https://api.themoviedb.org/3",
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *TMDBClient) SearchMovies(query string, page int) (*TMDBSearchResponse, error) {
	if query == "" {
		return nil, fmt.Errorf("search query cannot be empty")
	}

	params := url.Values{}
	params.Add("api_key", c.apiKey)
	params.Add("query", query)
	params.Add("page", fmt.Sprintf("%d", page))

	reqURL := fmt.Sprintf("%s/search/movie?%s", c.baseURL, params.Encode())

	resp, err := c.client.Get(reqURL)
	if err != nil {
		return nil, fmt.Errorf("failed to search TMDB: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("TMDB API returned status %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var searchResp TMDBSearchResponse
	if err := json.Unmarshal(body, &searchResp); err != nil {
		return nil, fmt.Errorf("failed to parse TMDB response: %w", err)
	}

	return &searchResp, nil
}

func (c *TMDBClient) MovieToMetadata(movie *TMDBMovie) *TMDBMetadata {
	const imagePath = "https://image.tmdb.org/t/p/w500"

	return &TMDBMetadata{
		Source:           "tmdb",
		TMDBID:           movie.ID,
		Title:            movie.Title,
		Overview:         movie.Overview,
		PosterPath:       movie.PosterPath,
		BackdropPath:     movie.BackdropPath,
		ReleaseDate:      movie.ReleaseDate,
		VoteAverage:      movie.VoteAverage,
		Popularity:       movie.Popularity,
		OriginalLanguage: movie.OriginalLanguage,
		GenreIds:         movie.GenreIds,
		PosterURL:        imagePath + movie.PosterPath,
		BackdropURL:      imagePath + movie.BackdropPath,
	}
}
