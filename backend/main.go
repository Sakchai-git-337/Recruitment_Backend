package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/jackc/pgx/v5/pgxpool"
)

var db *pgxpool.Pool

type User struct {
	UserID   int    `json:"user_id"`
	FullName string `json:"full_name"`
	Email    string `json:"email"`
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
		dbUser, dbPassword, dbHost, dbPort, dbName, dbSSLMode,
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

	r.GET("/users", getUsers)
	r.GET("/jobs", getJobs)
	r.POST("/jobs", createJob)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r.Run(":" + port)
}

func getUsers(c *gin.Context) {
	rows, err := db.Query(context.Background(), `
		SELECT user_id, full_name, email, phone, role
		FROM users
		ORDER BY user_id
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var users []User

	for rows.Next() {
		var u User
		err := rows.Scan(&u.UserID, &u.FullName, &u.Email, &u.Phone, &u.Role)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		users = append(users, u)
	}

	c.JSON(http.StatusOK, users)
}

func getJobs(c *gin.Context) {
	rows, err := db.Query(context.Background(), `
		SELECT job_id, title, description, requirement, location, status, created_by
		FROM jobs
		ORDER BY job_id
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var jobs []Job

	for rows.Next() {
		var j Job
		err := rows.Scan(&j.JobID, &j.Title, &j.Description, &j.Requirement, &j.Location, &j.Status, &j.CreatedBy)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		jobs = append(jobs, j)
	}

	c.JSON(http.StatusOK, jobs)
}

func createJob(c *gin.Context) {
	var job Job

	if err := c.ShouldBindJSON(&job); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := `
		INSERT INTO jobs (title, description, requirement, location, status, created_by)
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, job)
}