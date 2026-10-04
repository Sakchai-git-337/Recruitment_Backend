package handlers

import (
	"context"
	"net/http"

	"backend/database"
	"backend/httperr"
	"backend/models"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

func GetUsers(c *gin.Context) {
	search := c.Query("search")

	query := `
		SELECT user_id, full_name, email, phone, role
		FROM users
	`

	var rows pgx.Rows
	var err error

	if search == "" {
		query += ` ORDER BY user_id`

		rows, err = database.DB.Query(
			context.Background(),
			query,
		)
	} else {
		query += `
			WHERE full_name ILIKE $1
			   OR email ILIKE $1
			   OR phone ILIKE $1
			ORDER BY user_id
		`

		rows, err = database.DB.Query(
			context.Background(),
			query,
			"%"+search+"%",
		)
	}

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	defer rows.Close()

	users := []models.User{}

	for rows.Next() {
		var user models.User

		err := rows.Scan(
			&user.UserID,
			&user.FullName,
			&user.Email,
			&user.Phone,
			&user.Role,
		)

		if err != nil {
			httperr.RespondDB(c, err)
			return
		}

		users = append(users, user)
	}

	if err := rows.Err(); err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusOK, users)
}

func GetUserByID(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	var user models.User

	err := database.DB.QueryRow(
		context.Background(),
		`
		SELECT user_id, full_name, email, phone, role
		FROM users
		WHERE user_id = $1
		`,
		id,
	).Scan(
		&user.UserID,
		&user.FullName,
		&user.Email,
		&user.Phone,
		&user.Role,
	)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusOK, user)
}

func CreateUser(c *gin.Context) {
	var user models.User

	if err := c.ShouldBindJSON(&user); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	// ตรวจสอบว่ากรอกข้อมูลครบ
	if user.FullName == "" ||
		user.Email == "" ||
		user.Password == "" ||
		user.Phone == "" ||
		user.Role == "" {

		httperr.Respond(c, http.StatusBadRequest, "กรุณากรอกข้อมูลให้ครบ")
		return
	}

	// ตรวจสอบ role
	if user.Role != "applicant" && user.Role != "recruitment" {
		httperr.Respond(c, http.StatusBadRequest, "role ไม่ถูกต้อง")
		return
	}

	query := `
		INSERT INTO users (
			full_name,
			email,
			password,
			phone,
			role
		)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING user_id
	`

	err := database.DB.QueryRow(
		context.Background(),
		query,
		user.FullName,
		user.Email,
		user.Password,
		user.Phone,
		user.Role,
	).Scan(&user.UserID)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	// ไม่ส่ง password กลับ
	user.Password = ""

	c.JSON(http.StatusCreated, user)
}

func DeleteUser(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	result, err := database.DB.Exec(
		context.Background(),
		"DELETE FROM users WHERE user_id = $1",
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
		"message": "User deleted successfully",
	})
}

func UpdateUser(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	var data struct {
		FullName string `json:"full_name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Phone    string `json:"phone"`
		Role     string `json:"role"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	var user models.User

	err := database.DB.QueryRow(
		context.Background(),
		`
		UPDATE users
		SET full_name = $1,
			email = $2,
			password = $3,
			phone = $4,
			role = $5
		WHERE user_id = $6
		RETURNING user_id, full_name, email, password, phone, role
		`,
		data.FullName,
		data.Email,
		data.Password,
		data.Phone,
		data.Role,
		id,
	).Scan(
		&user.UserID,
		&user.FullName,
		&user.Email,
		&user.Password,
		&user.Phone,
		&user.Role,
	)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	// ไม่ส่ง password กลับ
	user.Password = ""

	c.JSON(http.StatusOK, user)
}
