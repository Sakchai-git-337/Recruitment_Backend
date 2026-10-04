package handlers

import (
	"context"
	"fmt"
	"net/http"

	"backend/database"
	"backend/httperr"
	"backend/models"
	"github.com/gin-gonic/gin"
)

func CreateApplication(c *gin.Context) {
	var app models.Application

	if err := c.ShouldBindJSON(&app); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	// ตรวจสอบข้อมูลที่จำเป็น
	if app.UserID == 0 ||
		app.JobID == 0 ||
		app.Status == "" {

		httperr.Respond(c, http.StatusBadRequest, "ต้องระบุ user_id, job_id และ status")
		return
	}

	// ตรวจสอบ status
	if app.Status != "pending" &&
		app.Status != "screening" &&
		app.Status != "interview" &&
		app.Status != "passed" &&
		app.Status != "rejected" {

		httperr.Respond(c, http.StatusBadRequest, "status ของใบสมัครไม่ถูกต้อง")
		return
	}

	query := `
		INSERT INTO applications (
			user_id,
			job_id,
			status,
			note
		)
		VALUES ($1, $2, $3, $4)
		RETURNING application_id, apply_date
	`

	err := database.DB.QueryRow(
		context.Background(),
		query,
		app.UserID,
		app.JobID,
		app.Status,
		app.Note,
	).Scan(
		&app.ApplicationID,
		&app.ApplyDate,
	)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusCreated, app)
}

func GetApplications(c *gin.Context) {
	status := c.Query("status")
	jobID := c.Query("job_id")
	userID := c.Query("user_id")

	query := `
		SELECT application_id, user_id, job_id, apply_date, status, note
		FROM applications
		WHERE 1=1
	`

	args := []any{}
	argIndex := 1

	// Filter status
	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIndex)
		args = append(args, status)
		argIndex++
	}

	// Filter job_id
	if jobID != "" {
		query += fmt.Sprintf(" AND job_id = $%d", argIndex)
		args = append(args, jobID)
		argIndex++
	}

	// Filter user_id
	if userID != "" {
		query += fmt.Sprintf(" AND user_id = $%d", argIndex)
		args = append(args, userID)
		argIndex++
	}

	query += " ORDER BY application_id"

	rows, err := database.DB.Query(
		context.Background(),
		query,
		args...,
	)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	defer rows.Close()

	applications := []models.Application{}

	for rows.Next() {
		var app models.Application

		err := rows.Scan(
			&app.ApplicationID,
			&app.UserID,
			&app.JobID,
			&app.ApplyDate,
			&app.Status,
			&app.Note,
		)

		if err != nil {
			httperr.RespondDB(c, err)
			return
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

	err := database.DB.QueryRow(
		context.Background(),
		`
		SELECT application_id, user_id, job_id, apply_date, status, note
		FROM applications
		WHERE application_id = $1
		`,
		id,
	).Scan(
		&app.ApplicationID,
		&app.UserID,
		&app.JobID,
		&app.ApplyDate,
		&app.Status,
		&app.Note,
	)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusOK, app)
}

func UpdateApplication(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	var data struct {
		Status string `json:"status"`
		Note   string `json:"note"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if data.Status == "" {
		httperr.Respond(c, http.StatusBadRequest, "ต้องระบุ status")
		return
	}

	if data.Status != "pending" &&
		data.Status != "screening" &&
		data.Status != "interview" &&
		data.Status != "passed" &&
		data.Status != "rejected" {

		httperr.Respond(c, http.StatusBadRequest, "status ของใบสมัครไม่ถูกต้อง")
		return
	}

	result, err := database.DB.Exec(
		context.Background(),
		`
		UPDATE applications
		SET status = $1,
			note = $2
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
