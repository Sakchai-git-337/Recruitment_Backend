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
		SELECT user_id, full_name, email, COALESCE(phone, ''), role
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
		SELECT user_id, full_name, email, COALESCE(phone, ''), role
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

func CreateUser(c *gin.Context) { createUser(c, false) }

// AdminCreateUser lets HR create a user with role applicant|recruitment.
func AdminCreateUser(c *gin.Context) { createUser(c, true) }

func createUser(c *gin.Context, admin bool) {
	var in struct {
		FullName string `json:"full_name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Phone    string `json:"phone"`
		Role     string `json:"role"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}
	if in.FullName == "" || in.Email == "" || in.Password == "" || in.Phone == "" {
		httperr.Respond(c, http.StatusBadRequest, "กรุณากรอกข้อมูลให้ครบ")
		return
	}
	role := "applicant" // public signup is always applicant
	if admin {
		role = in.Role
		if role != "applicant" && role != "recruitment" {
			httperr.Respond(c, http.StatusBadRequest, "role ไม่ถูกต้อง")
			return
		}
	}
	if len(in.Password) > 72 {
		httperr.Respond(c, http.StatusBadRequest, "รหัสผ่านยาวเกินไป")
		return
	}
	hash, err := HashPassword(in.Password)
	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	user := models.User{FullName: in.FullName, Email: in.Email, Phone: in.Phone, Role: role}
	err = database.DB.QueryRow(
		context.Background(),
		`INSERT INTO users (full_name, email, password, phone, role)
		 VALUES ($1, $2, $3, $4, $5) RETURNING user_id`,
		in.FullName, in.Email, hash, in.Phone, role,
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
	if middleware.CurrentUser(c).UserID == id {
		httperr.Respond(c, http.StatusBadRequest, "ไม่สามารถลบบัญชีของตัวเองได้")
		return
	}

	// jobs/screenings/interviews/work_tests cascade from their HR owner; refuse instead of wiping them.
	var blocked bool
	if err := database.DB.QueryRow(context.Background(),
		`SELECT EXISTS (SELECT 1 FROM users WHERE user_id = $1 AND role = 'recruitment')
		     OR EXISTS (SELECT 1 FROM jobs WHERE created_by = $1)
		     OR EXISTS (SELECT 1 FROM screenings WHERE screened_by = $1)
		     OR EXISTS (SELECT 1 FROM interviews WHERE interviewer_id = $1)
		     OR EXISTS (SELECT 1 FROM work_tests WHERE assigned_by = $1)`, id).Scan(&blocked); err != nil {
		httperr.RespondDB(c, err)
		return
	}
	if blocked {
		httperr.Respond(c, http.StatusConflict, "ไม่สามารถลบผู้ใช้ที่เป็น Recruitment หรือมีข้อมูลตำแหน่งงาน/การคัดเลือกได้ ให้เปลี่ยนสิทธิ์แทน")
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

	if data.Role != nil && middleware.CurrentUser(c).UserID == id {
		httperr.Respond(c, http.StatusBadRequest, "ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้")
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
		if len(*data.Password) > 72 {
			httperr.Respond(c, http.StatusBadRequest, "รหัสผ่านยาวเกินไป")
			return
		}
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
		 RETURNING user_id, full_name, email, COALESCE(phone, ''), role`,
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
	if data.Password != nil {
		// keep only the caller's own session; HR changing it drops all of the user's sessions
		keep := ""
		if middleware.CurrentUser(c).UserID == id {
			keep = c.GetString("token")
		}
		if _, err := database.DB.Exec(context.Background(),
			`DELETE FROM sessions WHERE user_id = $1 AND token <> $2`, id, keep); err != nil {
			httperr.RespondDB(c, err)
			return
		}
	}
	c.JSON(http.StatusOK, user)
}
