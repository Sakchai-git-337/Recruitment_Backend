package handlers

import (
	"context"
	"net/http"

	"backend/database"
	"backend/httperr"
	"backend/middleware"
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

	if !middleware.IsHR(c) && middleware.CurrentUser(c).UserID != id {
		httperr.Respond(c, http.StatusForbidden, "forbidden")
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
	var in struct {
		FullName string `json:"full_name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Phone    string `json:"phone"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}
	if in.FullName == "" || in.Email == "" || in.Password == "" || in.Phone == "" {
		httperr.Respond(c, http.StatusBadRequest, "กรุณากรอกข้อมูลให้ครบ")
		return
	}
	hash, err := HashPassword(in.Password)
	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	// role ถูกบังคับเป็น applicant เสมอ
	user := models.User{FullName: in.FullName, Email: in.Email, Phone: in.Phone, Role: "applicant"}
	err = database.DB.QueryRow(
		context.Background(),
		`INSERT INTO users (full_name, email, password, phone, role)
		 VALUES ($1, $2, $3, $4, 'applicant') RETURNING user_id`,
		in.FullName, in.Email, hash, in.Phone,
	).Scan(&user.UserID)
	if err != nil {
		if httperr.IsUniqueViolation(err) {
			httperr.Respond(c, http.StatusConflict, "อีเมลนี้ถูกใช้แล้ว")
			return
		}
		httperr.RespondDB(c, err)
		return
	}
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
		FullName *string `json:"full_name"`
		Email    *string `json:"email"`
		Password *string `json:"password"`
		Phone    *string `json:"phone"`
		Role     *string `json:"role"`
	}
	if err := c.ShouldBindJSON(&data); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if !middleware.IsHR(c) && (middleware.CurrentUser(c).UserID != id || data.Role != nil) {
		httperr.Respond(c, http.StatusForbidden, "forbidden")
		return
	}

	for _, f := range []*string{data.FullName, data.Email, data.Password, data.Phone, data.Role} {
		if f != nil && *f == "" {
			httperr.Respond(c, http.StatusBadRequest, "ห้ามเว้นว่าง")
			return
		}
	}
	if data.Role != nil && *data.Role != "applicant" && *data.Role != "recruitment" {
		httperr.Respond(c, http.StatusBadRequest, "role ไม่ถูกต้อง")
		return
	}
	if data.Password != nil {
		h, err := HashPassword(*data.Password)
		if err != nil {
			httperr.RespondDB(c, err)
			return
		}
		data.Password = &h
	}

	var user models.User
	err := database.DB.QueryRow(
		context.Background(),
		`UPDATE users
		 SET full_name = COALESCE($1, full_name),
		     email     = COALESCE($2, email),
		     password  = COALESCE($3, password),
		     phone     = COALESCE($4, phone),
		     role      = COALESCE($5, role)
		 WHERE user_id = $6
		 RETURNING user_id, full_name, email, phone, role`,
		data.FullName, data.Email, data.Password, data.Phone, data.Role, id,
	).Scan(&user.UserID, &user.FullName, &user.Email, &user.Phone, &user.Role)
	if err != nil {
		if httperr.IsUniqueViolation(err) {
			httperr.Respond(c, http.StatusConflict, "อีเมลนี้ถูกใช้แล้ว")
			return
		}
		httperr.RespondDB(c, err)
		return
	}
	c.JSON(http.StatusOK, user)
}
