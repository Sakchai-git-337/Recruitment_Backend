package tests

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

	"backend/database"
	"backend/handlers"
	"backend/models"
	"backend/routes"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	godotenv.Load("../.env")
	if !strings.HasSuffix(os.Getenv("DB_NAME"), "_test") {
		fmt.Fprintln(os.Stderr, "FATAL: DB_NAME must end with _test (refusing to run tests against a non-test database)")
		os.Exit(1)
	}
	database.Connect()
	code := m.Run()
	database.DB.Close()
	os.Exit(code)
}

func newTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	_, err := database.DB.Exec(context.Background(),
		`TRUNCATE users, jobs, applications, screenings, interviews, work_tests, sessions RESTART IDENTITY CASCADE`)
	if err != nil {
		t.Fatal(err)
	}
	return routes.Setup()
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

func seedUser(t *testing.T, name, email, password, role string) models.User {
	t.Helper()
	h, err := handlers.HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	u := models.User{FullName: name, Email: email, Phone: "0800000000", Role: role}
	err = database.DB.QueryRow(context.Background(),
		`INSERT INTO users (full_name,email,password,phone,role) VALUES ($1,$2,$3,$4,$5) RETURNING user_id`,
		name, email, h, u.Phone, role).Scan(&u.UserID)
	if err != nil {
		t.Fatal(err)
	}
	return u
}

func loginToken(t *testing.T, r http.Handler, email, password string) string {
	t.Helper()
	w := doJSON(t, r, "POST", "/login", "", map[string]string{"email": email, "password": password})
	if w.Code != 200 {
		t.Fatalf("login %s: %d %s", email, w.Code, w.Body.String())
	}
	var out struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	return out.Token
}
