package models

type Interview struct {
	InterviewID   int    `json:"interview_id"`
	ApplicationID int    `json:"application_id"`
	InterviewerID int    `json:"interviewer_id"`
	InterviewDate string `json:"interview_date"`
	InterviewTime string `json:"interview_time"`
	Status        string `json:"status"`
	Result        string `json:"result"`
	Note          string `json:"note"`
}
