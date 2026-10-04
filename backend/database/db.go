package database

import (
	"context"
	_ "embed"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

var DB *pgxpool.Pool

//go:embed schema.sql
var schemaSQL string

func applySchema(ctx context.Context) error {
	_, err := DB.Exec(ctx, schemaSQL)
	return err
}

func Connect() {
	var err error

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

	DB, err = pgxpool.New(context.Background(), dsn)
	if err != nil {
		log.Fatal("Unable to connect to database:", err)
	}

	err = DB.Ping(context.Background())
	if err != nil {
		log.Fatal("Database ping failed:", err)
	}

	if err := applySchema(context.Background()); err != nil {
		log.Fatal("apply schema: ", err)
	}

	log.Println("Connected to PostgreSQL successfully!")
}
