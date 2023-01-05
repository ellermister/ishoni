package ishoni_server

import (
	"testing"
)

func TestParseMessage(t *testing.T) {

	if _, err := parseMessage(`{"command":"createRoom","data":"1234"}`); err != nil {
		t.Errorf("Failed to parse string `createRoom` on parseCommand")

	}
}
