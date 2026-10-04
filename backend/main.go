package main

import (
	"log"

	"backend/config"
	"backend/database"
	"backend/routes"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}
	database.Connect()
	defer database.DB.Close()

	if err := routes.Setup().Run(":" + config.Port()); err != nil {
		log.Fatal(err)
	}
}
