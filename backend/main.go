// Container name : recruitment-postgres
package main

import "os"

func main() {
	initDB()
	defer db.Close()

	r := setupRouter()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r.Run(":" + port)
}
