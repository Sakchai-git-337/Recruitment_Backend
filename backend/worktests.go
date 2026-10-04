package main

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type WorkTest struct {
	TestID        int       `json:"test_id"`
	ApplicationID int       `json:"application_id"`
	AssignedBy    int       `json:"assigned_by"`
	TestDate      time.Time `json:"test_date"`
	TestResult    string    `json:"test_result"`
	TestNote      string    `json:"test_note"`
}

func createWorkTest(c *gin.Context) {
	var test WorkTest

	if err := c.ShouldBindJSON(&test); err != nil {
		respondError(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if test.ApplicationID == 0 ||
		test.AssignedBy == 0 {
		respondError(c, http.StatusBadRequest, "ต้องระบุ application_id และ assigned_by")
		return
	}

	query := `
		INSERT INTO work_tests (
			application_id,
			assigned_by,
			test_date,
			test_result,
			test_note
		)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING test_id
	`

	err := db.QueryRow(
		context.Background(),
		query,
		test.ApplicationID,
		test.AssignedBy,
		test.TestDate,
		test.TestResult,
		test.TestNote,
	).Scan(&test.TestID)

	if err != nil {
		respondDBError(c, err)
		return
	}

	c.JSON(http.StatusCreated, test)
}

func getWorkTests(c *gin.Context) {
	rows, err := db.Query(
		context.Background(),
		`
		SELECT test_id, application_id, assigned_by,
		       test_date, test_result, test_note
		FROM work_tests
		ORDER BY test_id
		`,
	)

	if err != nil {
		respondDBError(c, err)
		return
	}

	defer rows.Close()

	tests := []WorkTest{}

	for rows.Next() {
		var test WorkTest

		err := rows.Scan(
			&test.TestID,
			&test.ApplicationID,
			&test.AssignedBy,
			&test.TestDate,
			&test.TestResult,
			&test.TestNote,
		)

		if err != nil {
			respondDBError(c, err)
			return
		}

		tests = append(tests, test)
	}

	if err := rows.Err(); err != nil {
		respondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, tests)
}

func getWorkTestByID(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	var test WorkTest

	err := db.QueryRow(
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
		respondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, test)
}

func updateWorkTest(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	var data struct {
		TestResult string `json:"test_result"`
		TestNote   string `json:"test_note"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		respondError(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if data.TestResult == "" {
		respondError(c, http.StatusBadRequest, "ต้องระบุ test_result")
		return
	}

	if data.TestResult != "pass" &&
		data.TestResult != "fail" &&
		data.TestResult != "pending" {

		respondError(c, http.StatusBadRequest, "test_result ไม่ถูกต้อง")
		return
	}

	result, err := db.Exec(
		context.Background(),
		`
		UPDATE work_tests
		SET test_result = $1,
			test_note = $2
		WHERE test_id = $3
		`,
		data.TestResult,
		data.TestNote,
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
		"message": "Work test updated successfully",
	})
}
