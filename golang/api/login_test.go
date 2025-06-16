package api

import (
	"testing"
)

func TestLogin(t *testing.T) {
	token, err := Login("lunar.enigma@gmx.com")
	if err != nil || token == "" {
		t.Fatalf("Login failed: %v", err)
	}

	t.Logf("Login successful. Token: %s...", token[:10])
}
