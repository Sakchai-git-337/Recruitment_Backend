package handlers

import (
	"context"
	"errors"
	"fmt"
	"mime"
	"net/http"
	"strconv"

	"backend/database"
	"backend/httperr"
	"backend/middleware"
	"backend/models"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

const applicationSelect = `
	SELECT a.application_id, a.user_id, a.job_id, a.apply_date, a.status, a.note, a.rejected_from,
	       u.full_name, u.email, COALESCE(u.phone, ''), j.title,
	       j.status, to_char(j.closing_date, 'YYYY-MM-DD'), j.has_probation
	FROM applications a
	JOIN users u ON u.user_id = a.user_id
	JOIN jobs j ON j.job_id = a.job_id
`

func scanApplication(row pgx.Row, app *models.Application) error {
	return row.Scan(
		&app.ApplicationID,
		&app.UserID,
		&app.JobID,
		&app.ApplyDate,
		&app.Status,
		&app.Note,
		&app.RejectedFrom,
		&app.ApplicantName,
		&app.ApplicantEmail,
		&app.ApplicantPhone,
		&app.JobTitle,
		&app.JobStatus,
		&app.JobClosingDate,
		&app.JobHasProbation,
	)
}

func validApplicationStatus(s string) bool {
	switch s {
	case "pending", "screening", "probation", "interview", "passed", "rejected":
		return true
	}
	return false
}

// checkJobOpen responds and returns false when the job is missing, closed or past its closing date.
func checkJobOpen(c *gin.Context, jobID int) bool {
	var jobStatus string
	var expired bool
	err := database.DB.QueryRow(
		context.Background(),
		"SELECT status, COALESCE(closing_date < (now() AT TIME ZONE 'Asia/Bangkok')::date, false) FROM jobs WHERE job_id = $1",
		jobID,
	).Scan(&jobStatus, &expired)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			httperr.Respond(c, http.StatusNotFound, "ไม่พบตำแหน่งงาน")
			return false
		}
		httperr.RespondDB(c, err)
		return false
	}
	if jobStatus == "closed" || expired {
		httperr.Respond(c, http.StatusBadRequest, "ตำแหน่งนี้ปิดรับสมัครแล้ว")
		return false
	}
	return true
}

func CreateApplication(c *gin.Context) {
	if !middleware.IsHR(c) {
		if mt, _, _ := mime.ParseMediaType(c.GetHeader("Content-Type")); mt == "multipart/form-data" {
			createApplicationMultipart(c)
		} else {
			httperr.Respond(c, http.StatusBadRequest, "กรุณากรอกใบสมัคร")
		}
		return
	}

	var app models.Application

	if err := c.ShouldBindJSON(&app); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if app.JobID == 0 {
		httperr.Respond(c, http.StatusBadRequest, "ต้องระบุ job_id")
		return
	}

	// HR-only path (applicants go through createApplicationMultipart)
	if app.UserID == 0 {
		httperr.Respond(c, http.StatusBadRequest, "ต้องระบุ user_id")
		return
	}
	if app.Status == "" {
		app.Status = "pending"
	}
	if !validApplicationStatus(app.Status) {
		httperr.Respond(c, http.StatusBadRequest, "status ของใบสมัครไม่ถูกต้อง")
		return
	}

	if !checkJobOpen(c, app.JobID) {
		return
	}

	var id int
	err := database.DB.QueryRow(
		context.Background(),
		`
		INSERT INTO applications (user_id, job_id, status, note)
		VALUES ($1, $2, $3, $4)
		RETURNING application_id
		`,
		app.UserID,
		app.JobID,
		app.Status,
		app.Note,
	).Scan(&id)

	if err != nil {
		if httperr.IsUniqueViolation(err) {
			httperr.Respond(c, http.StatusConflict, "สมัครตำแหน่งนี้แล้ว")
			return
		}
		httperr.RespondDB(c, err)
		return
	}

	// re-read so the response carries apply_date and the joined fields
	if err := scanApplication(database.DB.QueryRow(
		context.Background(),
		applicationSelect+" WHERE a.application_id = $1",
		id,
	), &app); err != nil {
		httperr.RespondDB(c, err)
		return
	}
	c.JSON(http.StatusCreated, app)
}

func GetApplications(c *gin.Context) {
	query := applicationSelect + " WHERE 1=1"
	args := []any{}

	add := func(col string, val any) {
		args = append(args, val)
		query += fmt.Sprintf(" AND %s = $%d", col, len(args))
	}

	if status := c.Query("status"); status != "" {
		add("a.status", status)
	}

	for _, f := range []struct{ param, col string }{{"job_id", "a.job_id"}, {"user_id", "a.user_id"}} {
		v := c.Query(f.param)
		if v == "" {
			continue
		}
		n, err := strconv.ParseInt(v, 10, 32)
		if err != nil {
			httperr.Respond(c, http.StatusBadRequest, f.param+" ไม่ถูกต้อง")
			return
		}
		if f.param == "user_id" && !middleware.IsHR(c) {
			continue // applicants are pinned to themselves below
		}
		add(f.col, n)
	}

	hr := middleware.IsHR(c)
	if !hr {
		add("a.user_id", middleware.CurrentUser(c).UserID)
	}

	query += " ORDER BY a.application_id"

	rows, err := database.DB.Query(context.Background(), query, args...)
	if err != nil {
		httperr.RespondDB(c, err)
		return
	}
	defer rows.Close()

	applications := []models.Application{}

	for rows.Next() {
		var app models.Application
		if err := scanApplication(rows, &app); err != nil {
			httperr.RespondDB(c, err)
			return
		}
		if !hr {
			app.Note = ""
		}
		applications = append(applications, app)
	}

	if err := rows.Err(); err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusOK, applications)
}

func GetApplicationByID(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	var app models.Application

	if err := scanApplication(database.DB.QueryRow(
		context.Background(),
		applicationSelect+" WHERE a.application_id = $1",
		id,
	), &app); err != nil {
		httperr.RespondDB(c, err)
		return
	}

	if !middleware.IsHR(c) {
		if app.UserID != middleware.CurrentUser(c).UserID {
			httperr.Respond(c, http.StatusNotFound, "ไม่พบข้อมูล")
			return
		}
		app.Note = ""
	}

	c.JSON(http.StatusOK, app)
}

func UpdateApplication(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	var data struct {
		Status *string `json:"status"`
		Note   *string `json:"note"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if data.Status == nil && data.Note == nil {
		httperr.Respond(c, http.StatusBadRequest, "ต้องระบุ status หรือ note")
		return
	}

	if data.Status != nil && !validApplicationStatus(*data.Status) {
		httperr.Respond(c, http.StatusBadRequest, "status ของใบสมัครไม่ถูกต้อง")
		return
	}

	if data.Status != nil && *data.Status == "probation" {
		var has bool
		err := database.DB.QueryRow(context.Background(),
			`SELECT j.has_probation FROM applications a JOIN jobs j ON j.job_id = a.job_id WHERE a.application_id = $1`, id).Scan(&has)
		if err != nil {
			httperr.RespondDB(c, err)
			return
		}
		if !has {
			httperr.Respond(c, http.StatusBadRequest, "ตำแหน่งงานนี้ไม่มีขั้นทดลองงาน")
			return
		}
	}

	result, err := database.DB.Exec(
		context.Background(),
		`
		UPDATE applications
		SET status = COALESCE($1::text, status),
			note = COALESCE($2, note),
			rejected_from = CASE
				WHEN $1::text = 'rejected' AND status <> 'rejected' THEN status
				WHEN $1::text <> 'rejected' THEN ''
				ELSE rejected_from
			END
		WHERE application_id = $3
		`,
		data.Status,
		data.Note,
		id,
	)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	if result.RowsAffected() == 0 {
		httperr.Respond(c, http.StatusNotFound, "ไม่พบข้อมูล")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Application updated successfully",
	})
}

func DeleteApplication(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	result, err := database.DB.Exec(
		context.Background(),
		"DELETE FROM applications WHERE application_id = $1",
		id,
	)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	if result.RowsAffected() == 0 {
		httperr.Respond(c, http.StatusNotFound, "ไม่พบข้อมูล")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Application deleted successfully",
	})
}
