package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"backend/database"
	"backend/httperr"
	"backend/middleware"
	"backend/models"
	"github.com/gin-gonic/gin"
)

func validTestResult(s string) bool {
	return s == "pass" || s == "fail" || s == "pending"
}

func CreateWorkTest(c *gin.Context) {
	var test models.WorkTest

	if err := c.ShouldBindJSON(&test); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	// assigned_by always comes from the token, never the body
	test.AssignedBy = middleware.CurrentUser(c).UserID

	if test.ApplicationID == 0 || test.TestDate.IsZero() {
		httperr.Respond(c, http.StatusBadRequest, "ต้องระบุ application_id และ test_date")
		return
	}

	if test.TestResult == "" {
		test.TestResult = "pending"
	}
	if !validTestResult(test.TestResult) {
		httperr.Respond(c, http.StatusBadRequest, "test_result ไม่ถูกต้อง")
		return
	}

	err := database.DB.QueryRow(
		context.Background(),
		`
		INSERT INTO work_tests (application_id, assigned_by, test_date, test_result, test_note)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING test_id
		`,
		test.ApplicationID,
		test.AssignedBy,
		test.TestDate,
		test.TestResult,
		test.TestNote,
	).Scan(&test.TestID)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusCreated, test)
}

func GetWorkTests(c *gin.Context) {
	query := `
		SELECT test_id, application_id, assigned_by,
		       test_date, test_result, test_note
		FROM work_tests
		WHERE 1=1`
	args := []any{}
	if v := c.Query("application_id"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			httperr.Respond(c, http.StatusBadRequest, "application_id ไม่ถูกต้อง")
			return
		}
		args = append(args, n)
		query += " AND application_id = $1"
	}

	rows, err := database.DB.Query(context.Background(), query+" ORDER BY test_id", args...)
	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	defer rows.Close()

	tests := []models.WorkTest{}

	for rows.Next() {
		var test models.WorkTest

		err := rows.Scan(
			&test.TestID,
			&test.ApplicationID,
			&test.AssignedBy,
			&test.TestDate,
			&test.TestResult,
			&test.TestNote,
		)

		if err != nil {
			httperr.RespondDB(c, err)
			return
		}

		tests = append(tests, test)
	}

	if err := rows.Err(); err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusOK, tests)
}

func GetWorkTestByID(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	var test models.WorkTest

	err := database.DB.QueryRow(
		context.Background(),
		`
		SELECT test_id, application_id, assigned_by,
		       test_date, test_result, test_note
		FROM work_tests
		WHERE test_id = $1
		`,
		id,
	).Scan(
		&test.TestID,
		&test.ApplicationID,
		&test.AssignedBy,
		&test.TestDate,
		&test.TestResult,
		&test.TestNote,
	)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusOK, test)
}

func UpdateWorkTest(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	var data struct {
		TestDate   *time.Time `json:"test_date"`
		TestResult *string    `json:"test_result"`
		TestNote   *string    `json:"test_note"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if data.TestDate == nil && data.TestResult == nil && data.TestNote == nil {
		httperr.Respond(c, http.StatusBadRequest, "ต้องระบุ test_date, test_result หรือ test_note")
		return
	}

	if data.TestResult != nil && !validTestResult(*data.TestResult) {
		httperr.Respond(c, http.StatusBadRequest, "test_result ไม่ถูกต้อง")
		return
	}

	result, err := database.DB.Exec(
		context.Background(),
		`
		UPDATE work_tests
		SET test_date = COALESCE($1, test_date),
			test_result = COALESCE($2, test_result),
			test_note = COALESCE($3, test_note)
		WHERE test_id = $4
		`,
		data.TestDate,
		data.TestResult,
		data.TestNote,
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
		"message": "Work test updated successfully",
	})
}

func DeleteWorkTest(c *gin.Context) {
	deleteByID(c, "work_tests", "test_id", "Work test deleted successfully")
}
