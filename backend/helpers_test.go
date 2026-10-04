package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	godotenv.Load()
	if !strings.HasSuffix(os.Getenv("DB_NAME"), "_test") {
		fmt.Println("skip: DB_NAME must end with _test")
		os.Exit(0)
	}
	initDB()
	code := m.Run()
	db.Close()
	os.Exit(code)
}

func newTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	_, err := db.Exec(context.Background(),
		`TRUNCATE users, jobs, applications, screenings, interviews, work_tests, sessions RESTART IDENTITY CASCADE`)
	if err != nil {
		t.Fatal(err)
	}
	return setupRouter()
}

func doJSON(t *testing.T, r http.Handler, method, path, token string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatal(err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}
