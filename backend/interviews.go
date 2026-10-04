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
		respondError(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if interview.ApplicationID == 0 ||
		interview.InterviewerID == 0 ||
		interview.InterviewDate == "" ||
		interview.InterviewTime == "" ||
		interview.Status == "" {

		respondError(c, http.StatusBadRequest, "ต้องระบุ application_id, interviewer_id, interview_date, interview_time และ status")
		return
	}

	if interview.Status != "scheduled" &&
		interview.Status != "completed" &&
		interview.Status != "cancelled" {

		respondError(c, http.StatusBadRequest, "status ของการสัมภาษณ์ไม่ถูกต้อง")
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
		respondDBError(c, err)
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
		respondDBError(c, err)
		return
	}

	defer rows.Close()

	interviews := []Interview{}

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
			respondDBError(c, err)
			return
		}

		interviews = append(interviews, interview)
	}

	if err := rows.Err(); err != nil {
		respondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, interviews)
}

func getInterviewByID(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

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
		respondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, interview)
}

func updateInterview(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	var data struct {
		InterviewDate string `json:"interview_date"`
		InterviewTime string `json:"interview_time"`
		Status        string `json:"status"`
		Result        string `json:"result"`
		Note          string `json:"note"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		respondError(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if data.InterviewDate == "" ||
		data.InterviewTime == "" ||
		data.Status == "" {

		respondError(c, http.StatusBadRequest, "ต้องระบุ interview_date, interview_time และ status")
		return
	}

	if data.Status != "scheduled" &&
		data.Status != "completed" &&
		data.Status != "cancelled" {

		respondError(c, http.StatusBadRequest, "status ของการสัมภาษณ์ไม่ถูกต้อง")
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
		respondDBError(c, err)
		return
	}

	if result.RowsAffected() == 0 {
		respondError(c, http.StatusNotFound, "ไม่พบข้อมูล")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Interview updated successfully",
	})
}
