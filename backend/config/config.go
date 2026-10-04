package config

import (
	"os"
	"strings"
)

// Port reads PORT, default 8080.
func Port() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "8080"
}

// CORSOrigins reads CORS_ORIGINS (comma-separated), default http://localhost:3000.
func CORSOrigins() []string {
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
