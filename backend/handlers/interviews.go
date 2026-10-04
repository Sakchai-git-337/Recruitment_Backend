package handlers

import (
	"context"
	"net/http"

	"backend/database"
	"backend/httperr"
	"backend/models"
	"github.com/gin-gonic/gin"
)

func CreateInterview(c *gin.Context) {
	var interview models.Interview

	if err := c.ShouldBindJSON(&interview); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if interview.ApplicationID == 0 ||
		interview.InterviewerID == 0 ||
		interview.InterviewDate == "" ||
		interview.InterviewTime == "" ||
		interview.Status == "" {

		httperr.Respond(c, http.StatusBadRequest, "ต้องระบุ application_id, interviewer_id, interview_date, interview_time และ status")
		return
	}

	if interview.Status != "scheduled" &&
		interview.Status != "completed" &&
		interview.Status != "cancelled" {

		httperr.Respond(c, http.StatusBadRequest, "status ของการสัมภาษณ์ไม่ถูกต้อง")
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

	err := database.DB.QueryRow(
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
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusCreated, interview)
}

func GetInterviews(c *gin.Context) {
	rows, err := database.DB.Query(
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
		httperr.RespondDB(c, err)
		return
	}

	defer rows.Close()

	interviews := []models.Interview{}

	for rows.Next() {
		var interview models.Interview

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
			httperr.RespondDB(c, err)
			return
		}

		interviews = append(interviews, interview)
	}

	if err := rows.Err(); err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusOK, interviews)
}

func GetInterviewByID(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	var interview models.Interview

	err := database.DB.QueryRow(
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
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusOK, interview)
}

func UpdateInterview(c *gin.Context) {
	id, ok := httperr.ParseID(c)
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
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if data.InterviewDate == "" ||
		data.InterviewTime == "" ||
		data.Status == "" {

		httperr.Respond(c, http.StatusBadRequest, "ต้องระบุ interview_date, interview_time และ status")
		return
	}

	if data.Status != "scheduled" &&
		data.Status != "completed" &&
		data.Status != "cancelled" {

		httperr.Respond(c, http.StatusBadRequest, "status ของการสัมภาษณ์ไม่ถูกต้อง")
		return
	}

	result, err := database.DB.Exec(
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
		httperr.RespondDB(c, err)
		return
	}

	if result.RowsAffected() == 0 {
		httperr.Respond(c, http.StatusNotFound, "ไม่พบข้อมูล")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Interview updated successfully",
	})
}
