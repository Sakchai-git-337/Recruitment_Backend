// Container name : recruitment-postgres
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

var db *pgxpool.Pool

type User struct {
	UserID   int    `json:"user_id"`
	FullName string `json:"full_name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Phone    string `json:"phone"`
	Role     string `json:"role"`
}

type Job struct {
	JobID       int    `json:"job_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Requirement string `json:"requirement"`
	Location    string `json:"location"`
	Status      string `json:"status"`
	CreatedBy   int    `json:"created_by"`
}

type Application struct {
	ApplicationID int       `json:"application_id"`
	UserID        int       `json:"user_id"`
	JobID         int       `json:"job_id"`
	ApplyDate     time.Time `json:"apply_date"`
	Status        string    `json:"status"`
	Note          string    `json:"note"`
}

type Screening struct {
	ScreeningID   int       `json:"screening_id"`
	ApplicationID int       `json:"application_id"`
	ScreenedBy    int       `json:"screened_by"`
	Result        string    `json:"result"`
	Note          string    `json:"note"`
	ScreeningDate time.Time `json:"screening_date"`
}

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

type WorkTest struct {
	TestID        int       `json:"test_id"`
	ApplicationID int       `json:"application_id"`
	AssignedBy    int       `json:"assigned_by"`
	TestDate      time.Time `json:"test_date"`
	TestResult    string    `json:"test_result"`
	TestNote      string    `json:"test_note"`
}

func initDB() {
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found")
	}

	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")
	dbSSLMode := os.Getenv("DB_SSLMODE")

	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		dbUser,
		dbPassword,
		dbHost,
		dbPort,
		dbName,
		dbSSLMode,
	)

	db, err = pgxpool.New(context.Background(), dsn)
	if err != nil {
		log.Fatal("Unable to connect to database:", err)
	}

	err = db.Ping(context.Background())
	if err != nil {
		log.Fatal("Database ping failed:", err)
	}

	log.Println("Connected to PostgreSQL successfully!")
}

func main() {
	initDB()
	defer db.Close()

	r := gin.Default()
	r.Use(cors.New(cors.Config{
	AllowOrigins:     []string{"http://localhost:3000"},
	AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
	AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
	AllowCredentials: true,
	}))

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Recruitment API is running",
		})
	})

	// Users
	r.GET("/users", getUsers)
	r.GET("/users/:id", getUserByID)
	r.POST("/users", createUser)
	r.PATCH("/users/:id", updateUser)
	r.DELETE("/users/:id", deleteUser)

	// Jobs
	r.GET("/jobs", getJobs)
	r.GET("/jobs/:id", getJobByID)
	r.PATCH("/jobs/:id", updateJob)
	r.POST("/jobs", createJob)
	r.DELETE("/jobs/:id", deleteJob)

	//applications
	r.POST("/applications", createApplication)
	r.GET("/applications", getApplications)
	r.GET("/applications/:id", getApplicationByID)
	r.PATCH("/applications/:id", updateApplication)

	// Screenings
	r.POST("/screenings", createScreening)
	r.GET("/screenings", getScreenings)
	r.GET("/screenings/:id", getScreeningByID)
	r.PATCH("/screenings/:id", updateScreening)

	// Interviews
	r.POST("/interviews", createInterview)
	r.GET("/interviews", getInterviews)
	r.GET("/interviews/:id", getInterviewByID)
	r.PATCH("/interviews/:id", updateInterview)

	// Work Tests
	r.POST("/work-tests", createWorkTest)
	r.GET("/work-tests", getWorkTests)
	r.GET("/work-tests/:id", getWorkTestByID)
	r.PATCH("/work-tests/:id", updateWorkTest)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r.Run(":" + port)
}

func loginUser(c *gin.Context) {
	var data struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	// รับข้อมูลจาก Frontend
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	var user User

	// ค้นหา User จาก email
	err := db.QueryRow(
		context.Background(),
		`
		SELECT user_id, full_name, email, password, phone, role
		FROM users
		WHERE email = $1
		`,
		data.Email,
	).Scan(
		&user.UserID,
		&user.FullName,
		&user.Email,
		&user.Password,
		&user.Phone,
		&user.Role,
	)

	// ไม่พบ email
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid email or password",
		})
		return
	}

	// ตรวจ password
	if user.Password != data.Password {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid email or password",
		})
		return
	}

	// ไม่ส่ง password กลับไป
	user.Password = ""

	c.JSON(http.StatusOK, user)
}

func getUsers(c *gin.Context) {
	search := c.Query("search")

	query := `
		SELECT user_id, full_name, email, phone, role
		FROM users
	`

	var rows pgx.Rows
	var err error

	if search == "" {
		query += ` ORDER BY user_id`

		rows, err = db.Query(
			context.Background(),
			query,
		)
	} else {
		query += `
			WHERE full_name ILIKE $1
			   OR email ILIKE $1
			   OR phone ILIKE $1
			ORDER BY user_id
		`

		rows, err = db.Query(
			context.Background(),
			query,
			"%"+search+"%",
		)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	defer rows.Close()

	var users []User

	for rows.Next() {
		var user User

		err := rows.Scan(
			&user.UserID,
			&user.FullName,
			&user.Email,
			&user.Phone,
			&user.Role,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
			return
		}

		users = append(users, user)
	}

	c.JSON(http.StatusOK, users)
}

func getUserByID(c *gin.Context) {
	id := c.Param("id")

	var user User

	err := db.QueryRow(
		context.Background(),
		`
		SELECT user_id, full_name, email, phone, role
		FROM users
		WHERE user_id = $1
		`,
		id,
	).Scan(
		&user.UserID,
		&user.FullName,
		&user.Email,
		&user.Phone,
		&user.Role,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "User not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, user)
}

func createUser(c *gin.Context) {
	var user User

	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	// ตรวจสอบว่ากรอกข้อมูลครบ
	if user.FullName == "" ||
		user.Email == "" ||
		user.Password == "" ||
		user.Phone == "" ||
		user.Role == "" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "All fields are required",
		})
		return
	}

	// ตรวจสอบ role
	if user.Role != "applicant" && user.Role != "recruitment" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid role",
		})
		return
	}

	query := `
		INSERT INTO users (
			full_name,
			email,
			password,
			phone,
			role
		)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING user_id
	`

	err := db.QueryRow(
		context.Background(),
		query,
		user.FullName,
		user.Email,
		user.Password,
		user.Phone,
		user.Role,
	).Scan(&user.UserID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	// ไม่ส่ง password กลับ
	user.Password = ""

	c.JSON(http.StatusCreated, user)
}

func deleteUser(c *gin.Context) {
	id := c.Param("id")

	result, err := db.Exec(
		context.Background(),
		"DELETE FROM users WHERE user_id = $1",
		id,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "User not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User deleted successfully",
	})
}

func updateUser(c *gin.Context) {
	id := c.Param("id")

	var data struct {
		FullName string `json:"full_name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Phone    string `json:"phone"`
		Role     string `json:"role"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	var user User

	err := db.QueryRow(
		context.Background(),
		`
		UPDATE users
		SET full_name = $1,
			email = $2,
			password = $3,
			phone = $4,
			role = $5
		WHERE user_id = $6
		RETURNING user_id, full_name, email, password, phone, role
		`,
		data.FullName,
		data.Email,
		data.Password,
		data.Phone,
		data.Role,
		id,
	).Scan(
		&user.UserID,
		&user.FullName,
		&user.Email,
		&user.Password,
		&user.Phone,
		&user.Role,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "User not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	// ไม่ส่ง password กลับ
	user.Password = ""

	c.JSON(http.StatusOK, user)
}

func getJobs(c *gin.Context) {
	search := c.Query("search")

	query := `
		SELECT job_id, title, description, requirement, location, status, created_by
		FROM jobs
	`

	var rows pgx.Rows
	var err error

	if search == "" {
		query += ` ORDER BY job_id`

		rows, err = db.Query(
			context.Background(),
			query,
		)
	} else {
		query += `
			WHERE title ILIKE $1
			   OR description ILIKE $1
			   OR requirement ILIKE $1
			   OR location ILIKE $1
			ORDER BY job_id
		`

		rows, err = db.Query(
			context.Background(),
			query,
			"%"+search+"%",
		)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	defer rows.Close()

	var jobs []Job

	for rows.Next() {
		var j Job

		err := rows.Scan(
			&j.JobID,
			&j.Title,
			&j.Description,
			&j.Requirement,
			&j.Location,
			&j.Status,
			&j.CreatedBy,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
			return
		}

		jobs = append(jobs, j)
	}

	c.JSON(http.StatusOK, jobs)
}

func getJobByID(c *gin.Context) {
	id := c.Param("id")

	var job Job

	err := db.QueryRow(
		context.Background(),
		`
		SELECT job_id, title, description, requirement, location, status, created_by
		FROM jobs
		WHERE job_id = $1
		`,
		id,
	).Scan(
		&job.JobID,
		&job.Title,
		&job.Description,
		&job.Requirement,
		&job.Location,
		&job.Status,
		&job.CreatedBy,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Job not found",
		})
		return
	}

	c.JSON(http.StatusOK, job)
}

func createJob(c *gin.Context) {
	var job Job

	if err := c.ShouldBindJSON(&job); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if job.Title == "" ||
	job.Description == "" ||
	job.Requirement == "" ||
	job.Location == "" ||
	job.Status == "" {

	c.JSON(http.StatusBadRequest, gin.H{
		"error": "All fields are required",
	})
	return
}

if job.Status != "open" && job.Status != "closed" {
	c.JSON(http.StatusBadRequest, gin.H{
		"error": "Invalid status",
	})
	return
}

	query := `
		INSERT INTO jobs (
			title,
			description,
			requirement,
			location,
			status,
			created_by
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING job_id
	`

	err := db.QueryRow(
		context.Background(),
		query,
		job.Title,
		job.Description,
		job.Requirement,
		job.Location,
		job.Status,
		job.CreatedBy,
	).Scan(&job.JobID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, job)
}

func deleteJob(c *gin.Context) {
	id := c.Param("id")

	result, err := db.Exec(
		context.Background(),
		"DELETE FROM jobs WHERE job_id = $1",
		id,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Job not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Job deleted successfully",
	})
}

func updateJob(c *gin.Context) {
	id := c.Param("id")

	var data struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Requirement string `json:"requirement"`
		Location    string `json:"location"`
		Status      string `json:"status"`
		CreatedBy   int    `json:"created_by"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	var job Job

	err := db.QueryRow(
		context.Background(),
		`
		UPDATE jobs
		SET title = $1,
			description = $2,
			requirement = $3,
			location = $4,
			status = $5,
			created_by = $6
		WHERE job_id = $7
		RETURNING job_id, title, description, requirement, location, status, created_by
		`,
		data.Title,
		data.Description,
		data.Requirement,
		data.Location,
		data.Status,
		data.CreatedBy,
		id,
	).Scan(
		&job.JobID,
		&job.Title,
		&job.Description,
		&job.Requirement,
		&job.Location,
		&job.Status,
		&job.CreatedBy,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Job not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, job)
}

func createApplication(c *gin.Context) {
	var app Application

	if err := c.ShouldBindJSON(&app); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	// ตรวจสอบข้อมูลที่จำเป็น
	if app.UserID == 0 ||
		app.JobID == 0 ||
		app.Status == "" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "user_id, job_id and status are required",
		})
		return
	}

	// ตรวจสอบ status
	if app.Status != "pending" &&
		app.Status != "screening" &&
		app.Status != "interview" &&
		app.Status != "passed" &&
		app.Status != "rejected" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid application status",
		})
		return
	}

	query := `
		INSERT INTO applications (
			user_id,
			job_id,
			status,
			note
		)
		VALUES ($1, $2, $3, $4)
		RETURNING application_id, apply_date
	`

	err := db.QueryRow(
		context.Background(),
		query,
		app.UserID,
		app.JobID,
		app.Status,
		app.Note,
	).Scan(
		&app.ApplicationID,
		&app.ApplyDate,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, app)
}

func getApplications(c *gin.Context) {
	status := c.Query("status")
	jobID := c.Query("job_id")
	userID := c.Query("user_id")

	query := `
		SELECT application_id, user_id, job_id, apply_date, status, note
		FROM applications
		WHERE 1=1
	`

	args := []any{}
	argIndex := 1

	// Filter status
	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIndex)
		args = append(args, status)
		argIndex++
	}

	// Filter job_id
	if jobID != "" {
		query += fmt.Sprintf(" AND job_id = $%d", argIndex)
		args = append(args, jobID)
		argIndex++
	}

	// Filter user_id
	if userID != "" {
		query += fmt.Sprintf(" AND user_id = $%d", argIndex)
		args = append(args, userID)
		argIndex++
	}

	query += " ORDER BY application_id"

	rows, err := db.Query(
		context.Background(),
		query,
		args...,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	defer rows.Close()

	var applications []Application

	for rows.Next() {
		var app Application

		err := rows.Scan(
			&app.ApplicationID,
			&app.UserID,
			&app.JobID,
			&app.ApplyDate,
			&app.Status,
			&app.Note,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
			return
		}

		applications = append(applications, app)
	}

	c.JSON(http.StatusOK, applications)
}

func getApplicationByID(c *gin.Context) {
	id := c.Param("id")

	var app Application

	err := db.QueryRow(
		context.Background(),
		`
		SELECT application_id, user_id, job_id, apply_date, status, note
		FROM applications
		WHERE application_id = $1
		`,
		id,
	).Scan(
		&app.ApplicationID,
		&app.UserID,
		&app.JobID,
		&app.ApplyDate,
		&app.Status,
		&app.Note,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Application not found",
		})
		return
	}

	c.JSON(http.StatusOK, app)
}

func updateApplication(c *gin.Context) {
	id := c.Param("id")

	var data struct {
		Status string `json:"status"`
		Note   string `json:"note"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	if data.Status == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "status is required",
		})
		return
	}

	if data.Status != "pending" &&
		data.Status != "screening" &&
		data.Status != "interview" &&
		data.Status != "passed" &&
		data.Status != "rejected" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid application status",
		})
		return
	}

	result, err := db.Exec(
		context.Background(),
		`
		UPDATE applications
		SET status = $1,
			note = $2
		WHERE application_id = $3
		`,
		data.Status,
		data.Note,
		id,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Application not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Application updated successfully",
	})
}

func createScreening(c *gin.Context) {
	var screening Screening

	if err := c.ShouldBindJSON(&screening); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	// ตรวจสอบข้อมูลที่จำเป็น
	if screening.ApplicationID == 0 ||
		screening.ScreenedBy == 0 ||
		screening.Result == "" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "application_id, screened_by and result are required",
		})
		return
	}

	// ตรวจสอบผล Screening
	if screening.Result != "pass" &&
		screening.Result != "fail" &&
		screening.Result != "pending" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid screening result",
		})
		return
	}

	query := `
		INSERT INTO screenings (
			application_id,
			screened_by,
			result,
			note
		)
		VALUES ($1, $2, $3, $4)
		RETURNING screening_id, screening_date
	`

	err := db.QueryRow(
		context.Background(),
		query,
		screening.ApplicationID,
		screening.ScreenedBy,
		screening.Result,
		screening.Note,
	).Scan(
		&screening.ScreeningID,
		&screening.ScreeningDate,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, screening)
}

func getScreenings(c *gin.Context) {
	rows, err := db.Query(
		context.Background(),
		`
		SELECT screening_id, application_id, screened_by,
		       result, note, screening_date
		FROM screenings
		ORDER BY screening_id
		`,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	defer rows.Close()

	var screenings []Screening

	for rows.Next() {
		var screening Screening

		err := rows.Scan(
			&screening.ScreeningID,
			&screening.ApplicationID,
			&screening.ScreenedBy,
			&screening.Result,
			&screening.Note,
			&screening.ScreeningDate,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
			return
		}

		screenings = append(screenings, screening)
	}

	c.JSON(http.StatusOK, screenings)
}

func getScreeningByID(c *gin.Context) {
	id := c.Param("id")

	var screening Screening

	err := db.QueryRow(
		context.Background(),
		`
		SELECT screening_id, application_id, screened_by,
		       result, note, screening_date
		FROM screenings
		WHERE screening_id = $1
		`,
		id,
	).Scan(
		&screening.ScreeningID,
		&screening.ApplicationID,
		&screening.ScreenedBy,
		&screening.Result,
		&screening.Note,
		&screening.ScreeningDate,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Screening not found",
		})
		return
	}

	c.JSON(http.StatusOK, screening)
}

func updateScreening(c *gin.Context) {
	id := c.Param("id")

	var data struct {
		Result string `json:"result"`
		Note   string `json:"note"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	if data.Result == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "result is required",
		})
		return
	}

	if data.Result != "pass" &&
		data.Result != "fail" &&
		data.Result != "pending" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid screening result",
		})
		return
	}

	result, err := db.Exec(
		context.Background(),
		`
		UPDATE screenings
		SET result = $1,
			note = $2
		WHERE screening_id = $3
		`,
		data.Result,
		data.Note,
		id,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Screening not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Screening updated successfully",
	})
}

func createInterview(c *gin.Context) {
	var interview Interview

	if err := c.ShouldBindJSON(&interview); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if interview.ApplicationID == 0 ||
		interview.InterviewerID == 0 ||
		interview.InterviewDate == "" ||
		interview.InterviewTime == "" ||
		interview.Status == "" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "application_id, interviewer_id, interview_date, interview_time and status are required",
		})
		return
	}

	if interview.Status != "scheduled" &&
		interview.Status != "completed" &&
		interview.Status != "cancelled" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid interview status",
		})
		return
	}

	query := `
		INSERT INTO interviews (
			application_id,
			interviewer_id,
			interview_date,
			interview_time,
			status,
			result,
			note
		)
		VALUES ($1, $2, $3::date, $4::time, $5, $6, $7)
		RETURNING interview_id
	`

	err := db.QueryRow(
		context.Background(),
		query,
		interview.ApplicationID,
		interview.InterviewerID,
		interview.InterviewDate,
		interview.InterviewTime,
		interview.Status,
		interview.Result,
		interview.Note,
	).Scan(&interview.InterviewID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, interview)
}

func getInterviews(c *gin.Context) {
	rows, err := db.Query(
		context.Background(),
		`
		SELECT interview_id, application_id, interviewer_id,
       interview_date::text, interview_time::text,
       status, result, note
		FROM interviews
		ORDER BY interview_id
		`,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	defer rows.Close()

	var interviews []Interview

	for rows.Next() {
		var interview Interview

		err := rows.Scan(
			&interview.InterviewID,
			&interview.ApplicationID,
			&interview.InterviewerID,
			&interview.InterviewDate,
			&interview.InterviewTime,
			&interview.Status,
			&interview.Result,
			&interview.Note,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		interviews = append(interviews, interview)
	}

	c.JSON(http.StatusOK, interviews)
}

func getInterviewByID(c *gin.Context) {
	id := c.Param("id")

	var interview Interview

	err := db.QueryRow(
		context.Background(),
		`
		SELECT interview_id, application_id, interviewer_id,
       interview_date::text, interview_time::text,
       status, result, note
		FROM interviews
		WHERE interview_id = $1
		`,
		id,
	).Scan(
		&interview.InterviewID,
		&interview.ApplicationID,
		&interview.InterviewerID,
		&interview.InterviewDate,
		&interview.InterviewTime,
		&interview.Status,
		&interview.Result,
		&interview.Note,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Interview not found"})
		return
	}

	c.JSON(http.StatusOK, interview)
}

func updateInterview(c *gin.Context) {
	id := c.Param("id")

	var data struct {
		InterviewDate string `json:"interview_date"`
		InterviewTime string `json:"interview_time"`
		Status        string `json:"status"`
		Result        string `json:"result"`
		Note          string `json:"note"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	if data.InterviewDate == "" ||
		data.InterviewTime == "" ||
		data.Status == "" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "interview_date, interview_time and status are required",
		})
		return
	}

	if data.Status != "scheduled" &&
		data.Status != "completed" &&
		data.Status != "cancelled" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid interview status",
		})
		return
	}

	result, err := db.Exec(
		context.Background(),
		`
		UPDATE interviews
		SET interview_date = $1::date,
			interview_time = $2::time,
			status = $3,
			result = $4,
			note = $5
		WHERE interview_id = $6
		`,
		data.InterviewDate,
		data.InterviewTime,
		data.Status,
		data.Result,
		data.Note,
		id,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Interview not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Interview updated successfully",
	})
}

func createWorkTest(c *gin.Context) {
	var test WorkTest

	if err := c.ShouldBindJSON(&test); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	if test.ApplicationID == 0 ||
		test.AssignedBy == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "application_id and assigned_by are required",
		})
		return
	}

	query := `
		INSERT INTO work_tests (
			application_id,
			assigned_by,
			test_date,
			test_result,
			test_note
		)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING test_id
	`

	err := db.QueryRow(
		context.Background(),
		query,
		test.ApplicationID,
		test.AssignedBy,
		test.TestDate,
		test.TestResult,
		test.TestNote,
	).Scan(&test.TestID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, test)
}

func getWorkTests(c *gin.Context) {
	rows, err := db.Query(
		context.Background(),
		`
		SELECT test_id, application_id, assigned_by,
		       test_date, test_result, test_note
		FROM work_tests
		ORDER BY test_id
		`,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	defer rows.Close()

	var tests []WorkTest

	for rows.Next() {
		var test WorkTest

		err := rows.Scan(
			&test.TestID,
			&test.ApplicationID,
			&test.AssignedBy,
			&test.TestDate,
			&test.TestResult,
			&test.TestNote,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		tests = append(tests, test)
	}

	c.JSON(http.StatusOK, tests)
}

func getWorkTestByID(c *gin.Context) {
	id := c.Param("id")

	var test WorkTest

	err := db.QueryRow(
		context.Background(),
		`
		SELECT test_id, application_id, assigned_by,
		       test_date, test_result, test_note
		FROM work_tests
		WHERE test_id = $1
		`,
		id,
	).Scan(
		&test.TestID,
		&test.ApplicationID,
		&test.AssignedBy,
		&test.TestDate,
		&test.TestResult,
		&test.TestNote,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Work test not found"})
		return
	}

	c.JSON(http.StatusOK, test)
}

func updateWorkTest(c *gin.Context) {
	id := c.Param("id")

	var data struct {
		TestResult string `json:"test_result"`
		TestNote   string `json:"test_note"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request",
		})
		return
	}

	if data.TestResult == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "test_result is required",
		})
		return
	}

	if data.TestResult != "pass" &&
		data.TestResult != "fail" &&
		data.TestResult != "pending" {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid test result",
		})
		return
	}

	result, err := db.Exec(
		context.Background(),
		`
		UPDATE work_tests
		SET test_result = $1,
			test_note = $2
		WHERE test_id = $3
		`,
		data.TestResult,
		data.TestNote,
		id,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Work test not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Work test updated successfully",
	})
}