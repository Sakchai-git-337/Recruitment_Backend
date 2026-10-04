package handlers

import (
	"context"
	"net/http"
	"time"

	"backend/database"
	"backend/httperr"
	"backend/middleware"
	"backend/models"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

const jobCols = `job_id, title, description, requirement, location, status, created_by,
	department, employment_type, salary_min, salary_max, headcount, to_char(closing_date, 'YYYY-MM-DD')`

func scanJob(row pgx.Row, j *models.Job) error {
	return row.Scan(&j.JobID, &j.Title, &j.Description, &j.Requirement, &j.Location, &j.Status, &j.CreatedBy,
		&j.Department, &j.EmploymentType, &j.SalaryMin, &j.SalaryMax, &j.Headcount, &j.ClosingDate)
}

func validEmploymentType(s string) bool {
	return s == "full_time" || s == "part_time" || s == "contract" || s == "internship"
}

// checkJobExtras validates salary range and headcount; returns false after responding 400.
func checkJobExtras(c *gin.Context, min, max, headcount *int) bool {
	if (min != nil && *min < 0) || (max != nil && *max < 0) ||
		(min != nil && max != nil && *min > *max) {
		httperr.Respond(c, http.StatusBadRequest, "ช่วงเงินเดือนไม่ถูกต้อง")
		return false
	}
	if headcount != nil && *headcount < 1 {
		httperr.Respond(c, http.StatusBadRequest, "จำนวนที่รับต้องไม่น้อยกว่า 1")
		return false
	}
	return true
}

// parseDate parses an optional YYYY-MM-DD string; returns false after responding 400.
func parseDate(c *gin.Context, s *string) (*time.Time, bool) {
	if s == nil {
		return nil, true
	}
	t, err := time.Parse("2006-01-02", *s)
	if err != nil {
		httperr.Respond(c, http.StatusBadRequest, "วันที่ปิดรับสมัครไม่ถูกต้อง")
		return nil, false
	}
	return &t, true
}

func GetJobs(c *gin.Context) {
	search := c.Query("search")

	query := `SELECT ` + jobCols + ` FROM jobs `

	var rows pgx.Rows
	var err error

	if search == "" {
		query += ` ORDER BY job_id`

		rows, err = database.DB.Query(
			context.Background(),
			query,
		)
	} else {
		query += `
			WHERE title ILIKE $1
			   OR description ILIKE $1
			   OR requirement ILIKE $1
			   OR location ILIKE $1
			   OR department ILIKE $1
			ORDER BY job_id
		`

		rows, err = database.DB.Query(
			context.Background(),
			query,
			"%"+search+"%",
		)
	}

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	defer rows.Close()

	jobs := []models.Job{}

	for rows.Next() {
		var j models.Job

		if err := scanJob(rows, &j); err != nil {
			httperr.RespondDB(c, err)
			return
		}

		jobs = append(jobs, j)
	}

	if err := rows.Err(); err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusOK, jobs)
}

func GetJobByID(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	var job models.Job

	err := scanJob(database.DB.QueryRow(
		context.Background(),
		`SELECT `+jobCols+` FROM jobs WHERE job_id = $1`,
		id,
	), &job)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusOK, job)
}

func CreateJob(c *gin.Context) {
	var in struct {
		models.Job
		Headcount *int `json:"headcount"` // shadows Job.Headcount so omitted != 0
	}

	if err := c.ShouldBindJSON(&in); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}
	job := in.Job

	if job.Title == "" ||
		job.Description == "" ||
		job.Requirement == "" ||
		job.Location == "" ||
		job.Status == "" {

		httperr.Respond(c, http.StatusBadRequest, "กรุณากรอกข้อมูลให้ครบ")
		return
	}

	if job.Status != "open" && job.Status != "closed" {
		httperr.Respond(c, http.StatusBadRequest, "status ไม่ถูกต้อง")
		return
	}
	if job.EmploymentType == "" {
		job.EmploymentType = "full_time"
	}
	if !validEmploymentType(job.EmploymentType) {
		httperr.Respond(c, http.StatusBadRequest, "ประเภทการจ้างงานไม่ถูกต้อง")
		return
	}
	if !checkJobExtras(c, job.SalaryMin, job.SalaryMax, in.Headcount) {
		return
	}
	closing, ok := parseDate(c, job.ClosingDate)
	if !ok {
		return
	}
	hc := 1
	if in.Headcount != nil {
		hc = *in.Headcount
	}

	job.CreatedBy = middleware.CurrentUser(c).UserID

	err := scanJob(database.DB.QueryRow(
		context.Background(),
		`INSERT INTO jobs (title, description, requirement, location, status, created_by,
			department, employment_type, salary_min, salary_max, headcount, closing_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING `+jobCols,
		job.Title, job.Description, job.Requirement, job.Location, job.Status, job.CreatedBy,
		job.Department, job.EmploymentType, job.SalaryMin, job.SalaryMax, hc, closing,
	), &job)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusCreated, job)
}

func DeleteJob(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	result, err := database.DB.Exec(
		context.Background(),
		"DELETE FROM jobs WHERE job_id = $1",
		id,
	)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	if result.RowsAffected() == 0 {
		httperr.Respond(c, http.StatusNotFound, "ไม่พบข้อมูล")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Job deleted successfully",
	})
}

func UpdateJob(c *gin.Context) {
	id, ok := httperr.ParseID(c)
	if !ok {
		return
	}

	var data struct {
		Title          *string                 `json:"title"`
		Description    *string                 `json:"description"`
		Requirement    *string                 `json:"requirement"`
		Location       *string                 `json:"location"`
		Status         *string                 `json:"status"`
		Department     *string                 `json:"department"`
		EmploymentType *string                 `json:"employment_type"`
		Headcount      *int                    `json:"headcount"`
		SalaryMin      models.Optional[int]    `json:"salary_min"`
		SalaryMax      models.Optional[int]    `json:"salary_max"`
		ClosingDate    models.Optional[string] `json:"closing_date"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		httperr.Respond(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}

	if data.Title == nil && data.Description == nil && data.Requirement == nil && data.Location == nil && data.Status == nil &&
		data.Department == nil && data.EmploymentType == nil && data.Headcount == nil &&
		!data.SalaryMin.Set && !data.SalaryMax.Set && !data.ClosingDate.Set {
		httperr.Respond(c, http.StatusBadRequest, "ไม่มีข้อมูลที่ต้องแก้ไข")
		return
	}

	for _, f := range []*string{data.Title, data.Description, data.Requirement, data.Location} {
		if f != nil && *f == "" {
			httperr.Respond(c, http.StatusBadRequest, "กรุณากรอกข้อมูลให้ครบ")
			return
		}
	}

	if data.Status != nil && *data.Status != "open" && *data.Status != "closed" {
		httperr.Respond(c, http.StatusBadRequest, "status ไม่ถูกต้อง")
		return
	}
	if data.EmploymentType != nil && !validEmploymentType(*data.EmploymentType) {
		httperr.Respond(c, http.StatusBadRequest, "ประเภทการจ้างงานไม่ถูกต้อง")
		return
	}
	closing, ok := parseDate(c, data.ClosingDate.Value)
	if !ok {
		return
	}

	// validate the salary range as it will be after the update
	var curMin, curMax *int
	err := database.DB.QueryRow(context.Background(),
		`SELECT salary_min, salary_max FROM jobs WHERE job_id = $1`, id).Scan(&curMin, &curMax)
	if err != nil {
		httperr.RespondDB(c, err)
		return
	}
	newMin, newMax := curMin, curMax
	if data.SalaryMin.Set {
		newMin = data.SalaryMin.Value
	}
	if data.SalaryMax.Set {
		newMax = data.SalaryMax.Value
	}
	if !checkJobExtras(c, newMin, newMax, data.Headcount) {
		return
	}

	var job models.Job

	err = scanJob(database.DB.QueryRow(
		context.Background(),
		`
		UPDATE jobs
		SET title = COALESCE($1, title),
			description = COALESCE($2, description),
			requirement = COALESCE($3, requirement),
			location = COALESCE($4, location),
			status = COALESCE($5, status),
			department = COALESCE($6, department),
			employment_type = COALESCE($7, employment_type),
			headcount = COALESCE($8, headcount),
			salary_min = CASE WHEN $9::boolean THEN $10::int ELSE salary_min END,
			salary_max = CASE WHEN $11::boolean THEN $12::int ELSE salary_max END,
			closing_date = CASE WHEN $13::boolean THEN $14::date ELSE closing_date END
		WHERE job_id = $15
		RETURNING `+jobCols,
		data.Title,
		data.Description,
		data.Requirement,
		data.Location,
		data.Status,
		data.Department,
		data.EmploymentType,
		data.Headcount,
		data.SalaryMin.Set, data.SalaryMin.Value,
		data.SalaryMax.Set, data.SalaryMax.Value,
		data.ClosingDate.Set, closing,
		id,
	), &job)

	if err != nil {
		httperr.RespondDB(c, err)
		return
	}

	c.JSON(http.StatusOK, job)
}
