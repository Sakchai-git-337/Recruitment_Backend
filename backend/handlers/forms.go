package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"backend/database"
	"backend/httperr"
	"backend/middleware"
	"backend/models"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

const (
	maxFileBytes  = 10 << 20
	maxTotalBytes = 30 << 20
	maxFormBytes  = 1 << 20
	maxFiles      = 15
)

// doc types (spec 6.9); only certificate and other may repeat.
var docTypes = map[string]bool{
	"resume": false, "education": false, "id_card": false, "house_registration": false,
	"work_certificate": false, "payslip": false, "certificate": true,
	"marriage_certificate": false, "name_change": false, "military": false,
	"driving_license": false, "other": true,
}

var requiredDocs = []string{"resume", "education"}

var educationLevels = map[string]bool{
	"primary": true, "lower_secondary": true, "upper_secondary": true, "vocational_cert": true,
	"diploma": true, "bachelor": true, "master_or_higher": true,
}

var phoneRE = regexp.MustCompile(`^[0-9]{9,10}$`)

type upload struct {
	docType, filename, contentType string
	data                           []byte
}

func str(m map[string]any, k string) string {
	s, _ := m[k].(string)
	return strings.TrimSpace(s)
}

func isDate(s string) bool {
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}

func stripSpace(s string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) {
			return -1
		}
		return r
	}, s)
}

// validateForm returns a Thai error message naming the offending key, or "".
func validateForm(f map[string]any) string {
	missing := func(k string) string { return "กรุณากรอก " + k }
	for _, k := range []string{"title_th", "first_name_th", "last_name_th", "date_of_birth",
		"present_address", "present_province", "mobile_phone", "email", "relevant_skills", "signature_name"} {
		if str(f, k) == "" {
			return missing(k)
		}
	}
	if !isDate(str(f, "date_of_birth")) {
		return "date_of_birth ไม่ถูกต้อง"
	}
	if !isDate(str(f, "available_start_date")) {
		return missing("available_start_date")
	}
	if n, ok := f["expected_salary"].(float64); !ok || n <= 0 {
		return missing("expected_salary")
	}
	if !phoneRE.MatchString(str(f, "mobile_phone")) {
		return "mobile_phone ไม่ถูกต้อง"
	}
	if _, ok := f["has_work_experience"].(bool); !ok {
		return missing("has_work_experience")
	}
	if n, ok := f["years_of_experience"].(float64); !ok || n < 0 {
		return missing("years_of_experience")
	}
	edu, _ := f["education"].([]any)
	if len(edu) == 0 {
		return missing("education")
	}
	for _, it := range edu {
		m, _ := it.(map[string]any)
		_, yearOK := m["year_to"].(float64)
		if !educationLevels[str(m, "level")] || str(m, "institute") == "" || !yearOK ||
			str(m, "degree") == "" || str(m, "major") == "" {
			return "education: กรุณากรอก level, institute, year_to, degree, major ให้ครบ"
		}
	}
	if f["pdpa_consent"] != true {
		return "ต้องยอมรับ pdpa_consent"
	}
	if stripSpace(str(f, "signature_name")) != stripSpace(str(f, "first_name_th")+str(f, "last_name_th")) {
		return "signature_name ต้องตรงกับชื่อ-นามสกุล"
	}
	return ""
}

func sanitizeFilename(name string) string {
	name = filepath.Base(strings.ReplaceAll(name, "\\", "/"))
	name = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, name)
	if r := []rune(name); len(r) > 200 {
		name = string(r[:200])
	}
	if name == "" || name == "." || name == ".." || name == "/" {
		return "file"
	}
	return name
}

func createApplicationMultipart(c *gin.Context) {
	bad := func(msg string) { httperr.Respond(c, http.StatusBadRequest, msg) }
	tooBig := func() { bad("ไฟล์ใหญ่เกินไป (สูงสุด 10 MB)") }

	// +1 MB headroom for the form JSON and multipart framing
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxTotalBytes+1<<20)
	if err := c.Request.ParseMultipartForm(8 << 20); err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			tooBig()
		} else {
			bad("ข้อมูลไม่ถูกต้อง")
		}
		return
	}
	defer c.Request.MultipartForm.RemoveAll()
	mf := c.Request.MultipartForm

	jobID, err := strconv.Atoi(strings.TrimSpace(firstValue(mf.Value["job_id"])))
	if err != nil || jobID <= 0 {
		bad("ต้องระบุ job_id")
		return
	}

	raw := firstValue(mf.Value["form"])
	if len(raw) == 0 || len(raw) > maxFormBytes || strings.Contains(raw, `\u0000`) {
		bad("ข้อมูลใบสมัครไม่ถูกต้อง")
		return
	}
	var form map[string]any
	if err := json.Unmarshal([]byte(raw), &form); err != nil || form == nil {
		bad("ข้อมูลใบสมัครไม่ถูกต้อง")
		return
	}
	if msg := validateForm(form); msg != "" {
		bad(msg)
		return
	}

	// collect + validate files
	var files []upload
	have := map[string]int{}
	for field, fhs := range mf.File {
		dt, ok := strings.CutPrefix(field, "doc_")
		if _, known := docTypes[dt]; !ok || !known {
			bad("ไม่รู้จักประเภทเอกสาร " + field)
			return
		}
		if len(fhs) > 1 && !docTypes[dt] {
			bad("อัปโหลด " + field + " ได้เพียงไฟล์เดียว")
			return
		}
		for _, fh := range fhs {
			if len(files) >= maxFiles {
				bad("อัปโหลดได้ไม่เกิน 15 ไฟล์")
				return
			}
			if fh.Size > maxFileBytes {
				tooBig()
				return
			}
			f, err := fh.Open()
			if err != nil {
				bad("ข้อมูลไม่ถูกต้อง")
				return
			}
			data, err := io.ReadAll(io.LimitReader(f, maxFileBytes+1))
			f.Close()
			if err != nil {
				bad("ข้อมูลไม่ถูกต้อง")
				return
			}
			if len(data) > maxFileBytes {
				tooBig()
				return
			}
			ct := http.DetectContentType(data[:min(len(data), 512)])
			if ct != "application/pdf" && ct != "image/jpeg" && ct != "image/png" {
				bad("ไฟล์ต้องเป็น PDF, JPG หรือ PNG")
				return
			}
			files = append(files, upload{dt, sanitizeFilename(fh.Filename), ct, data})
			have[dt]++
		}
	}
	for _, dt := range requiredDocs {
		if have[dt] == 0 {
			bad("กรุณาอัปโหลดเอกสาร doc_" + dt)
			return
		}
	}

	if !checkJobOpen(c, jobID) {
		return
	}

	ctx := context.Background()
	tx, err := database.DB.Begin(ctx)
	if err != nil {
		httperr.RespondDB(c, err)
		return
	}
	defer tx.Rollback(ctx)

	var id int
	err = tx.QueryRow(ctx,
		`INSERT INTO applications (user_id, job_id, status, note) VALUES ($1, $2, 'pending', '') RETURNING application_id`,
		middleware.CurrentUser(c).UserID, jobID).Scan(&id)
	if err != nil {
		if httperr.IsUniqueViolation(err) {
			httperr.Respond(c, http.StatusConflict, "สมัครตำแหน่งนี้แล้ว")
			return
		}
		httperr.RespondDB(c, err)
		return
	}
	if _, err = tx.Exec(ctx,
		`INSERT INTO application_forms (application_id, data, consent_at) VALUES ($1, $2, now())`, id, raw); err != nil {
		httperr.RespondDB(c, err)
		return
	}
	for _, u := range files {
		if _, err = tx.Exec(ctx,
			`INSERT INTO application_documents (application_id, doc_type, filename, content_type, size_bytes, data)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			id, u.docType, u.filename, u.contentType, len(u.data), u.data); err != nil {
			httperr.RespondDB(c, err)
			return
		}
	}
	if err = tx.Commit(ctx); err != nil {
		httperr.RespondDB(c, err)
		return
	}

	var app models.Application
	if err := scanApplication(database.DB.QueryRow(ctx, applicationSelect+" WHERE a.application_id = $1", id), &app); err != nil {
		httperr.RespondDB(c, err)
		return
	}
	app.Note = ""
	c.JSON(http.StatusCreated, app)
}

func firstValue(v []string) string {
	if len(v) == 0 {
		return ""
	}
	return v[0]
}

// visibleApplication reports whether the caller is HR or owns the application;
// otherwise (or when missing) it answers 404 and returns false.
func visibleApplication(c *gin.Context, id int) bool {
	var owner int
	err := database.DB.QueryRow(context.Background(),
		"SELECT user_id FROM applications WHERE application_id = $1", id).Scan(&owner)
	if err != nil {
		httperr.RespondDB(c, err)
		return false
	}
	if !middleware.IsHR(c) && owner != middleware.CurrentUser(c).UserID {
		httperr.Respond(c, http.StatusNotFound, "ไม่พบข้อมูล")
		return false
	}
	return true
}

func noStore(c *gin.Context) { c.Header("Cache-Control", "private, no-store") }

func GetApplicationForm(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok || !visibleApplication(c, id) {
		return
	}
	var f models.ApplicationForm
	if err := database.DB.QueryRow(context.Background(),
		"SELECT data, consent_at FROM application_forms WHERE application_id = $1", id,
	).Scan(&f.Data, &f.ConsentAt); err != nil {
		httperr.RespondDB(c, err)
		return
	}
	noStore(c)
	c.JSON(http.StatusOK, f)
}

func GetMyApplicationForm(c *gin.Context) {
	var f models.ApplicationForm
	if err := database.DB.QueryRow(context.Background(),
		`SELECT f.data, f.consent_at FROM application_forms f
		 JOIN applications a ON a.application_id = f.application_id
		 WHERE a.user_id = $1 ORDER BY f.created_at DESC LIMIT 1`,
		middleware.CurrentUser(c).UserID,
	).Scan(&f.Data, &f.ConsentAt); err != nil {
		httperr.RespondDB(c, err)
		return
	}
	noStore(c)
	c.JSON(http.StatusOK, f)
}

func GetApplicationDocuments(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok || !visibleApplication(c, id) {
		return
	}
	rows, err := database.DB.Query(context.Background(),
		`SELECT document_id, doc_type, filename, content_type, size_bytes, uploaded_at
		 FROM application_documents WHERE application_id = $1 ORDER BY document_id`, id)
	if err != nil {
		httperr.RespondDB(c, err)
		return
	}
	defer rows.Close()
	docs := []models.ApplicationDocument{}
	for rows.Next() {
		var d models.ApplicationDocument
		if err := rows.Scan(&d.DocumentID, &d.DocType, &d.Filename, &d.ContentType, &d.SizeBytes, &d.UploadedAt); err != nil {
			httperr.RespondDB(c, err)
			return
		}
		docs = append(docs, d)
	}
	if err := rows.Err(); err != nil {
		httperr.RespondDB(c, err)
		return
	}
	noStore(c)
	c.JSON(http.StatusOK, docs)
}

func GetDocument(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}
	var (
		owner    int
		filename string
		ct       string
		data     []byte
	)
	if err := database.DB.QueryRow(context.Background(),
		`SELECT a.user_id, d.filename, d.content_type, d.data
		 FROM application_documents d JOIN applications a ON a.application_id = d.application_id
		 WHERE d.document_id = $1`, id).Scan(&owner, &filename, &ct, &data); err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			httperr.RespondDB(c, err)
			return
		}
		httperr.Respond(c, http.StatusNotFound, "ไม่พบข้อมูล")
		return
	}
	if !middleware.IsHR(c) && owner != middleware.CurrentUser(c).UserID {
		httperr.Respond(c, http.StatusNotFound, "ไม่พบข้อมูล")
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename*=UTF-8''%s",
		strings.ReplaceAll(url.QueryEscape(filename), "+", "%20")))
	c.Header("X-Content-Type-Options", "nosniff")
	noStore(c)
	c.DataFromReader(http.StatusOK, int64(len(data)), ct, bytes.NewReader(data), nil)
}
