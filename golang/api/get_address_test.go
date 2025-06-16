package api

import (
	"testing"
)

func TestGetAddressID(t *testing.T) {
	addressID, err := GetAddressID("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NfdXVpZCI6ImY5OTUyMDY1LTYzZDAtNDQzYy05NmQ0LTUyYmJhZWEzODJiYiIsImFjY291bnRfZW1haWwiOiJsdW5hci5lbmlnbWFAZ214LmNvbSIsImFjY291bnRfaWQiOjgzODYxNSwiYWNjb3VudF90eXBlIjoiVVNFUiIsImV4cCI6MTc0OTgwMjA4NywiaXNfbG9naW4iOnRydWV9.0hrdqMtDf2A1mSLDcK6lfrrRGCvoNrJGeXZ5Qnm0n2o")
	if err != nil || addressID == 0 {
		t.Fatalf("Get address ID failed: %v", err)
	}

	t.Logf("Get address ID successful. ID: %d", addressID)
}
