package tests

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"
)

func jobBody(extra map[string]any) map[string]any {
	b := map[string]any{"title": "Dev", "description": "d", "requirement": "r", "location": "BKK", "status": "open"}
	for k, v := range extra {
		b[k] = v
	}
	return b
}

func decodeMap(t *testing.T, body []byte) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(body, &m); err != nil {
		t.Fatal(err)
	}
	return m
}

func TestJobNewFields(t *testing.T) {
	r := newTestRouter(t)
	seedUser(t, "HR", "hr@x.com", "pw", "recruitment")
	hr := loginToken(t, r, "hr@x.com", "pw")

	w := doJSON(t, r, "POST", "/jobs", hr, jobBody(map[string]any{
		"department": "IT", "employment_type": "contract", "salary_min": 30000, "salary_max": 45000,
		"headcount": 3, "closing_date": "2030-01-31",
	}))
	if w.Code != 201 {
		t.Fatalf("create: %d %s", w.Code, w.Body.String())
	}
	m := decodeMap(t, w.Body.Bytes())
	if m["department"] != "IT" || m["employment_type"] != "contract" || m["salary_min"] != float64(30000) ||
		m["salary_max"] != float64(45000) || m["headcount"] != float64(3) || m["closing_date"] != "2030-01-31" {
		t.Fatalf("fields: %v", m)
	}
	// same via GET by id and list
	g := decodeMap(t, doJSON(t, r, "GET", "/jobs/1", "", nil).Body.Bytes())
	if g["closing_date"] != "2030-01-31" || g["department"] != "IT" {
		t.Fatalf("get: %v", g)
	}

	// defaults
	w = doJSON(t, r, "POST", "/jobs", hr, jobBody(nil))
	if w.Code != 201 {
		t.Fatalf("create defaults: %d %s", w.Code, w.Body.String())
	}
	m = decodeMap(t, w.Body.Bytes())
	if m["department"] != "" || m["employment_type"] != "full_time" || m["headcount"] != float64(1) ||
		m["salary_min"] != nil || m["salary_max"] != nil || m["closing_date"] != nil {
		t.Fatalf("defaults: %v", m)
	}
}

func TestJobValidation(t *testing.T) {
	r := newTestRouter(t)
	seedUser(t, "HR", "hr@x.com", "pw", "recruitment")
	hr := loginToken(t, r, "hr@x.com", "pw")
	for name, extra := range map[string]map[string]any{
		"bad type":     {"employment_type": "freelance"},
		"min > max":    {"salary_min": 50000, "salary_max": 40000},
		"headcount 0":  {"headcount": 0},
		"bad date":     {"closing_date": "31/01/2030"},
		"negative min": {"salary_min": -1},
	} {
		if w := doJSON(t, r, "POST", "/jobs", hr, jobBody(extra)); w.Code != 400 {
			t.Errorf("%s: want 400, got %d %s", name, w.Code, w.Body.String())
		}
	}
}

func TestJobPatchNullAndPartial(t *testing.T) {
	r := newTestRouter(t)
	seedUser(t, "HR", "hr@x.com", "pw", "recruitment")
	hr := loginToken(t, r, "hr@x.com", "pw")
	doJSON(t, r, "POST", "/jobs", hr, jobBody(map[string]any{
		"department": "IT", "salary_min": 30000, "salary_max": 45000, "closing_date": "2030-01-31",
	}))

	w := doJSON(t, r, "PATCH", "/jobs/1", hr, map[string]any{"closing_date": nil})
	m := decodeMap(t, w.Body.Bytes())
	if w.Code != 200 || m["closing_date"] != nil || m["salary_min"] != float64(30000) || m["department"] != "IT" {
		t.Fatalf("clear date: %d %v", w.Code, m)
	}

	w = doJSON(t, r, "PATCH", "/jobs/1", hr, map[string]any{"department": "HR"})
	m = decodeMap(t, w.Body.Bytes())
	if w.Code != 200 || m["department"] != "HR" || m["salary_max"] != float64(45000) || m["title"] != "Dev" {
		t.Fatalf("partial: %d %v", w.Code, m)
	}

	w = doJSON(t, r, "PATCH", "/jobs/1", hr, map[string]any{"salary_min": nil, "salary_max": nil})
	m = decodeMap(t, w.Body.Bytes())
	if w.Code != 200 || m["salary_min"] != nil || m["salary_max"] != nil {
		t.Fatalf("clear salary: %d %v", w.Code, m)
	}

	// merged range check: raising min above stored max is rejected
	doJSON(t, r, "PATCH", "/jobs/1", hr, map[string]any{"salary_max": 40000})
	if w = doJSON(t, r, "PATCH", "/jobs/1", hr, map[string]any{"salary_min": 50000}); w.Code != 400 {
		t.Fatalf("merged range: %d", w.Code)
	}
	if w = doJSON(t, r, "PATCH", "/jobs/1", hr, map[string]any{"headcount": 0}); w.Code != 400 {
		t.Fatalf("headcount 0: %d", w.Code)
	}
	if w = doJSON(t, r, "PATCH", "/jobs/1", hr, map[string]any{"employment_type": "x"}); w.Code != 400 {
		t.Fatalf("bad type: %d", w.Code)
	}
}

func TestApplyAfterClosingDate(t *testing.T) {
	r := newTestRouter(t)
	seedUser(t, "HR", "hr@x.com", "pw", "recruitment")
	seedUser(t, "A", "a@x.com", "pw", "applicant")
	hr := loginToken(t, r, "hr@x.com", "pw")
	ap := loginToken(t, r, "a@x.com", "pw")
	yday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	doJSON(t, r, "POST", "/jobs", hr, jobBody(map[string]any{"closing_date": yday}))
	if w := submit(t, r, ap, 1, validForm(), goodFiles()); w.Code != 400 {
		t.Fatalf("expired: %d %s", w.Code, w.Body.String())
	}
	// today is still open
	doJSON(t, r, "PATCH", "/jobs/1", hr, map[string]any{"closing_date": time.Now().Format("2006-01-02")})
	if w := submit(t, r, ap, 1, validForm(), goodFiles()); w.Code != 201 {
		t.Fatalf("today: %d %s", w.Code, w.Body.String())
	}
}

func TestAdminUsers(t *testing.T) {
	r := newTestRouter(t)
	hrU := seedUser(t, "HR", "hr@x.com", "pw", "recruitment")
	seedUser(t, "A", "a@x.com", "pw", "applicant")
	hr := loginToken(t, r, "hr@x.com", "pw")
	ap := loginToken(t, r, "a@x.com", "pw")
	body := map[string]any{"full_name": "New HR", "email": "n@x.com", "password": "secret", "phone": "081", "role": "recruitment"}

	w := doJSON(t, r, "POST", "/admin/users", hr, body)
	if w.Code != 201 {
		t.Fatalf("create: %d %s", w.Code, w.Body.String())
	}
	m := decodeMap(t, w.Body.Bytes())
	if _, has := m["password"]; has || m["role"] != "recruitment" {
		t.Fatalf("resp: %v", m)
	}
	tok := loginToken(t, r, "n@x.com", "secret")
	var role string
	if me := decodeMap(t, doJSON(t, r, "GET", fmt.Sprintf("/users/%v", m["user_id"]), tok, nil).Body.Bytes()); true {
		role, _ = me["role"].(string)
	}
	if role != "recruitment" {
		t.Fatalf("login role: %q", role)
	}

	if w = doJSON(t, r, "POST", "/admin/users", ap, body); w.Code != 403 {
		t.Fatalf("applicant: %d", w.Code)
	}
	if w = doJSON(t, r, "POST", "/admin/users", hr, body); w.Code != 409 {
		t.Fatalf("dup: %d", w.Code)
	}
	body["email"], body["role"] = "z@x.com", "admin"
	if w = doJSON(t, r, "POST", "/admin/users", hr, body); w.Code != 400 {
		t.Fatalf("bad role: %d", w.Code)
	}

	self := fmt.Sprintf("/users/%d", hrU.UserID)
	if w = doJSON(t, r, "PATCH", self, hr, map[string]any{"role": "applicant"}); w.Code != 400 {
		t.Fatalf("self role: %d", w.Code)
	}
	if w = doJSON(t, r, "DELETE", self, hr, nil); w.Code != 400 {
		t.Fatalf("self delete: %d", w.Code)
	}
	other := fmt.Sprintf("/users/%v", m["user_id"])
	if w = doJSON(t, r, "DELETE", other, hr, nil); w.Code != 200 {
		t.Fatalf("delete other: %d", w.Code)
	}
}
