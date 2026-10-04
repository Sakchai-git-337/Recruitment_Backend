package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"backend/database"
)

var (
	pdfBytes = []byte("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n")
	pngBytes = []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00")
)

type tfile struct {
	field, name string
	data        []byte
}

func validForm() map[string]any {
	return map[string]any{
		"expected_salary": 30000, "available_start_date": "2026-11-01",
		"title_th": "นาย", "first_name_th": "สมชาย", "last_name_th": "ใจดี",
		"date_of_birth":   "1995-05-20",
		"present_address": "1 ถนน", "present_province": "กรุงเทพ",
		"mobile_phone": "0812345678", "email": "a@t.com",
		"education":       []any{map[string]any{"level": "bachelor", "institute": "CU", "year_to": 2560, "degree": "วท.บ.", "major": "CS"}},
		"relevant_skills": "Go", "has_work_experience": false, "years_of_experience": 0,
		"pdpa_consent": true, "signature_name": "สมชาย ใจดี",
	}
}

func multipartBody(t *testing.T, fields map[string]string, files []tfile) (*bytes.Buffer, string) {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	for k, v := range fields {
		if err := mw.WriteField(k, v); err != nil {
			t.Fatal(err)
		}
	}
	for _, f := range files {
		p, err := mw.CreateFormFile(f.field, f.name)
		if err != nil {
			t.Fatal(err)
		}
		p.Write(f.data)
	}
	mw.Close()
	return &buf, mw.FormDataContentType()
}

func submit(t *testing.T, r http.Handler, token string, jobID int, form map[string]any, files []tfile) *httptest.ResponseRecorder {
	t.Helper()
	fj, _ := json.Marshal(form)
	body, ct := multipartBody(t, map[string]string{"job_id": strconv.Itoa(jobID), "form": string(fj)}, files)
	req := httptest.NewRequest("POST", "/applications", body)
	req.Header.Set("Content-Type", ct)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func goodFiles() []tfile {
	return []tfile{{"doc_resume", "cv.pdf", pdfBytes}, {"doc_education", "deg.png", pngBytes}}
}

func count(t *testing.T, table string) int {
	t.Helper()
	var n int
	if err := database.DB.QueryRow(context.Background(), "SELECT count(*) FROM "+table).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

type formEnv struct {
	r          http.Handler
	hr, ta, tb string
	job        int
}

func newFormEnv(t *testing.T) *formEnv {
	r := newTestRouter(t)
	seedUser(t, "HR", "hr@t.com", "pw", "recruitment")
	seedUser(t, "Alice", "a@t.com", "pw", "applicant")
	seedUser(t, "Bob", "b@t.com", "pw", "applicant")
	e := &formEnv{r: r, hr: loginToken(t, r, "hr@t.com", "pw"), ta: loginToken(t, r, "a@t.com", "pw"), tb: loginToken(t, r, "b@t.com", "pw")}
	e.job = mkJob(t, r, e.hr)
	return e
}

func mkJob(t *testing.T, r http.Handler, hr string) int {
	w := doJSON(t, r, "POST", "/jobs", hr, map[string]any{
		"title": "Dev", "description": "d", "requirement": "r", "location": "BKK", "status": "open"})
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var j struct {
		JobID int `json:"job_id"`
	}
	dec(t, w.Body.Bytes(), &j)
	return j.JobID
}

func TestFormSubmitAndRead(t *testing.T) {
	e := newFormEnv(t)
	w := submit(t, e.r, e.ta, e.job, validForm(), goodFiles())
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var app struct {
		ApplicationID int    `json:"application_id"`
		Status        string `json:"status"`
	}
	dec(t, w.Body.Bytes(), &app)
	if app.Status != "pending" || app.ApplicationID == 0 {
		t.Fatal(w.Body.String())
	}
	if count(t, "applications") != 1 || count(t, "application_forms") != 1 || count(t, "application_documents") != 2 {
		t.Fatal("row counts")
	}
	id := strconv.Itoa(app.ApplicationID)

	// duplicate
	if w := submit(t, e.r, e.ta, e.job, validForm(), goodFiles()); w.Code != 409 {
		t.Fatal("dup", w.Code, w.Body.String())
	}
	if count(t, "application_documents") != 2 {
		t.Fatal("dup inserted docs")
	}

	for _, tok := range []string{e.ta, e.hr} {
		w := doJSON(t, e.r, "GET", "/applications/"+id+"/form", tok, nil)
		if w.Code != 200 || !strings.Contains(w.Body.String(), "สมชาย") || !strings.Contains(w.Body.String(), "consent_at") {
			t.Fatal("form", w.Code, w.Body.String())
		}
		w = doJSON(t, e.r, "GET", "/applications/"+id+"/documents", tok, nil)
		if w.Code != 200 {
			t.Fatal("docs", w.Code)
		}
		var docs []struct {
			DocumentID int    `json:"document_id"`
			DocType    string `json:"doc_type"`
		}
		dec(t, w.Body.Bytes(), &docs)
		if len(docs) != 2 || strings.Contains(w.Body.String(), `"data"`) {
			t.Fatal("docs list", w.Body.String())
		}
		for _, d := range docs {
			w := doJSON(t, e.r, "GET", "/documents/"+strconv.Itoa(d.DocumentID), tok, nil)
			want := map[string][]byte{"resume": pdfBytes, "education": pngBytes}[d.DocType]
			wantCT := map[string]string{"resume": "application/pdf", "education": "image/png"}[d.DocType]
			if w.Code != 200 || w.Header().Get("Content-Type") != wantCT ||
				w.Header().Get("X-Content-Type-Options") != "nosniff" ||
				!strings.HasPrefix(w.Header().Get("Content-Disposition"), "inline; filename*=UTF-8''") ||
				!bytes.Equal(w.Body.Bytes(), want) {
				t.Fatal("doc", d.DocType, w.Code, w.Header())
			}
		}
	}

	// other applicant: 404 on all three
	var docID int
	database.DB.QueryRow(context.Background(), `SELECT min(document_id) FROM application_documents`).Scan(&docID)
	for _, p := range []string{"/applications/" + id + "/form", "/applications/" + id + "/documents", "/documents/" + strconv.Itoa(docID)} {
		if w := doJSON(t, e.r, "GET", p, e.tb, nil); w.Code != 404 {
			t.Fatal("leak", p, w.Code)
		}
	}

	// list has no form data
	w = doJSON(t, e.r, "GET", "/applications", e.hr, nil)
	if strings.Contains(w.Body.String(), `"data"`) || strings.Contains(w.Body.String(), "สมชาย") {
		t.Fatal("list leaks form")
	}

	// cascade
	if w := doJSON(t, e.r, "DELETE", "/jobs/"+strconv.Itoa(e.job), e.hr, nil); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	if count(t, "application_forms") != 0 || count(t, "application_documents") != 0 {
		t.Fatal("cascade")
	}
}

func TestFormPhoneWithDashes(t *testing.T) {
	e := newFormEnv(t)
	f := validForm()
	f["mobile_phone"] = "081-234 5678"
	if w := submit(t, e.r, e.ta, e.job, f, goodFiles()); w.Code != 201 {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
}

func TestFormRejections(t *testing.T) {
	e := newFormEnv(t)
	bad := func(name string, form map[string]any, files []tfile, wantMsg string, field ...string) {
		t.Helper()
		w := submit(t, e.r, e.ta, e.job, form, files)
		if w.Code != 400 || !strings.Contains(w.Body.String(), wantMsg) {
			t.Fatalf("%s: %d %s", name, w.Code, w.Body.String())
		}
		if len(field) > 0 && !strings.Contains(w.Body.String(), `"field":"`+field[0]+`"`) {
			t.Fatalf("%s: field %s missing: %s", name, field[0], w.Body.String())
		}
		if count(t, "applications") != 0 || count(t, "application_forms") != 0 || count(t, "application_documents") != 0 {
			t.Fatalf("%s: rows inserted", name)
		}
	}

	f := validForm()
	delete(f, "first_name_th")
	bad("missing key", f, goodFiles(), "กรุณากรอก ชื่อ (ไทย)", "first_name_th")

	f = validForm()
	f["pdpa_consent"] = false
	bad("consent", f, goodFiles(), "PDPA", "pdpa_consent")

	f = validForm()
	f["signature_name"] = "คนอื่น"
	bad("signature", f, goodFiles(), "ต้องตรงกับชื่อ-นามสกุล", "signature_name")

	f = validForm()
	f["education"] = []any{map[string]any{"level": "bachelor"}}
	bad("education sub", f, goodFiles(), "ประวัติการศึกษา แถวที่ 1: กรุณากรอก", "education.0.institute")

	f = validForm()
	f["education"] = []any{}
	bad("education empty", f, goodFiles(), "กรุณากรอก ประวัติการศึกษา", "education")

	f = validForm()
	f["education"] = []any{map[string]any{"institute": "CU", "year_to": 2560, "degree": "x", "major": "y"}}
	bad("education level", f, goodFiles(), "แถวที่ 1: กรุณากรอก ระดับการศึกษา", "education.0.level")

	f = validForm()
	f["date_of_birth"] = "2538-05-20"
	bad("buddhist dob", f, goodFiles(), "ปีเกิดต้องเป็น ค.ศ.", "date_of_birth")

	f = validForm()
	f["available_start_date"] = "2569-11-01"
	bad("buddhist start", f, goodFiles(), "ไม่ถูกต้อง", "available_start_date")

	f = validForm()
	f["mobile_phone"] = "12345"
	bad("phone", f, goodFiles(), "เบอร์โทรศัพท์มือถือ ไม่ถูกต้อง", "mobile_phone")

	bad("no education doc", validForm(), goodFiles()[:1], "เอกสารวุฒิการศึกษา", "doc_education")
	bad("no resume doc", validForm(), goodFiles()[1:], "Resume", "doc_resume")

	bad("fake pdf", validForm(), []tfile{{"doc_resume", "cv.pdf", []byte("just some text, not a pdf")}, goodFiles()[1]}, "PDF, JPG หรือ PNG")

	big := append([]byte("%PDF-1.4\n"), make([]byte, 11<<20)...)
	bad("11MB", validForm(), []tfile{{"doc_resume", "cv.pdf", big}, goodFiles()[1]}, "10 MB")

	many := goodFiles()
	for i := 0; i < 14; i++ {
		many = append(many, tfile{"doc_other", "o.pdf", pdfBytes})
	}
	bad("16 files", validForm(), many, "15")

	bad("unknown doc type", validForm(), append(goodFiles(), tfile{"doc_evil", "x.pdf", pdfBytes}), "doc_evil")
	bad("dup resume", validForm(), append(goodFiles(), tfile{"doc_resume", "x.pdf", pdfBytes}), "doc_resume")

	// closed job
	doJSON(t, e.r, "PATCH", "/jobs/"+strconv.Itoa(e.job), e.hr, map[string]any{"status": "closed"})
	bad("closed", validForm(), goodFiles(), "ปิดรับสมัคร")
}

func TestApplicantJSONRejectedHRJSONOK(t *testing.T) {
	e := newFormEnv(t)
	w := doJSON(t, e.r, "POST", "/applications", e.ta, map[string]any{"job_id": e.job})
	if w.Code != 400 || !strings.Contains(w.Body.String(), "กรุณากรอกใบสมัคร") {
		t.Fatal(w.Code, w.Body.String())
	}
	var uid int
	database.DB.QueryRow(context.Background(), `SELECT user_id FROM users WHERE email='b@t.com'`).Scan(&uid)
	w = doJSON(t, e.r, "POST", "/applications", e.hr, map[string]any{"job_id": e.job, "user_id": uid})
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
}

func TestMeApplicationForm(t *testing.T) {
	e := newFormEnv(t)
	if w := doJSON(t, e.r, "GET", "/me/application-form", e.ta, nil); w.Code != 404 {
		t.Fatal("expected 404", w.Code)
	}
	if w := submit(t, e.r, e.ta, e.job, validForm(), goodFiles()); w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	job2 := mkJob(t, e.r, e.hr)
	f := validForm()
	f["nickname"] = "second"
	if w := submit(t, e.r, e.ta, job2, f, goodFiles()); w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	w := doJSON(t, e.r, "GET", "/me/application-form", e.ta, nil)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "second") {
		t.Fatal(w.Code, w.Body.String())
	}
	if w := doJSON(t, e.r, "GET", "/me/application-form", e.tb, nil); w.Code != 404 {
		t.Fatal("bob should see none", w.Code)
	}
}
