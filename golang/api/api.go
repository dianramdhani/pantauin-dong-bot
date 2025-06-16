package api

import "github.com/joho/godotenv"

func init() {
	_ = godotenv.Load("../.env")
}

type GraphQLRequest struct {
	OperationName string                 `json:"operationName"`
	Variables     map[string]interface{} `json:"variables"`
	Query         string                 `json:"query"`
}
