package tests

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"backend/httperr"

	"github.com/gin-gonic/gin"
)

func TestEmptyListsReturnArray(t *testing.T) {
	r := newTestRouter(t)
	for _, p := range []string{"/users", "/jobs", "/applications", "/screenings", "/interviews", "/work-tests"} {
		w := doJSON(t, r, "GET", p, "", nil)
		if w.Code != 200 || strings.TrimSpace(w.Body.String()) != "[]" {
			t.Errorf("%s: %d %q", p, w.Code, w.Body.String())
		}
	}
}

func TestNotFoundAndBadID(t *testing.T) {
	r := newTestRouter(t)
	if w := doJSON(t, r, "GET", "/jobs/999", "", nil); w.Code != 404 {
		t.Errorf("want 404, got %d", w.Code)
	}
	if w := doJSON(t, r, "GET", "/jobs/abc", "", nil); w.Code != 400 {
		t.Errorf("want 400, got %d", w.Code)
	}
}

func TestDuplicateEmailConflict(t *testing.T) {
	r := newTestRouter(t)
	u := map[string]string{"full_name": "A", "email": "a@x.com", "password": "pw", "phone": "1", "role": "applicant"}
	if w := doJSON(t, r, "POST", "/users", "", u); w.Code != 201 {
		t.Fatalf("first: %d %s", w.Code, w.Body.String())
	}
	if w := doJSON(t, r, "POST", "/users", "", u); w.Code != 409 {
		t.Errorf("second: want 409, got %d", w.Code)
	}
}

func TestCORSAllowsAuthorization(t *testing.T) {
	r := newTestRouter(t)
	req := httptest.NewRequest("OPTIONS", "/jobs", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "PATCH")
	req.Header.Set("Access-Control-Request-Headers", "Authorization")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if h := w.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(strings.ToLower(h), "authorization") {
		t.Errorf("Allow-Headers = %q (status %d)", h, w.Code)
	}
}

func TestInternalErrorHidden(t *testing.T) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	httperr.RespondDB(c, errors.New("secret detail"))
	if w.Code != 500 || strings.Contains(w.Body.String(), "secret detail") {
		t.Errorf("%d %s", w.Code, w.Body.String())
	}
}
