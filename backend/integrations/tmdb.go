package integrations

import (
    "net/http"
    "os"
    "time"
    "github.com/cyruzin/golang-tmdb"
)


func InitTMDBClient() (*tmdb.Client, error) {
    tmdbClient, err := tmdb.InitV4(os.Getenv("TMDB_BEARER_TOKEN"))
    if err != nil {
        return nil, err
    }
    
    tmdbClient.SetClientAutoRetry()
    
    customClient := http.Client{
        Timeout: time.Second * 5,
    }
    tmdbClient.SetClientConfig(customClient)
    
    return tmdbClient, nil
}

