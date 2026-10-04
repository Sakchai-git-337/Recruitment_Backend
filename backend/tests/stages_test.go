package tests

import (
	"encoding/json"
	"fmt"
	"testing"
)

func TestStages(t *testing.T) {
	r := newTestRouter(t)
	hrU := seedUser(t, "HR", "hr@t.com", "pw", "recruitment")
	a := seedUser(t, "A", "a@t.com", "pw", "applicant")
	b := seedUser(t, "B", "b@t.com", "pw", "applicant")
	hr := loginToken(t, r, "hr@t.com", "pw")
	ta := loginToken(t, r, "a@t.com", "pw")

	must := func(label string, code int, method, path, tok string, body any) []byte {
		t.Helper()
		w := doJSON(t, r, method, path, tok, body)
		if w.Code != code {
			t.Fatalf("%s: %s %s want %d got %d %s", label, method, path, code, w.Code, w.Body.String())
		}
		return w.Body.Bytes()
	}
	type idr struct {
		ScreeningID   int    `json:"screening_id"`
		InterviewID   int    `json:"interview_id"`
		TestID        int    `json:"test_id"`
		ScreenedBy    int    `json:"screened_by"`
		InterviewerID int    `json:"interviewer_id"`
		AssignedBy    int    `json:"assigned_by"`
		TestResult    string `json:"test_result"`
	}
	var j struct {
		JobID int `json:"job_id"`
	}
	json.Unmarshal(must("job", 201, "POST", "/jobs", hr, map[string]any{
		"title": "Dev", "description": "d", "requirement": "r", "location": "BKK", "status": "open"}), &j)
	mkApp := func(uid int) int {
		var o struct {
			ApplicationID int `json:"application_id"`
		}
		json.Unmarshal(must("app", 201, "POST", "/applications", hr, map[string]any{"user_id": uid, "job_id": j.JobID}), &o)
		return o.ApplicationID
	}
	appA, appB := mkApp(a.UserID), mkApp(b.UserID)

	var sc, sc2 idr
	t.Run("create ignores body actor ids", func(t *testing.T) {
		json.Unmarshal(must("sc", 201, "POST", "/screenings", hr, map[string]any{"application_id": appA, "screened_by": 999, "result": "pending", "note": "n"}), &sc)
		json.Unmarshal(must("sc2", 201, "POST", "/screenings", hr, map[string]any{"application_id": appB, "result": "pass"}), &sc2)
		if sc.ScreenedBy != hrU.UserID {
			t.Fatalf("screened_by=%d", sc.ScreenedBy)
		}
	})
	var iv, iv2 idr
	json.Unmarshal(must("iv", 201, "POST", "/interviews", hr, map[string]any{"application_id": appA, "interviewer_id": 999, "interview_date": "2026-11-01", "interview_time": "10:00", "status": "scheduled", "result": "secret", "note": "private"}), &iv)
	json.Unmarshal(must("iv2", 201, "POST", "/interviews", hr, map[string]any{"application_id": appB, "interview_date": "2026-11-02", "interview_time": "11:00", "status": "scheduled"}), &iv2)
	if iv.InterviewerID != hrU.UserID {
		t.Fatalf("interviewer_id=%d", iv.InterviewerID)
	}
	var wt idr
	must("wt no date", 400, "POST", "/work-tests", hr, map[string]any{"application_id": appA})
	must("wt bad result", 400, "POST", "/work-tests", hr, map[string]any{"application_id": appA, "test_date": "2026-11-03T09:00:00Z", "test_result": "maybe"})
	json.Unmarshal(must("wt", 201, "POST", "/work-tests", hr, map[string]any{"application_id": appA, "assigned_by": 999, "test_date": "2026-11-03T09:00:00Z"}), &wt)
	must("wt2", 201, "POST", "/work-tests", hr, map[string]any{"application_id": appB, "test_date": "2026-11-03T09:00:00Z"})
	if wt.TestResult != "pending" || wt.AssignedBy != hrU.UserID {
		t.Fatalf("wt=%+v", wt)
	}

	t.Run("application_id filter", func(t *testing.T) {
		for _, p := range []string{"/screenings", "/interviews", "/work-tests"} {
			var all, f []map[string]any
			json.Unmarshal(must(p+" all", 200, "GET", p, hr, nil), &all)
			json.Unmarshal(must(p+" filtered", 200, "GET", fmt.Sprintf("%s?application_id=%d", p, appA), hr, nil), &f)
			if len(all) < 2 || len(f) == 0 {
				t.Fatalf("%s all=%d f=%d", p, len(all), len(f))
			}
			for _, row := range f {
				if int(row["application_id"].(float64)) != appA {
					t.Fatalf("%s leaked %v", p, row)
				}
			}
			must(p+" bad", 400, "GET", p+"?application_id=x", hr, nil)
			var none []any
			json.Unmarshal(must(p+" none", 200, "GET", p+"?application_id=9999", hr, nil), &none)
			if none == nil || len(none) != 0 {
				t.Fatalf("%s want []", p)
			}
		}
	})

	t.Run("partial patch", func(t *testing.T) {
		must("sc patch", 200, "PATCH", fmt.Sprintf("/screenings/%d", sc.ScreeningID), hr, map[string]any{"note": "x"})
		var s map[string]any
		json.Unmarshal(must("sc get", 200, "GET", fmt.Sprintf("/screenings/%d", sc.ScreeningID), hr, nil), &s)
		if s["result"] != "pending" || s["note"] != "x" {
			t.Fatalf("%v", s)
		}
		must("sc bad", 400, "PATCH", fmt.Sprintf("/screenings/%d", sc.ScreeningID), hr, map[string]any{"result": "zz"})
		must("iv patch", 200, "PATCH", fmt.Sprintf("/interviews/%d", iv.InterviewID), hr, map[string]any{"status": "completed"})
		var v map[string]any
		json.Unmarshal(must("iv get", 200, "GET", fmt.Sprintf("/interviews/%d", iv.InterviewID), hr, nil), &v)
		if v["status"] != "completed" || v["interview_date"] != "2026-11-01" || v["interview_time"] != "10:00:00" || v["note"] != "private" {
			t.Fatalf("%v", v)
		}
		must("iv bad date", 400, "PATCH", fmt.Sprintf("/interviews/%d", iv.InterviewID), hr, map[string]any{"interview_date": "nope"})
		must("iv bad status", 400, "PATCH", fmt.Sprintf("/interviews/%d", iv.InterviewID), hr, map[string]any{"status": "zz"})
		must("wt patch", 200, "PATCH", fmt.Sprintf("/work-tests/%d", wt.TestID), hr, map[string]any{"test_note": "ok"})
		var w map[string]any
		json.Unmarshal(must("wt get", 200, "GET", fmt.Sprintf("/work-tests/%d", wt.TestID), hr, nil), &w)
		if w["test_result"] != "pending" || w["test_note"] != "ok" || w["test_date"] == nil {
			t.Fatalf("%v", w)
		}
		must("wt bad", 400, "PATCH", fmt.Sprintf("/work-tests/%d", wt.TestID), hr, map[string]any{"test_result": "zz"})
		must("wt empty", 400, "PATCH", fmt.Sprintf("/work-tests/%d", wt.TestID), hr, map[string]any{})
	})

	t.Run("applicant scoping", func(t *testing.T) {
		var list []map[string]any
		json.Unmarshal(must("list", 200, "GET", "/interviews", ta, nil), &list)
		if len(list) != 1 || int(list[0]["interview_id"].(float64)) != iv.InterviewID || list[0]["result"] != "" || list[0]["note"] != "" {
			t.Fatalf("%v", list)
		}
		var own map[string]any
		json.Unmarshal(must("own", 200, "GET", fmt.Sprintf("/interviews/%d", iv.InterviewID), ta, nil), &own)
		if own["result"] != "" || own["note"] != "" {
			t.Fatalf("%v", own)
		}
		must("other", 404, "GET", fmt.Sprintf("/interviews/%d", iv2.InterviewID), ta, nil)
		must("screenings", 403, "GET", "/screenings", ta, nil)
	})

	t.Run("delete", func(t *testing.T) {
		for _, p := range []string{
			fmt.Sprintf("/screenings/%d", sc2.ScreeningID),
			fmt.Sprintf("/interviews/%d", iv2.InterviewID),
			fmt.Sprintf("/work-tests/%d", wt.TestID),
		} {
			must(p+" first", 200, "DELETE", p, hr, nil)
			must(p+" second", 404, "DELETE", p, hr, nil)
		}
		must("applicant delete", 403, "DELETE", fmt.Sprintf("/screenings/%d", sc.ScreeningID), ta, nil)
	})
}
