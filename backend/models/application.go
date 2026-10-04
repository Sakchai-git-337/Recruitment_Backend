package models

import "time"

type Application struct {
	ApplicationID int       `json:"application_id"`
	UserID        int       `json:"user_id"`
	JobID         int       `json:"job_id"`
	ApplyDate     time.Time `json:"apply_date"`
	Status        string    `json:"status"`
	Note          string    `json:"note"`

	// read-only, filled by JOIN
	ApplicantName  string `json:"applicant_name"`
	ApplicantEmail string `json:"applicant_email"`
	ApplicantPhone string `json:"applicant_phone"`
	JobTitle       string `json:"job_title"`
}
