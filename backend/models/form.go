package models

import (
	"encoding/json"
	"time"
)

type ApplicationForm struct {
	Data      json.RawMessage `json:"data"`
	ConsentAt time.Time       `json:"consent_at"`
}

// ApplicationDocument is metadata only; bytes are served by GET /documents/:id.
type ApplicationDocument struct {
	DocumentID  int       `json:"document_id"`
	DocType     string    `json:"doc_type"`
	Filename    string    `json:"filename"`
	ContentType string    `json:"content_type"`
	SizeBytes   int       `json:"size_bytes"`
	UploadedAt  time.Time `json:"uploaded_at"`
}
