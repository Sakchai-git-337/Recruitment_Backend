package handlers

import (
	"context"
	"net/http"
	"strconv"

	"backend/database"
	"backend/httperr"
	"backend/middleware"
	"backend/models"
	"github.com/gin-gonic/gin"
)

func validScreeningResult(s string) bool {
	return s == "pass" || s == "fail" || s == "pending"
}

func CreateScreening(c *gin.Context) {
	var screening models.Screening

	if err := c.ShouldBindJSON(&screening); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	// screened_by always comes from the token, never the body
	screening.ScreenedBy = middleware.CurrentUser(c).UserID

	if screening.ApplicationID == 0 || screening.Result == "" {
		httperr.Respond(c, http.StatusBadRequest, "ต้องระบุ application_id และ result")
		return
	}

	if !validScreeningResult(screening.Result) {
		httperr.Respond(c, http.StatusBadRequest, "result ของการคัดกรองไม่ถูกต้อง")
		return
	}

	err := database.DB.QueryRow(
		context.Background(),
		`
		INSERT INTO screenings (application_id, screened_by, result, note)
		VALUES ($1, $2, $3, $4)
		RETURNING screening_id, screening_date
		`,
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
	query := `
		SELECT screening_id, application_id, screened_by,
		       result, note, screening_date
		FROM screenings
		WHERE 1=1`
	args := []any{}
	if v := c.Query("application_id"); v != "" {
		n, err := strconv.ParseInt(v, 10, 32)
		if err != nil {
			httperr.Respond(c, http.StatusBadRequest, "application_id ไม่ถูกต้อง")
			return
		}
		args = append(args, n)
		query += " AND application_id = $1"
	}

	rows, err := database.DB.Query(context.Background(), query+" ORDER BY screening_id", args...)
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
		Result *string `json:"result"`
		Note   *string `json:"note"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if data.Result == nil && data.Note == nil {
		httperr.Respond(c, http.StatusBadRequest, "ต้องระบุ result หรือ note")
		return
	}

	if data.Result != nil && !validScreeningResult(*data.Result) {
		httperr.Respond(c, http.StatusBadRequest, "result ของการคัดกรองไม่ถูกต้อง")
		return
	}

	result, err := database.DB.Exec(
		context.Background(),
		`
		UPDATE screenings
		SET result = COALESCE($1, result),
			note = COALESCE($2, note)
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

func DeleteScreening(c *gin.Context) {
	deleteByID(c, "screenings", "screening_id", "Screening deleted successfully")
}

// deleteByID: table/col are compile-time constants from callers, never user input.
func deleteByID(c *gin.Context, table, col, msg string) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}
	result, err := database.DB.Exec(context.Background(), "DELETE FROM "+table+" WHERE "+col+" = $1", id)
	if err != nil {
		httperr.RespondDB(c, err)
		return
	}
	if result.RowsAffected() == 0 {
		httperr.Respond(c, http.StatusNotFound, "ไม่พบข้อมูล")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": msg})
}
