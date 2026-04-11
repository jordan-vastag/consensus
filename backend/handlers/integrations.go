package handlers

import (
	"consensus/integrations"
	"consensus/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type IntegrationHandler struct{}

func NewIntegrationHandler() *IntegrationHandler {
	return &IntegrationHandler{}
}

func (h *IntegrationHandler) SearchTMDB(c *gin.Context) {
	var req models.TMDBSearchRequest

	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	page := 1
	if p := c.DefaultQuery("page", "1"); p != "" {
		if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 {
			page = parsed
		}
	}

	tmdbClient := integrations.NewTMDBClient()
	searchResp, err := tmdbClient.SearchMovies(req.Query, page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	results := make([]models.TMDBSearchResultResponse, 0)
	for _, movie := range searchResp.Results {
		metadata := tmdbClient.MovieToMetadata(&movie)
		result := models.TMDBSearchResultResponse{
			ID:               movie.ID,
			Title:            movie.Title,
			Overview:         movie.Overview,
			PosterURL:        metadata.PosterURL,
			BackdropURL:      metadata.BackdropURL,
			ReleaseDate:      movie.ReleaseDate,
			VoteAverage:      movie.VoteAverage,
			Popularity:       movie.Popularity,
			OriginalLanguage: movie.OriginalLanguage,
			GenreIds:         movie.GenreIds,
		}

		// Convert metadata struct to map
		metadataMap := map[string]interface{}{
			"source":            metadata.Source,
			"tmdb_id":           metadata.TMDBID,
			"title":             metadata.Title,
			"overview":          metadata.Overview,
			"poster_path":       metadata.PosterPath,
			"backdrop_path":     metadata.BackdropPath,
			"release_date":      metadata.ReleaseDate,
			"vote_average":      metadata.VoteAverage,
			"popularity":        metadata.Popularity,
			"original_language": metadata.OriginalLanguage,
			"genre_ids":         metadata.GenreIds,
			"poster_url":        metadata.PosterURL,
			"backdrop_url":      metadata.BackdropURL,
		}
		result.Metadata = metadataMap

		results = append(results, result)
	}

	c.JSON(http.StatusOK, models.TMDBSearchResponse{
		Msg:     "TMDB search successful",
		Results: results,
		Page:    page,
		Total:   searchResp.Total,
	})
}
