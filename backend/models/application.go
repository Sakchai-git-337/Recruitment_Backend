package models

import "time"

type Application struct {
	ApplicationID int       `json:"application_id"`
	UserID        int       `json:"user_id"`
	JobID         int       `json:"job_id"`
	ApplyDate     time.Time `json:"apply_date"`
	Status        string    `json:"status"`
	Note          string    `json:"note"`
}
