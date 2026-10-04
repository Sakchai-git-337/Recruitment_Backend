package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log"
	"net/http"
	"strings"

	"backend/database"
	"backend/httperr"
	"backend/models"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

func HashPassword(plain string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	return string(b), err
}

// CheckPassword accepts bcrypt hashes and legacy plaintext (needsRehash=true).
func CheckPassword(stored, plain string) (ok, needsRehash bool) {
	if strings.HasPrefix(stored, "$2") {
		return bcrypt.CompareHashAndPassword([]byte(stored), []byte(plain)) == nil, false
	}
	return stored == plain, stored == plain
}

func newToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func Login(c *gin.Context) {
	var data struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&data); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if data.Password == "" {
		httperr.Respond(c, http.StatusUnauthorized, "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
		return
	}

	var user models.User
	err := database.DB.QueryRow(context.Background(),
		`SELECT user_id, full_name, email, password, COALESCE(phone, ''), role FROM users WHERE email = $1`,
		data.Email,
	).Scan(&user.UserID, &user.FullName, &user.Email, &user.Password, &user.Phone, &user.Role)
	if errors.Is(err, pgx.ErrNoRows) {
		httperr.Respond(c, http.StatusUnauthorized, "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
		return
	}
	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	ok, rehash := CheckPassword(user.Password, data.Password)
	if !ok {
		httperr.Respond(c, http.StatusUnauthorized, "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
		return
	}
	if rehash {
		h, err := HashPassword(data.Password)
		if err == nil {
			_, err = database.DB.Exec(context.Background(),
				`UPDATE users SET password = $1 WHERE user_id = $2`, h, user.UserID)
		}
		if err != nil {
			log.Println("legacy password rehash failed:", err)
		}
	}

	tok, err := newToken()
	if err == nil {
		_, err = database.DB.Exec(context.Background(),
			`INSERT INTO sessions (token, user_id) VALUES ($1, $2)`, tok, user.UserID)
	}
	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	if _, err := database.DB.Exec(context.Background(),
		`DELETE FROM sessions WHERE expires_at < now()`); err != nil {
		log.Println("purge expired sessions failed:", err)
	}

	user.Password = ""
	c.JSON(http.StatusOK, gin.H{"token": tok, "user": user})
}

func Logout(c *gin.Context) {
	tok, _ := c.Get("token")
	if _, err := database.DB.Exec(context.Background(),
		`DELETE FROM sessions WHERE token = $1`, tok); err != nil {
		httperr.RespondDB(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ออกจากระบบแล้ว"})
}
