package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type getAddressListResponse struct {
	Data struct {
		GetAddressList struct {
			Result []struct {
				AddressID int `json:"addressID"`
			} `json:"result"`
		} `json:"getAddressList"`
	} `json:"data"`
}

func GetAddressID(token string) (int, error) {
	apiURL := os.Getenv("API")

	req := GraphQLRequest{
		OperationName: "getAddressList",
		Variables: map[string]any{
			"size": 1,
			"page": 1,
		},
		Query: `query getAddressList($size: Int, $page: Int, $keyword: String) {
			getAddressList(size: $size, page: $page, keyword: $keyword) {
				result {
					addressID
				}
			}
		}`,
	}

	body, _ := json.Marshal(req)
	httpReq, _ := http.NewRequest("POST", apiURL, bytes.NewBuffer(body))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+token)

	httpRes, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return 0, fmt.Errorf("getAddressList request failed: %v", err)
	}
	defer httpRes.Body.Close()

	var res getAddressListResponse
	if err := json.NewDecoder(httpRes.Body).Decode(&res); err != nil {
		return 0, fmt.Errorf("decode getAddressList: %v", err)
	}

	if len(res.Data.GetAddressList.Result) == 0 {
		return 0, fmt.Errorf("no address found")
	}

	return res.Data.GetAddressList.Result[0].AddressID, nil
}
