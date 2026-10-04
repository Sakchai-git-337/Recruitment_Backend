package models

type User struct {
	UserID   int    `json:"user_id"`
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Password string `json:"password,omitempty"`
	Phone    string `json:"phone"`
	Role     string `json:"role"`
}
