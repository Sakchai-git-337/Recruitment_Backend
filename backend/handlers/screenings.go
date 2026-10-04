package handlers

import (
	"context"
	"net/http"

	"backend/database"
	"backend/httperr"
	"backend/models"
	"github.com/gin-gonic/gin"
)

func CreateScreening(c *gin.Context) {
	var screening models.Screening

	if err := c.ShouldBindJSON(&screening); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	// ตรวจสอบข้อมูลที่จำเป็น
	if screening.ApplicationID == 0 ||
		screening.ScreenedBy == 0 ||
		screening.Result == "" {

		httperr.Respond(c, http.StatusBadRequest, "ต้องระบุ application_id, screened_by และ result")
		return
	}

	// ตรวจสอบผล Screening
	if screening.Result != "pass" &&
		screening.Result != "fail" &&
		screening.Result != "pending" {

		httperr.Respond(c, http.StatusBadRequest, "result ของการคัดกรองไม่ถูกต้อง")
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

	err := database.DB.QueryRow(
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
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusCreated, screening)
}

func GetScreenings(c *gin.Context) {
	rows, err := database.DB.Query(
		context.Background(),
		`
		SELECT screening_id, application_id, screened_by,
		       result, note, screening_date
		FROM screenings
		ORDER BY screening_id
		`,
	)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	defer rows.Close()

	screenings := []models.Screening{}

	for rows.Next() {
		var screening models.Screening

		err := rows.Scan(
			&screening.ScreeningID,
			&screening.ApplicationID,
			&screening.ScreenedBy,
			&screening.Result,
			&screening.Note,
			&screening.ScreeningDate,
		)

		if err != nil {
			httperr.RespondDB(c, err)
			return
		}

		screenings = append(screenings, screening)
	}

	if err := rows.Err(); err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusOK, screenings)
}

func GetScreeningByID(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	var screening models.Screening

	err := database.DB.QueryRow(
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
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusOK, screening)
}

func UpdateScreening(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	var data struct {
		Result string `json:"result"`
		Note   string `json:"note"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if data.Result == "" {
		httperr.Respond(c, http.StatusBadRequest, "ต้องระบุ result")
		return
	}

	if data.Result != "pass" &&
		data.Result != "fail" &&
		data.Result != "pending" {

		httperr.Respond(c, http.StatusBadRequest, "result ของการคัดกรองไม่ถูกต้อง")
		return
	}

	result, err := database.DB.Exec(
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
		httperr.RespondDB(c, err)
		return
	}

	if result.RowsAffected() == 0 {
		httperr.Respond(c, http.StatusNotFound, "ไม่พบข้อมูล")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Screening updated successfully",
	})
}
