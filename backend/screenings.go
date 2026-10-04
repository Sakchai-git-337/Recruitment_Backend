package main

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Screening struct {
	ScreeningID   int       `json:"screening_id"`
	ApplicationID int       `json:"application_id"`
	ScreenedBy    int       `json:"screened_by"`
	Result        string    `json:"result"`
	Note          string    `json:"note"`
	ScreeningDate time.Time `json:"screening_date"`
}

func createScreening(c *gin.Context) {
	var screening Screening

	if err := c.ShouldBindJSON(&screening); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	// ตรวจสอบข้อมูลที่จำเป็น
	if screening.ApplicationID == 0 ||
		screening.ScreenedBy == 0 ||
		screening.Result == "" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "application_id, screened_by and result are required",
		})
		return
	}

	// ตรวจสอบผล Screening
	if screening.Result != "pass" &&
		screening.Result != "fail" &&
		screening.Result != "pending" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid screening result",
		})
		return
	}

	query := `
		INSERT INTO screenings (
			application_id,
			screened_by,
			result,
			note
		)
		VALUES ($1, $2, $3, $4)
		RETURNING screening_id, screening_date
	`

	err := db.QueryRow(
		context.Background(),
		query,
		screening.ApplicationID,
		screening.ScreenedBy,
		screening.Result,
		screening.Note,
	).Scan(
		&screening.ScreeningID,
		&screening.ScreeningDate,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, screening)
}

func getScreenings(c *gin.Context) {
	rows, err := db.Query(
		context.Background(),
		`
		SELECT screening_id, application_id, screened_by,
		       result, note, screening_date
		FROM screenings
		ORDER BY screening_id
		`,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	defer rows.Close()

	var screenings []Screening

	for rows.Next() {
		var screening Screening

		err := rows.Scan(
			&screening.ScreeningID,
			&screening.ApplicationID,
			&screening.ScreenedBy,
			&screening.Result,
			&screening.Note,
			&screening.ScreeningDate,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
			return
		}

		screenings = append(screenings, screening)
	}

	c.JSON(http.StatusOK, screenings)
}

func getScreeningByID(c *gin.Context) {
	id := c.Param("id")

	var screening Screening

	err := db.QueryRow(
		context.Background(),
		`
		SELECT screening_id, application_id, screened_by,
		       result, note, screening_date
		FROM screenings
		WHERE screening_id = $1
		`,
		id,
	).Scan(
		&screening.ScreeningID,
		&screening.ApplicationID,
		&screening.ScreenedBy,
		&screening.Result,
		&screening.Note,
		&screening.ScreeningDate,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Screening not found",
		})
		return
	}

	c.JSON(http.StatusOK, screening)
}

func updateScreening(c *gin.Context) {
	id := c.Param("id")

	var data struct {
		Result string `json:"result"`
		Note   string `json:"note"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	if data.Result == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "result is required",
		})
		return
	}

	if data.Result != "pass" &&
		data.Result != "fail" &&
		data.Result != "pending" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid screening result",
		})
		return
	}

	result, err := db.Exec(
		context.Background(),
		`
		UPDATE screenings
		SET result = $1,
			note = $2
		WHERE screening_id = $3
		`,
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
			"error": "Screening not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Screening updated successfully",
	})
}
