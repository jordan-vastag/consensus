package main

import (
	// "net/http"
	"log"
	"fmt"
	"consensus/integrations"
	// "github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func init() {
    err := godotenv.Load()
    if err != nil {
        log.Println("No .env file found, using system environment variables")
    }
}

func main() {
	// r := gin.Default()

	// r.GET("/ping", func(c *gin.Context) {
	// 	c.JSON(http.StatusOK, gin.H{
	// 		"message": "pong",
	// 	})
	// })

	// r.POST("/session", createSession)
	// r.POST("/session/join", joinSession)

	// r.Run() // listen on 0.0.0.0:8080 (localhost:8080 on Windows)

	client, err := integrations.InitTMDBClient()
	if err != nil {
		fmt.Println("Error:", err)
		return
	}

	movie, err := client.GetMovieDetails( 297802,nil)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	search, err := client.GetSearchMulti( "Avengers",nil)

	if err != nil {
		fmt.Println("Error:", err)
		return
	}

	fmt.Println("Movie Title:", movie)
	fmt.Println("Search:", search.Results)
}
