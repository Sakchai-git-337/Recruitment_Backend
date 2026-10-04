package models

import "time"

type WorkTest struct {
	TestID        int       `json:"test_id"`
	ApplicationID int       `json:"application_id"`
	AssignedBy    int       `json:"assigned_by"`
	TestDate      time.Time `json:"test_date"`
	TestResult    string    `json:"test_result"`
	TestNote      string    `json:"test_note"`
}
