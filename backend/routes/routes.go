package routes

import (
	"backend/config"
	"backend/handlers"
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func Setup() *gin.Engine {
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     config.CORSOrigins(),
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
	r.GET("/users", handlers.GetUsers)
	r.GET("/users/:id", handlers.GetUserByID)
	r.POST("/users", handlers.CreateUser)
	r.PATCH("/users/:id", handlers.UpdateUser)
	r.DELETE("/users/:id", handlers.DeleteUser)

	// Jobs
	r.GET("/jobs", handlers.GetJobs)
	r.GET("/jobs/:id", handlers.GetJobByID)
	r.PATCH("/jobs/:id", handlers.UpdateJob)
	r.POST("/jobs", handlers.CreateJob)
	r.DELETE("/jobs/:id", handlers.DeleteJob)

	//applications
	r.POST("/applications", handlers.CreateApplication)
	r.GET("/applications", handlers.GetApplications)
	r.GET("/applications/:id", handlers.GetApplicationByID)
	r.PATCH("/applications/:id", handlers.UpdateApplication)

	// Screenings
	r.POST("/screenings", handlers.CreateScreening)
	r.GET("/screenings", handlers.GetScreenings)
	r.GET("/screenings/:id", handlers.GetScreeningByID)
	r.PATCH("/screenings/:id", handlers.UpdateScreening)

	// Interviews
	r.POST("/interviews", handlers.CreateInterview)
	r.GET("/interviews", handlers.GetInterviews)
	r.GET("/interviews/:id", handlers.GetInterviewByID)
	r.PATCH("/interviews/:id", handlers.UpdateInterview)

	// Work Tests
	r.POST("/work-tests", handlers.CreateWorkTest)
	r.GET("/work-tests", handlers.GetWorkTests)
	r.GET("/work-tests/:id", handlers.GetWorkTestByID)
	r.PATCH("/work-tests/:id", handlers.UpdateWorkTest)

	return r
}
