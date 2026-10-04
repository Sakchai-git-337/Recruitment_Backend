package routes

import (
	"backend/config"
	"backend/handlers"
	"backend/middleware"
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func Setup() *gin.Engine {
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins: config.CORSOrigins(),
		AllowMethods: []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization"},
	}))

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Recruitment API is running",
		})
	})

	r.POST("/login", handlers.Login)
	r.POST("/users", handlers.CreateUser)
	r.GET("/jobs", handlers.GetJobs)
	r.GET("/jobs/:id", handlers.GetJobByID)

	auth := r.Group("/", middleware.AuthRequired())
	auth.POST("/logout", handlers.Logout)
	auth.GET("/users/:id", handlers.GetUserByID)
	auth.PATCH("/users/:id", handlers.UpdateUser)
	auth.GET("/applications", handlers.GetApplications)
	auth.GET("/applications/:id", handlers.GetApplicationByID)
	auth.POST("/applications", handlers.CreateApplication)
	auth.GET("/applications/:id/form", handlers.GetApplicationForm)
	auth.GET("/applications/:id/documents", handlers.GetApplicationDocuments)
	auth.GET("/documents/:id", handlers.GetDocument)
	auth.GET("/me/application-form", handlers.GetMyApplicationForm)
	auth.GET("/interviews", handlers.GetInterviews)
	auth.GET("/interviews/:id", handlers.GetInterviewByID)

	hr := auth.Group("/", middleware.RequireRole("recruitment"))
	hr.GET("/users", handlers.GetUsers)
	hr.POST("/admin/users", handlers.AdminCreateUser)
	hr.DELETE("/users/:id", handlers.DeleteUser)
	hr.POST("/jobs", handlers.CreateJob)
	hr.PATCH("/jobs/:id", handlers.UpdateJob)
	hr.DELETE("/jobs/:id", handlers.DeleteJob)
	hr.PATCH("/applications/:id", handlers.UpdateApplication)
	hr.DELETE("/applications/:id", handlers.DeleteApplication)
	hr.POST("/screenings", handlers.CreateScreening)
	hr.GET("/screenings", handlers.GetScreenings)
	hr.GET("/screenings/:id", handlers.GetScreeningByID)
	hr.PATCH("/screenings/:id", handlers.UpdateScreening)
	hr.DELETE("/screenings/:id", handlers.DeleteScreening)
	hr.POST("/interviews", handlers.CreateInterview)
	hr.PATCH("/interviews/:id", handlers.UpdateInterview)
	hr.DELETE("/interviews/:id", handlers.DeleteInterview)
	hr.POST("/work-tests", handlers.CreateWorkTest)
	hr.DELETE("/work-tests/:id", handlers.DeleteWorkTest)
	hr.GET("/work-tests", handlers.GetWorkTests)
	hr.GET("/work-tests/:id", handlers.GetWorkTestByID)
	hr.PATCH("/work-tests/:id", handlers.UpdateWorkTest)

	return r
}
