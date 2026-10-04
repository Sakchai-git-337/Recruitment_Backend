package handlers

import (
	"context"
	"net/http"

	"backend/database"
	"backend/httperr"
	"backend/models"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

func GetJobs(c *gin.Context) {
	search := c.Query("search")

	query := `
		SELECT job_id, title, description, requirement, location, status, created_by
		FROM jobs
	`

	var rows pgx.Rows
	var err error

	if search == "" {
		query += ` ORDER BY job_id`

		rows, err = database.DB.Query(
			context.Background(),
			query,
		)
	} else {
		query += `
			WHERE title ILIKE $1
			   OR description ILIKE $1
			   OR requirement ILIKE $1
			   OR location ILIKE $1
			ORDER BY job_id
		`

		rows, err = database.DB.Query(
			context.Background(),
			query,
			"%"+search+"%",
		)
	}

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	defer rows.Close()

	jobs := []models.Job{}

	for rows.Next() {
		var j models.Job

		err := rows.Scan(
			&j.JobID,
			&j.Title,
			&j.Description,
			&j.Requirement,
			&j.Location,
			&j.Status,
			&j.CreatedBy,
		)

		if err != nil {
			httperr.RespondDB(c, err)
			return
		}

		jobs = append(jobs, j)
	}

	if err := rows.Err(); err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusOK, jobs)
}

func GetJobByID(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	var job models.Job

	err := database.DB.QueryRow(
		context.Background(),
		`
		SELECT job_id, title, description, requirement, location, status, created_by
		FROM jobs
		WHERE job_id = $1
		`,
		id,
	).Scan(
		&job.JobID,
		&job.Title,
		&job.Description,
		&job.Requirement,
		&job.Location,
		&job.Status,
		&job.CreatedBy,
	)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusOK, job)
}

func CreateJob(c *gin.Context) {
	var job models.Job

	if err := c.ShouldBindJSON(&job); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if job.Title == "" ||
		job.Description == "" ||
		job.Requirement == "" ||
		job.Location == "" ||
		job.Status == "" {

		httperr.Respond(c, http.StatusBadRequest, "กรุณากรอกข้อมูลให้ครบ")
		return
	}

	if job.Status != "open" && job.Status != "closed" {
		httperr.Respond(c, http.StatusBadRequest, "status ไม่ถูกต้อง")
		return
	}

	query := `
		INSERT INTO jobs (
			title,
			description,
			requirement,
			location,
			status,
			created_by
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING job_id
	`

	err := database.DB.QueryRow(
		context.Background(),
		query,
		job.Title,
		job.Description,
		job.Requirement,
		job.Location,
		job.Status,
		job.CreatedBy,
	).Scan(&job.JobID)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusCreated, job)
}

func DeleteJob(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	result, err := database.DB.Exec(
		context.Background(),
		"DELETE FROM jobs WHERE job_id = $1",
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
		"message": "Job deleted successfully",
	})
}

func UpdateJob(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	var data struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Requirement string `json:"requirement"`
		Location    string `json:"location"`
		Status      string `json:"status"`
		CreatedBy   int    `json:"created_by"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	var job models.Job

	err := database.DB.QueryRow(
		context.Background(),
		`
		UPDATE jobs
		SET title = $1,
			description = $2,
			requirement = $3,
			location = $4,
			status = $5,
			created_by = $6
		WHERE job_id = $7
		RETURNING job_id, title, description, requirement, location, status, created_by
		`,
		data.Title,
		data.Description,
		data.Requirement,
		data.Location,
		data.Status,
		data.CreatedBy,
		id,
	).Scan(
		&job.JobID,
		&job.Title,
		&job.Description,
		&job.Requirement,
		&job.Location,
		&job.Status,
		&job.CreatedBy,
	)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusOK, job)
}
