package middleware

import (
	"context"
	"net/http"
	"strings"

	"backend/database"
	"backend/models"

	"github.com/gin-gonic/gin"
)

func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		tok, ok := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
		if !ok || tok == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		var u models.User
		err := database.DB.QueryRow(context.Background(),
			`SELECT u.user_id, u.full_name, u.email, u.phone, u.role
			 FROM sessions s JOIN users u ON u.user_id = s.user_id
			 WHERE s.token = $1 AND s.expires_at > now()`, tok,
		).Scan(&u.UserID, &u.FullName, &u.Email, &u.Phone, &u.Role)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Set("user", u)
		c.Set("token", tok)
		c.Next()
	}
}

func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if CurrentUser(c).Role != role {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.Next()
	}
}

func CurrentUser(c *gin.Context) models.User {
	u, _ := c.Get("user")
	user, _ := u.(models.User)
	return user
}

func IsHR(c *gin.Context) bool { return CurrentUser(c).Role == "recruitment" }
