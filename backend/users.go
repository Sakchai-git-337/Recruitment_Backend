package main

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type User struct {
	UserID   int    `json:"user_id"`
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Phone    string `json:"phone"`
	Role     string `json:"role"`
}

func loginUser(c *gin.Context) {
	var data struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	// รับข้อมูลจาก Frontend
	if err := c.ShouldBindJSON(&data); err != nil {
		respondError(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	var user User

	// ค้นหา User จาก email
	err := db.QueryRow(
		context.Background(),
		`
		SELECT user_id, full_name, email, password, phone, role
		FROM users
		WHERE email = $1
		`,
		data.Email,
	).Scan(
		&user.UserID,
		&user.FullName,
		&user.Email,
		&user.Password,
		&user.Phone,
		&user.Role,
	)

	// ไม่พบ email
	if err != nil {
		respondError(c, http.StatusUnauthorized, "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
		return
	}

	// ตรวจ password
	if user.Password != data.Password {
		respondError(c, http.StatusUnauthorized, "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
		return
	}

	// ไม่ส่ง password กลับไป
	user.Password = ""

	c.JSON(http.StatusOK, user)
}

func getUsers(c *gin.Context) {
	search := c.Query("search")

	query := `
		SELECT user_id, full_name, email, phone, role
		FROM users
	`

	var rows pgx.Rows
	var err error

	if search == "" {
		query += ` ORDER BY user_id`

		rows, err = db.Query(
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

		rows, err = db.Query(
			context.Background(),
			query,
			"%"+search+"%",
		)
	}

	if err != nil {
		respondDBError(c, err)
		return
	}

	defer rows.Close()

	users := []User{}

	for rows.Next() {
		var user User

		err := rows.Scan(
			&user.UserID,
			&user.FullName,
			&user.Email,
			&user.Phone,
			&user.Role,
		)

		if err != nil {
			respondDBError(c, err)
			return
		}

		users = append(users, user)
	}

	if err := rows.Err(); err != nil {
		respondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, users)
}

func getUserByID(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	var user User

	err := db.QueryRow(
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
		respondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, user)
}

func createUser(c *gin.Context) {
	var user User

	if err := c.ShouldBindJSON(&user); err != nil {
		respondError(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	// ตรวจสอบว่ากรอกข้อมูลครบ
	if user.FullName == "" ||
		user.Email == "" ||
		user.Password == "" ||
		user.Phone == "" ||
		user.Role == "" {

		respondError(c, http.StatusBadRequest, "กรุณากรอกข้อมูลให้ครบ")
		return
	}

	// ตรวจสอบ role
	if user.Role != "applicant" && user.Role != "recruitment" {
		respondError(c, http.StatusBadRequest, "role ไม่ถูกต้อง")
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

	err := db.QueryRow(
		context.Background(),
		query,
		user.FullName,
		user.Email,
		user.Password,
		user.Phone,
		user.Role,
	).Scan(&user.UserID)

	if err != nil {
		respondDBError(c, err)
		return
	}

	// ไม่ส่ง password กลับ
	user.Password = ""

	c.JSON(http.StatusCreated, user)
}

func deleteUser(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	result, err := db.Exec(
		context.Background(),
		"DELETE FROM users WHERE user_id = $1",
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
		"message": "User deleted successfully",
	})
}

func updateUser(c *gin.Context) {
	id, ok := parseID(c)
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
		respondError(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	var user User

	err := db.QueryRow(
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
		respondDBError(c, err)
		return
	}

	// ไม่ส่ง password กลับ
	user.Password = ""

	c.JSON(http.StatusOK, user)
}
