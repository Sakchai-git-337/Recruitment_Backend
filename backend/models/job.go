package models

import "encoding/json"

type Job struct {
	JobID          int     `json:"job_id"`
	Title          string  `json:"title"`
	Description    string  `json:"description"`
	Requirement    string  `json:"requirement"`
	Location       string  `json:"location"`
	Status         string  `json:"status"`
	CreatedBy      int     `json:"created_by"`
	Department     string  `json:"department"`
	EmploymentType string  `json:"employment_type"`
	SalaryMin      *int    `json:"salary_min"`
	SalaryMax      *int    `json:"salary_max"`
	Headcount      int     `json:"headcount"`
	ClosingDate    *string `json:"closing_date"` // "YYYY-MM-DD" or null
	HasProbation   bool    `json:"has_probation"`
	// applicant requirements (nil / "" = none); MinEducation is an education level key, e.g. "bachelor"
	MinAge             *int   `json:"min_age"`
	MinExperienceYears *int   `json:"min_experience_years"`
	MinEducation       string `json:"min_education"`
}

// Optional distinguishes an absent JSON key (Set=false) from an explicit null (Set=true, Value=nil).
type Optional[T any] struct {
	Set   bool
	Value *T
}

func (o *Optional[T]) UnmarshalJSON(b []byte) error {
	o.Set = true
	if string(b) == "null" {
		o.Value = nil
		return nil
	}
	o.Value = new(T)
	return json.Unmarshal(b, o.Value)
}
