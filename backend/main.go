// Container name : recruitment-postgres
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

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

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Recruitment API is running",
		})
	})

	// Users
	r.GET("/users", getUsers)
	r.GET("/users/:id", getUserByID)
	r.POST("/users", createUser)
	r.DELETE("/users/:id", deleteUser)

	// Jobs
	r.GET("/jobs", getJobs)
	r.GET("/jobs/:id", getJobByID)
	r.POST("/jobs", createJob)
	r.DELETE("/jobs/:id", deleteJob)

	//applications
	r.POST("/applications", createApplication)
	r.GET("/applications", getApplications)
	r.GET("/applications/:id", getApplicationByID)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r.Run(":" + port)
}

func getUsers(c *gin.Context) {
	// สำหรับดูและค้นหาข้อมูล User
	search := c.Query("search")

	query := `
		SELECT user_id, full_name, email, password, phone, role
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
		var u User

		err := rows.Scan(
			&u.UserID,
			&u.FullName,
			&u.Email,
			&u.Password,
			&u.Phone,
			&u.Role,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
			return
		}

		users = append(users, u)
	}

	c.JSON(http.StatusOK, users)
}

func getUserByID(c *gin.Context) {
	id := c.Param("id")

	var user User

	err := db.QueryRow(
		context.Background(),
		`
		SELECT user_id, full_name, email, password, phone, role
		FROM users
		WHERE user_id = $1
		`,
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
		c.JSON(http.StatusNotFound, gin.H{
			"error": "User not found",
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

	c.JSON(http.StatusCreated, user)
}

func deleteUser(c *gin.Context) {
	id := c.Param("id")

	_, err := db.Exec(
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

	c.JSON(http.StatusOK, gin.H{
		"message": "User deleted successfully",
	})
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

	_, err := db.Exec(
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

	c.JSON(http.StatusOK, gin.H{
		"message": "Job deleted successfully",
	})
}

func createApplication(c *gin.Context) {
	var app Application

	if err := c.ShouldBindJSON(&app); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
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

    query := `
        SELECT application_id, user_id, job_id, apply_date, status, note
        FROM applications
    `

    var rows pgx.Rows
    var err error

    if status == "" {
        query += ` ORDER BY application_id`

        rows, err = db.Query(
            context.Background(),
            query,
        )
    } else {
        query += `
            WHERE status = $1
            ORDER BY application_id
        `

        rows, err = db.Query(
            context.Background(),
            query,
            status,
        )
    }

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