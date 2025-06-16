package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type GraphQLBatchResponse struct {
	Data map[string]struct {
		Meta struct {
			Code string `json:"code"`
		} `json:"meta"`
	} `json:"data"`
}

func CheckOut(addressID int, token string) (bool, error) {
	apiURL := os.Getenv("API")

	requests := []GraphQLRequest{
		{
			OperationName: "processCheckoutV2",
			Variables:     map[string]any{},
			Query: `query processCheckoutV2 {
				processCheckoutV2 {
					meta { message error code }
					result { isContinueProcessCheckout isGoToNewCheckout isAddressAvailable }
				}
			}`,
		},
		{
			OperationName: "updateSummaryShipping",
			Variables: map[string]any{
				"request": map[string]any{
					"addressID":  addressID,
					"shippingID": 4,
				},
			},
			Query: `mutation updateSummaryShipping($request: UpdateSummaryShippingRequest!) {
				updateSummaryShipping(request: $request) {
					meta { message error code }
					result { status }
				}
			}`,
		},
		{
			OperationName: "updateSummaryPayment",
			Variables: map[string]any{
				"request": map[string]any{
					"paymentID":         57,
					"paymentCode":       "VABCA",
					"paymentParentCode": "VirtualAccount",
					"paymentName":       "Virtual Account",
					"paymentChildName":  "BCA Virtual Account",
					"minimumAmount":     10000,
				},
			},
			Query: `mutation updateSummaryPayment($request: UpdateSummaryPaymentRequest!) {
				updateSummaryPayment(request: $request) {
					meta { message error code }
					result { status }
				}
			}`,
		},
		{
			OperationName: "updateSummaryJTPoint",
			Variables: map[string]any{
				"request": map[string]any{"isJTPoint": true},
			},
			Query: `mutation updateSummaryJTPoint($request: UpdateSummaryJTPointRequest!) {
				updateSummaryJTPoint(request: $request) {
					meta { message error code }
					result { status }
				}
			}`,
		},
		{
			OperationName: "getSummaryCheckoutV2",
			Variables: map[string]any{
				"request": map[string]any{"isChanges": true},
			},
			Query: `query getSummaryCheckoutV2($request: SummaryCheckoutV2Request!) {
				getSummaryCheckoutV2(request: $request) {
					meta { message error code }
					result { total subTotal quantity }
				}
			}`,
		},
		{
			OperationName: "getCheckoutSKUList",
			Variables: map[string]any{
				"request": map[string]any{"isValidate": false},
			},
			Query: `query getCheckoutSKUList($request: CheckoutSKUListRequest) {
				getCheckoutSKUList(request: $request) {
					meta { message error code }
					result { items { productID productSKU productFinalPrice } }
				}
			}`,
		},
		{
			OperationName: "addOrderV2",
			Variables:     map[string]any{"request": map[string]any{}},
			Query: `mutation addOrderV2($request: addOrderV2Request) {
				addOrderV2(request: $request) {
					meta { message error code }
					result { status payment { status orderId redirectUrl } }
				}
			}`,
		},
	}

	body, _ := json.Marshal(requests)
	req, _ := http.NewRequest("POST", apiURL, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("checkOut request failed: %v", err)
	}
	defer resp.Body.Close()

	var results []GraphQLBatchResponse
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return false, fmt.Errorf("decode checkOut: %v", err)
	}

	for _, res := range results {
		for _, op := range res.Data {
			if op.Meta.Code != "success" {
				return false, nil
			}
		}
	}

	return true, nil
}
