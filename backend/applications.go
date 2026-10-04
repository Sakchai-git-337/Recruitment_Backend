package main

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Application struct {
	ApplicationID int       `json:"application_id"`
	UserID        int       `json:"user_id"`
	JobID         int       `json:"job_id"`
	ApplyDate     time.Time `json:"apply_date"`
	Status        string    `json:"status"`
	Note          string    `json:"note"`
}

func createApplication(c *gin.Context) {
	var app Application

	if err := c.ShouldBindJSON(&app); err != nil {
		respondError(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	// ตรวจสอบข้อมูลที่จำเป็น
	if app.UserID == 0 ||
		app.JobID == 0 ||
		app.Status == "" {

		respondError(c, http.StatusBadRequest, "ต้องระบุ user_id, job_id และ status")
		return
	}

	// ตรวจสอบ status
	if app.Status != "pending" &&
		app.Status != "screening" &&
		app.Status != "interview" &&
		app.Status != "passed" &&
		app.Status != "rejected" {

		respondError(c, http.StatusBadRequest, "status ของใบสมัครไม่ถูกต้อง")
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

	err := db.QueryRow(
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
		respondDBError(c, err)
		return
	}

	c.JSON(http.StatusCreated, app)
}

func getApplications(c *gin.Context) {
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

	rows, err := db.Query(
		context.Background(),
		query,
		args...,
	)

	if err != nil {
		respondDBError(c, err)
		return
	}

	defer rows.Close()

	applications := []Application{}

	for rows.Next() {
		var app Application

		err := rows.Scan(
			&app.ApplicationID,
			&app.UserID,
			&app.JobID,
			&app.ApplyDate,
			&app.Status,
			&app.Note,
		)

		if err != nil {
			respondDBError(c, err)
			return
		}

		applications = append(applications, app)
	}

	if err := rows.Err(); err != nil {
		respondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, applications)
}

func getApplicationByID(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	var app Application

	err := db.QueryRow(
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
		respondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, app)
}

func updateApplication(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	var data struct {
		Status string `json:"status"`
		Note   string `json:"note"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		respondError(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if data.Status == "" {
		respondError(c, http.StatusBadRequest, "ต้องระบุ status")
		return
	}

	if data.Status != "pending" &&
		data.Status != "screening" &&
		data.Status != "interview" &&
		data.Status != "passed" &&
		data.Status != "rejected" {

		respondError(c, http.StatusBadRequest, "status ของใบสมัครไม่ถูกต้อง")
		return
	}

	result, err := db.Exec(
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
		respondDBError(c, err)
		return
	}

	if result.RowsAffected() == 0 {
		respondError(c, http.StatusNotFound, "ไม่พบข้อมูล")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Application updated successfully",
	})
}
