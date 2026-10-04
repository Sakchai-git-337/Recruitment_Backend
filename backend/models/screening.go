package models

import "time"

type Screening struct {
	ScreeningID   int       `json:"screening_id"`
	ApplicationID int       `json:"application_id"`
	ScreenedBy    int       `json:"screened_by"`
	Result        string    `json:"result"`
	Note          string    `json:"note"`
	ScreeningDate time.Time `json:"screening_date"`
}
