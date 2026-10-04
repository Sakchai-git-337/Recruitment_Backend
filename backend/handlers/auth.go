package handlers

import (
	"context"
	"net/http"

	"backend/database"
	"backend/httperr"
	"backend/models"

	"github.com/gin-gonic/gin"
)

func Login(c *gin.Context) {
	var data struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	// รับข้อมูลจาก Frontend
	if err := c.ShouldBindJSON(&data); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	var user models.User

	// ค้นหา User จาก email
	err := database.DB.QueryRow(
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
		httperr.Respond(c, http.StatusUnauthorized, "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
		return
	}

	// ตรวจ password
	if user.Password != data.Password {
		httperr.Respond(c, http.StatusUnauthorized, "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
		return
	}

	// ไม่ส่ง password กลับไป
	user.Password = ""

	c.JSON(http.StatusOK, user)
}
