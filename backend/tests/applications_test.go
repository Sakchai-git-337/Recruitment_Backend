package tests

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"backend/database"
)

func dec(t *testing.T, b []byte, v any) {
	t.Helper()
	if err := json.Unmarshal(b, v); err != nil {
		t.Fatal(err, string(b))
	}
}

func TestJobsAndApplications(t *testing.T) {
	r := newTestRouter(t)
	hrU := seedUser(t, "HR", "hr@t.com", "pw", "recruitment")
	a := seedUser(t, "Alice", "a@t.com", "pw", "applicant")
	b := seedUser(t, "Bob", "b@t.com", "pw", "applicant")
	hr := loginToken(t, r, "hr@t.com", "pw")
	ta := loginToken(t, r, "a@t.com", "pw")
	tb := loginToken(t, r, "b@t.com", "pw")

	// create job ignores body created_by
	w := doJSON(t, r, "POST", "/jobs", hr, map[string]any{
		"title": "Dev", "description": "d", "requirement": "r", "location": "BKK", "status": "open", "created_by": 999})
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var job struct {
		JobID     int `json:"job_id"`
		CreatedBy int `json:"created_by"`
	}
	dec(t, w.Body.Bytes(), &job)
	var stored int
	database.DB.QueryRow(context.Background(), `SELECT created_by FROM jobs WHERE job_id=$1`, job.JobID).Scan(&stored)
	if stored != hrU.UserID || job.CreatedBy != hrU.UserID {
		t.Fatalf("created_by stored=%d resp=%d want %d", stored, job.CreatedBy, hrU.UserID)
	}

	// partial patch keeps title
	w = doJSON(t, r, "PATCH", fmt.Sprintf("/jobs/%d", job.JobID), hr, map[string]any{"status": "closed"})
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var j2 struct{ Title, Status string }
	dec(t, w.Body.Bytes(), &j2)
	if j2.Title != "Dev" || j2.Status != "closed" {
		t.Fatalf("%+v", j2)
	}
	if w = doJSON(t, r, "PATCH", fmt.Sprintf("/jobs/%d", job.JobID), hr, map[string]any{"status": "bogus"}); w.Code != 400 {
		t.Fatal(w.Code)
	}
	doJSON(t, r, "PATCH", fmt.Sprintf("/jobs/%d", job.JobID), hr, map[string]any{"status": "open"})

	// applicant cannot create job
	w = doJSON(t, r, "POST", "/jobs", ta, map[string]any{
		"title": "x", "description": "d", "requirement": "r", "location": "l", "status": "open"})
	if w.Code != 403 {
		t.Fatal(w.Code)
	}

	// apply with spoofed fields
	w = doJSON(t, r, "POST", "/applications", ta, map[string]any{
		"job_id": job.JobID, "user_id": b.UserID, "status": "passed", "note": "x"})
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var app struct {
		ApplicationID int    `json:"application_id"`
		UserID        int    `json:"user_id"`
		Status        string `json:"status"`
	}
	dec(t, w.Body.Bytes(), &app)
	if app.UserID != a.UserID || app.Status != "pending" {
		t.Fatalf("%+v", app)
	}
	// twice -> 409
	w = doJSON(t, r, "POST", "/applications", ta, map[string]any{"job_id": job.JobID})
	if w.Code != 409 {
		t.Fatal(w.Code, w.Body.String())
	}
	// closed job -> 400
	w = doJSON(t, r, "POST", "/jobs", hr, map[string]any{
		"title": "C", "description": "d", "requirement": "r", "location": "l", "status": "closed"})
	var cj struct {
		JobID int `json:"job_id"`
	}
	dec(t, w.Body.Bytes(), &cj)
	if w = doJSON(t, r, "POST", "/applications", ta, map[string]any{"job_id": cj.JobID}); w.Code != 400 {
		t.Fatal(w.Code, w.Body.String())
	}
	if w = doJSON(t, r, "POST", "/applications", ta, map[string]any{"job_id": 99999}); w.Code != 404 {
		t.Fatal(w.Code, w.Body.String())
	}

	// Bob applies too, HR sets a note
	w = doJSON(t, r, "POST", "/applications", tb, map[string]any{"job_id": job.JobID})
	var bapp struct {
		ApplicationID int `json:"application_id"`
	}
	dec(t, w.Body.Bytes(), &bapp)
	doJSON(t, r, "PATCH", fmt.Sprintf("/applications/%d", app.ApplicationID), hr, map[string]any{"note": "secret"})

	// A list with user_id=B -> only A's rows, empty note
	w = doJSON(t, r, "GET", fmt.Sprintf("/applications?user_id=%d", b.UserID), ta, nil)
	var list []struct {
		UserID int    `json:"user_id"`
		Note   string `json:"note"`
	}
	dec(t, w.Body.Bytes(), &list)
	if len(list) != 1 || list[0].UserID != a.UserID || list[0].Note != "" {
		t.Fatalf("%s", w.Body.String())
	}
	// A GET B's app -> 404; own -> note empty
	if w = doJSON(t, r, "GET", fmt.Sprintf("/applications/%d", bapp.ApplicationID), ta, nil); w.Code != 404 {
		t.Fatal(w.Code)
	}
	w = doJSON(t, r, "GET", fmt.Sprintf("/applications/%d", app.ApplicationID), ta, nil)
	var own struct{ Note string }
	dec(t, w.Body.Bytes(), &own)
	if w.Code != 200 || own.Note != "" {
		t.Fatal(w.Code, w.Body.String())
	}
	if w = doJSON(t, r, "GET", "/applications?job_id=abc", hr, nil); w.Code != 400 {
		t.Fatal(w.Code)
	}

	// HR list has joined names
	w = doJSON(t, r, "GET", "/applications", hr, nil)
	var hl []struct {
		ApplicantName string `json:"applicant_name"`
		JobTitle      string `json:"job_title"`
		Note          string `json:"note"`
	}
	dec(t, w.Body.Bytes(), &hl)
	if len(hl) != 2 || hl[0].ApplicantName != "Alice" || hl[0].JobTitle != "Dev" || hl[0].Note != "secret" {
		t.Fatalf("%s", w.Body.String())
	}

	// HR patch status keeps note
	w = doJSON(t, r, "PATCH", fmt.Sprintf("/applications/%d", app.ApplicationID), hr, map[string]any{"status": "interview"})
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var note, st string
	database.DB.QueryRow(context.Background(), `SELECT note,status FROM applications WHERE application_id=$1`, app.ApplicationID).Scan(&note, &st)
	if note != "secret" || st != "interview" {
		t.Fatal(note, st)
	}
	if w = doJSON(t, r, "PATCH", fmt.Sprintf("/applications/%d", app.ApplicationID), hr, map[string]any{}); w.Code != 400 {
		t.Fatal(w.Code)
	}

	// DELETE
	path := fmt.Sprintf("/applications/%d", app.ApplicationID)
	if w = doJSON(t, r, "DELETE", path, ta, nil); w.Code != 403 {
		t.Fatal(w.Code)
	}
	if w = doJSON(t, r, "DELETE", path, hr, nil); w.Code != 200 {
		t.Fatal(w.Code)
	}
	if w = doJSON(t, r, "GET", path, hr, nil); w.Code != 404 {
		t.Fatal(w.Code)
	}
}
