package main

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Interview struct {
	InterviewID   int    `json:"interview_id"`
	ApplicationID int    `json:"application_id"`
	InterviewerID int    `json:"interviewer_id"`
	InterviewDate string `json:"interview_date"`
	InterviewTime string `json:"interview_time"`
	Status        string `json:"status"`
	Result        string `json:"result"`
	Note          string `json:"note"`
}

func createInterview(c *gin.Context) {
	var interview Interview

	if err := c.ShouldBindJSON(&interview); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if interview.ApplicationID == 0 ||
		interview.InterviewerID == 0 ||
		interview.InterviewDate == "" ||
		interview.InterviewTime == "" ||
		interview.Status == "" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "application_id, interviewer_id, interview_date, interview_time and status are required",
		})
		return
	}

	if interview.Status != "scheduled" &&
		interview.Status != "completed" &&
		interview.Status != "cancelled" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid interview status",
		})
		return
	}

	query := `
		INSERT INTO interviews (
			application_id,
			interviewer_id,
			interview_date,
			interview_time,
			status,
			result,
			note
		)
		VALUES ($1, $2, $3::date, $4::time, $5, $6, $7)
		RETURNING interview_id
	`

	err := db.QueryRow(
		context.Background(),
		query,
		interview.ApplicationID,
		interview.InterviewerID,
		interview.InterviewDate,
		interview.InterviewTime,
		interview.Status,
		interview.Result,
		interview.Note,
	).Scan(&interview.InterviewID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, interview)
}

func getInterviews(c *gin.Context) {
	rows, err := db.Query(
		context.Background(),
		`
		SELECT interview_id, application_id, interviewer_id,
       interview_date::text, interview_time::text,
       status, result, note
		FROM interviews
		ORDER BY interview_id
		`,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	defer rows.Close()

	var interviews []Interview

	for rows.Next() {
		var interview Interview

		err := rows.Scan(
			&interview.InterviewID,
			&interview.ApplicationID,
			&interview.InterviewerID,
			&interview.InterviewDate,
			&interview.InterviewTime,
			&interview.Status,
			&interview.Result,
			&interview.Note,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		interviews = append(interviews, interview)
	}

	c.JSON(http.StatusOK, interviews)
}

func getInterviewByID(c *gin.Context) {
	id := c.Param("id")

	var interview Interview

	err := db.QueryRow(
		context.Background(),
		`
		SELECT interview_id, application_id, interviewer_id,
       interview_date::text, interview_time::text,
       status, result, note
		FROM interviews
		WHERE interview_id = $1
		`,
		id,
	).Scan(
		&interview.InterviewID,
		&interview.ApplicationID,
		&interview.InterviewerID,
		&interview.InterviewDate,
		&interview.InterviewTime,
		&interview.Status,
		&interview.Result,
		&interview.Note,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Interview not found"})
		return
	}

	c.JSON(http.StatusOK, interview)
}

func updateInterview(c *gin.Context) {
	id := c.Param("id")

	var data struct {
		InterviewDate string `json:"interview_date"`
		InterviewTime string `json:"interview_time"`
		Status        string `json:"status"`
		Result        string `json:"result"`
		Note          string `json:"note"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	if data.InterviewDate == "" ||
		data.InterviewTime == "" ||
		data.Status == "" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "interview_date, interview_time and status are required",
		})
		return
	}

	if data.Status != "scheduled" &&
		data.Status != "completed" &&
		data.Status != "cancelled" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid interview status",
		})
		return
	}

	result, err := db.Exec(
		context.Background(),
		`
		UPDATE interviews
		SET interview_date = $1::date,
			interview_time = $2::time,
			status = $3,
			result = $4,
			note = $5
		WHERE interview_id = $6
		`,
		data.InterviewDate,
		data.InterviewTime,
		data.Status,
		data.Result,
		data.Note,
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
			"error": "Interview not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Interview updated successfully",
	})
}
