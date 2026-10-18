package httpapi

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"registryui/internal/activity"
)

// handleEvents receives registry notification events (POSTed by the
// Distribution `notifications:` endpoint). Requests must carry the shared
// secret header configured on the registry side.
func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	if s.cfg.EventSecret != "" && r.Header.Get("X-Registry-Event") != s.cfg.EventSecret {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "invalid event secret"})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)
	var payload struct {
		Events []struct {
			ID        string    `json:"id"`
			Timestamp time.Time `json:"timestamp"`
			Action    string    `json:"action"`
			Target    struct {
				MediaType  string `json:"mediaType"`
				Digest     string `json:"digest"`
				Repository string `json:"repository"`
				Tag        string `json:"tag"`
			} `json:"target"`
			Request struct {
				Addr      string `json:"addr"`
				UserAgent string `json:"useragent"`
			} `json:"request"`
		} `json:"events"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}

	events := make([]activity.Event, 0, len(payload.Events))
	for _, e := range payload.Events {
		if !activity.IsManifestEvent(e.Target.MediaType) {
			continue // skip blob-level traffic
		}
		events = append(events, activity.Event{
			ID:         e.ID,
			Timestamp:  e.Timestamp,
			Action:     e.Action,
			Repository: e.Target.Repository,
			Tag:        e.Target.Tag,
			Digest:     e.Target.Digest,
			MediaType:  e.Target.MediaType,
			UserAgent:  e.Request.UserAgent,
			Addr:       e.Request.Addr,
		})
	}
	recorded := s.svc.RecordEvents(events)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "recorded": recorded})
}

func (s *Server) handleActivity(w http.ResponseWriter, r *http.Request) {
	n := 50
	if v := r.URL.Query().Get("n"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil {
			n = parsed
		}
	}
	if n < 1 {
		n = 1
	}
	if n > 200 {
		n = 200
	}
	repo := r.URL.Query().Get("repo")
	events := s.svc.Activity(n, repo)
	if events == nil {
		events = []activity.Event{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"events": events, "count": len(events)})
}

func (s *Server) handleStorage(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.svc.StorageStats())
}
