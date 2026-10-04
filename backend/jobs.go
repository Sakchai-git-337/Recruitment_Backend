package main

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type Job struct {
	JobID       int    `json:"job_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Requirement string `json:"requirement"`
	Location    string `json:"location"`
	Status      string `json:"status"`
	CreatedBy   int    `json:"created_by"`
}

func getJobs(c *gin.Context) {
	search := c.Query("search")

	query := `
		SELECT job_id, title, description, requirement, location, status, created_by
		FROM jobs
	`

	var rows pgx.Rows
	var err error

	if search == "" {
		query += ` ORDER BY job_id`

		rows, err = db.Query(
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

		rows, err = db.Query(
			context.Background(),
			query,
			"%"+search+"%",
		)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	defer rows.Close()

	var jobs []Job

	for rows.Next() {
		var j Job

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
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
			return
		}

		jobs = append(jobs, j)
	}

	c.JSON(http.StatusOK, jobs)
}

func getJobByID(c *gin.Context) {
	id := c.Param("id")

	var job Job

	err := db.QueryRow(
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
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Job not found",
		})
		return
	}

	c.JSON(http.StatusOK, job)
}

func createJob(c *gin.Context) {
	var job Job

	if err := c.ShouldBindJSON(&job); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if job.Title == "" ||
		job.Description == "" ||
		job.Requirement == "" ||
		job.Location == "" ||
		job.Status == "" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "All fields are required",
		})
		return
	}

	if job.Status != "open" && job.Status != "closed" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid status",
		})
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

	err := db.QueryRow(
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
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, job)
}

func deleteJob(c *gin.Context) {
	id := c.Param("id")

	result, err := db.Exec(
		context.Background(),
		"DELETE FROM jobs WHERE job_id = $1",
		id,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Job not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Job deleted successfully",
	})
}

func updateJob(c *gin.Context) {
	id := c.Param("id")

	var data struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Requirement string `json:"requirement"`
		Location    string `json:"location"`
		Status      string `json:"status"`
		CreatedBy   int    `json:"created_by"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	var job Job

	err := db.QueryRow(
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
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Job not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, job)
}
