package main

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// corsOrigins reads CORS_ORIGINS (comma-separated), default http://localhost:3000.
func corsOrigins() []string {
	var out []string
	for _, o := range strings.Split(os.Getenv("CORS_ORIGINS"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			out = append(out, o)
		}
	}
	if len(out) == 0 {
		return []string{"http://localhost:3000"}
	}
	return out
}

func setupRouter() *gin.Engine {
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     corsOrigins(),
		AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
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

	return r
}
