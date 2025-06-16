package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type generateTokenResult struct {
	Data struct {
		GenerateToken struct {
			Result struct {
				Token string `json:"token"`
			} `json:"result"`
		} `json:"generateToken"`
	} `json:"data"`
}

type signInByEmailResult struct {
	Data struct {
		SignInByEmail struct {
			Result struct {
				Auth struct {
					Token string `json:"token"`
				} `json:"auth"`
			} `json:"result"`
		} `json:"signInByEmail"`
	} `json:"data"`
}

func Login(email string) (string, error) {
	apiURL := os.Getenv("API")

	// Step 1: generateToken
	genTokenReq := GraphQLRequest{
		OperationName: "generateToken",
		Variables:     map[string]any{},
		Query: `query generateToken{
			generateToken{
				__typename
				meta{__typename message error code}
				result{token}
			}
		}`,
	}
	genBody, _ := json.Marshal(genTokenReq)
	genReq, _ := http.NewRequest("POST", apiURL, bytes.NewBuffer(genBody))
	genReq.Header.Set("Content-Type", "application/json")
	genReq.Header.Set("x-action", "generate_token")

	genRes, err := http.DefaultClient.Do(genReq)
	if err != nil {
		return "", fmt.Errorf("generateToken request failed: %v", err)
	}
	defer genRes.Body.Close()

	var genResp generateTokenResult
	if err := json.NewDecoder(genRes.Body).Decode(&genResp); err != nil {
		return "", fmt.Errorf("decode generateToken: %v", err)
	}
	token := genResp.Data.GenerateToken.Result.Token

	// Step 2: signInByEmail
	loginReq := GraphQLRequest{
		OperationName: "signInByEmail",
		Variables: map[string]any{
			"input": map[string]any{
				"email":    email,
				"password": os.Getenv("PASSWORD"),
			},
		},
		Query: `mutation signInByEmail($input: signInByEmailReq!) {
			signInByEmail(input: $input) {
				result {
					auth {
						token
					}
				}
			}
		}`,
	}
	loginBody, _ := json.Marshal(loginReq)
	loginHTTPReq, _ := http.NewRequest("POST", apiURL, bytes.NewBuffer(loginBody))
	loginHTTPReq.Header.Set("Content-Type", "application/json")
	loginHTTPReq.Header.Set("Authorization", "Bearer "+token)

	loginRes, err := http.DefaultClient.Do(loginHTTPReq)
	if err != nil {
		return "", fmt.Errorf("signInByEmail request failed: %v", err)
	}
	defer loginRes.Body.Close()

	var loginResp signInByEmailResult
	if err := json.NewDecoder(loginRes.Body).Decode(&loginResp); err != nil {
		return "", fmt.Errorf("decode signInByEmail: %v", err)
	}

	return loginResp.Data.SignInByEmail.Result.Auth.Token, nil
}
