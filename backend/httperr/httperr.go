package httperr

import (
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func Respond(c *gin.Context, status int, msg string) {
	c.JSON(status, gin.H{"error": msg})
}

// RespondDB maps DB errors to HTTP statuses without leaking internals.
func RespondDB(c *gin.Context, err error) {
	if errors.Is(err, pgx.ErrNoRows) {
		Respond(c, http.StatusNotFound, "ไม่พบข้อมูล")
		return
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			Respond(c, http.StatusConflict, "ข้อมูลซ้ำ")
			return
		case "23503", "23514", "22P02", "22007", "22008":
			Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
			return
		}
	}
	log.Println(err)
	Respond(c, http.StatusInternalServerError, "เกิดข้อผิดพลาดภายในระบบ")
}

func IsUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func ParseID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		Respond(c, http.StatusBadRequest, "id ไม่ถูกต้อง")
		return 0, false
	}
	return id, true
}
