package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"backend/database"
	"backend/httperr"
	"backend/middleware"
	"backend/models"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

func validInterviewStatus(s string) bool {
	return s == "scheduled" || s == "completed" || s == "cancelled"
}

const interviewSelect = `
	SELECT i.interview_id, i.application_id, i.interviewer_id,
	       i.interview_date::text, i.interview_time::text,
	       i.status, i.result, i.note
	FROM interviews i
	JOIN applications a ON a.application_id = i.application_id
`

func scanInterview(row pgx.Row, iv *models.Interview) error {
	return row.Scan(&iv.InterviewID, &iv.ApplicationID, &iv.InterviewerID,
		&iv.InterviewDate, &iv.InterviewTime, &iv.Status, &iv.Result, &iv.Note)
}

func CreateInterview(c *gin.Context) {
	var interview models.Interview

	if err := c.ShouldBindJSON(&interview); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	// interviewer_id always comes from the token, never the body
	interview.InterviewerID = middleware.CurrentUser(c).UserID

	if interview.ApplicationID == 0 ||
		interview.InterviewDate == "" ||
		interview.InterviewTime == "" ||
		interview.Status == "" {

		httperr.Respond(c, http.StatusBadRequest, "ต้องระบุ application_id, interview_date, interview_time และ status")
		return
	}

	if !validInterviewStatus(interview.Status) {
		httperr.Respond(c, http.StatusBadRequest, "status ของการสัมภาษณ์ไม่ถูกต้อง")
		return
	}

	err := database.DB.QueryRow(
		context.Background(),
		`
		INSERT INTO interviews (
			application_id, interviewer_id, interview_date, interview_time,
			status, result, note
		)
		VALUES ($1, $2, $3::date, $4::time, $5, $6, $7)
		RETURNING interview_id
		`,
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
	query := interviewSelect + " WHERE 1=1"
	args := []any{}
	add := func(col string, val any) {
		args = append(args, val)
		query += fmt.Sprintf(" AND %s = $%d", col, len(args))
	}

	if v := c.Query("application_id"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			httperr.Respond(c, http.StatusBadRequest, "application_id ไม่ถูกต้อง")
			return
		}
		add("i.application_id", n)
	}

	hr := middleware.IsHR(c)
	if !hr {
		add("a.user_id", middleware.CurrentUser(c).UserID)
	}

	rows, err := database.DB.Query(context.Background(), query+" ORDER BY i.interview_id", args...)
	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	defer rows.Close()

	interviews := []models.Interview{}

	for rows.Next() {
		var interview models.Interview
		if err := scanInterview(rows, &interview); err != nil {
			httperr.RespondDB(c, err)
			return
		}
		if !hr {
			interview.Result, interview.Note = "", ""
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

	query := interviewSelect + " WHERE i.interview_id = $1"
	args := []any{id}
	hr := middleware.IsHR(c)
	if !hr {
		query += " AND a.user_id = $2"
		args = append(args, middleware.CurrentUser(c).UserID)
	}

	var interview models.Interview
	if err := scanInterview(database.DB.QueryRow(context.Background(), query, args...), &interview); err != nil {
		httperr.RespondDB(c, err)
		return
	}
	if !hr {
		interview.Result, interview.Note = "", ""
	}

	c.JSON(http.StatusOK, interview)
}

func UpdateInterview(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	var data struct {
		InterviewDate *string `json:"interview_date"`
		InterviewTime *string `json:"interview_time"`
		Status        *string `json:"status"`
		Result        *string `json:"result"`
		Note          *string `json:"note"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if data.InterviewDate == nil && data.InterviewTime == nil && data.Status == nil &&
		data.Result == nil && data.Note == nil {
		httperr.Respond(c, http.StatusBadRequest, "ไม่มีข้อมูลที่ต้องแก้ไข")
		return
	}

	if data.Status != nil && !validInterviewStatus(*data.Status) {
		httperr.Respond(c, http.StatusBadRequest, "status ของการสัมภาษณ์ไม่ถูกต้อง")
		return
	}

	// a malformed date/time fails the ::date/::time cast and RespondDB maps it to 400
	result, err := database.DB.Exec(
		context.Background(),
		`
		UPDATE interviews
		SET interview_date = COALESCE($1::date, interview_date),
			interview_time = COALESCE($2::time, interview_time),
			status = COALESCE($3, status),
			result = COALESCE($4, result),
			note = COALESCE($5, note)
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

func DeleteInterview(c *gin.Context) {
	deleteByID(c, "interviews", "interview_id", "Interview deleted successfully")
}
