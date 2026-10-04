package tests

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"backend/database"
)

func decode(t *testing.T, body []byte) map[string]any {
	t.Helper()
	m := map[string]any{}
	if err := json.Unmarshal(body, &m); err != nil {
		t.Fatalf("bad json %s", body)
	}
	return m
}

func TestLoginOK(t *testing.T) {
	r := newTestRouter(t)
	seedUser(t, "HR", "hr@x.com", "pw", "recruitment")
	w := doJSON(t, r, "POST", "/login", "", map[string]string{"email": "hr@x.com", "password": "pw"})
	if w.Code != 200 {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
	m := decode(t, w.Body.Bytes())
	if len(m["token"].(string)) != 64 {
		t.Errorf("token len")
	}
	u := m["user"].(map[string]any)
	if u["role"] != "recruitment" {
		t.Errorf("role %v", u["role"])
	}
	if _, has := u["password"]; has {
		t.Errorf("password leaked")
	}
}

func TestLoginBad(t *testing.T) {
	r := newTestRouter(t)
	seedUser(t, "HR", "hr@x.com", "pw", "recruitment")
	for _, b := range []map[string]string{
		{"email": "hr@x.com", "password": "nope"},
		{"email": "none@x.com", "password": "pw"},
	} {
		if w := doJSON(t, r, "POST", "/login", "", b); w.Code != 401 {
			t.Errorf("%v: %d", b, w.Code)
		}
	}
}

func TestLegacyPlaintextRehash(t *testing.T) {
	r := newTestRouter(t)
	_, err := database.DB.Exec(context.Background(),
		`INSERT INTO users (full_name,email,password,phone,role) VALUES ('L','l@x.com','1234','1','applicant')`)
	if err != nil {
		t.Fatal(err)
	}
	loginToken(t, r, "l@x.com", "1234")
	var stored string
	database.DB.QueryRow(context.Background(), `SELECT password FROM users WHERE email='l@x.com'`).Scan(&stored)
	if !strings.HasPrefix(stored, "$2") {
		t.Errorf("not rehashed")
	}
	loginToken(t, r, "l@x.com", "1234")
}

func TestUsersRoleGate(t *testing.T) {
	r := newTestRouter(t)
	seedUser(t, "HR", "hr@x.com", "pw", "recruitment")
	seedUser(t, "A", "a@x.com", "pw", "applicant")
	if w := doJSON(t, r, "GET", "/users", "", nil); w.Code != 401 {
		t.Errorf("none: %d", w.Code)
	}
	if w := doJSON(t, r, "GET", "/users", "garbage", nil); w.Code != 401 {
		t.Errorf("garbage: %d", w.Code)
	}
	if w := doJSON(t, r, "GET", "/users", loginToken(t, r, "a@x.com", "pw"), nil); w.Code != 403 {
		t.Errorf("applicant: %d", w.Code)
	}
	if w := doJSON(t, r, "GET", "/users", loginToken(t, r, "hr@x.com", "pw"), nil); w.Code != 200 {
		t.Errorf("hr: %d", w.Code)
	}
}

func TestLogoutAndExpiry(t *testing.T) {
	r := newTestRouter(t)
	seedUser(t, "HR", "hr@x.com", "pw", "recruitment")
	tok := loginToken(t, r, "hr@x.com", "pw")
	if w := doJSON(t, r, "POST", "/logout", tok, nil); w.Code != 200 {
		t.Fatalf("logout %d", w.Code)
	}
	if w := doJSON(t, r, "GET", "/users", tok, nil); w.Code != 401 {
		t.Errorf("after logout: %d", w.Code)
	}
	tok = loginToken(t, r, "hr@x.com", "pw")
	database.DB.Exec(context.Background(), `UPDATE sessions SET expires_at = now() - interval '1 minute'`)
	if w := doJSON(t, r, "GET", "/users", tok, nil); w.Code != 401 {
		t.Errorf("expired: %d", w.Code)
	}
}

func TestRegisterForcesApplicant(t *testing.T) {
	r := newTestRouter(t)
	w := doJSON(t, r, "POST", "/users", "", map[string]string{
		"full_name": "X", "email": "x@x.com", "password": "pw", "phone": "1", "role": "recruitment"})
	if w.Code != 201 {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
	m := decode(t, w.Body.Bytes())
	if m["role"] != "applicant" {
		t.Errorf("role %v", m["role"])
	}
	if _, has := m["password"]; has {
		t.Errorf("password leaked")
	}
}

func TestApplicantUserScoping(t *testing.T) {
	r := newTestRouter(t)
	a := seedUser(t, "A", "a@x.com", "pw", "applicant")
	b := seedUser(t, "B", "b@x.com", "pw", "applicant")
	tok := loginToken(t, r, "a@x.com", "pw")
	own := fmt.Sprintf("/users/%d", a.UserID)
	other := fmt.Sprintf("/users/%d", b.UserID)
	if w := doJSON(t, r, "PATCH", own, tok, map[string]string{"role": "recruitment"}); w.Code != 403 {
		t.Errorf("role escalate: %d", w.Code)
	}
	if w := doJSON(t, r, "PATCH", other, tok, map[string]string{"phone": "1"}); w.Code != 403 {
		t.Errorf("patch other: %d", w.Code)
	}
	if w := doJSON(t, r, "GET", other, tok, nil); w.Code != 403 {
		t.Errorf("get other: %d", w.Code)
	}
	w := doJSON(t, r, "PATCH", own, tok, map[string]string{"phone": "0999"})
	if w.Code != 200 {
		t.Fatalf("patch own: %d %s", w.Code, w.Body.String())
	}
	m := decode(t, w.Body.Bytes())
	if m["phone"] != "0999" || m["full_name"] != "A" || m["email"] != "a@x.com" {
		t.Errorf("unexpected %v", m)
	}
	loginToken(t, r, "a@x.com", "pw")
	if w := doJSON(t, r, "PATCH", own, tok, map[string]string{"full_name": ""}); w.Code != 400 {
		t.Errorf("empty: %d", w.Code)
	}
}

func TestHRChangesPassword(t *testing.T) {
	r := newTestRouter(t)
	seedUser(t, "HR", "hr@x.com", "pw", "recruitment")
	a := seedUser(t, "A", "a@x.com", "old", "applicant")
	tok := loginToken(t, r, "hr@x.com", "pw")
	if w := doJSON(t, r, "PATCH", fmt.Sprintf("/users/%d", a.UserID), tok, map[string]string{"password": "new"}); w.Code != 200 {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
	if w := doJSON(t, r, "POST", "/login", "", map[string]string{"email": "a@x.com", "password": "old"}); w.Code != 401 {
		t.Errorf("old: %d", w.Code)
	}
	loginToken(t, r, "a@x.com", "new")
}
