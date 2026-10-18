package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"registryui/internal/activity"
	"registryui/internal/registry"
)

var (
	nameRe   = regexp.MustCompile(`^[a-z0-9]+(?:(?:\.|_|__|-+)[a-z0-9]+)*(?:/[a-z0-9]+(?:(?:\.|_|__|-+)[a-z0-9]+)*)*$`)
	tagRe    = regexp.MustCompile(`^[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127}$`)
	digestRe = regexp.MustCompile(`^[A-Za-z0-9_+.-]+:[0-9a-fA-F]{32,}$`)
)

func (s *Server) handleAPIIndex(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"endpoints": []string{
			"GET    /api/health",
			"GET    /api/auth/status",
			"POST   /api/auth/setup",
			"POST   /api/auth/login",
			"POST   /api/auth/logout",
			"POST   /api/events   (registry notifications)",
			"GET    /api/activity?n=&repo=",
			"GET    /api/storage",
			"GET    /api/catalog",
			"GET    /api/repositories/{name}/tags",
			"GET    /api/repositories/{name}/manifests/{ref}",
			"DELETE /api/repositories/{name}/manifests/{digest}",
		},
	})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	if err := s.svc.Ping(ctx); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"ok":      false,
			"registry": s.cfg.RegistryURL,
			"error":   err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "registry": s.cfg.RegistryURL})
}

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"registryPublicUrl": s.cfg.RegistryPublicURL,
		"version":           s.version,
	})
}

func (s *Server) handleCatalog(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()
	entries, err := s.svc.Catalog(ctx)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"repositories": entries, "count": len(entries)})
}

// handleRepositories routes /api/repositories/{name}/tags and
// /api/repositories/{name}/manifests/{ref}. Repository names may contain
// slashes, so the path is parsed manually.
func (s *Server) handleRepositories(w http.ResponseWriter, r *http.Request) {
	p := strings.TrimPrefix(r.URL.Path, "/api/repositories/")
	p = strings.Trim(p, "/")
	if p == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	if strings.HasSuffix(p, "/tags") {
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		name := strings.TrimSuffix(p, "/tags")
		if !nameRe.MatchString(name) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid repository name"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
		defer cancel()
		sum, err := s.svc.Repo(ctx, name)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, sum)
		return
	}

	if i := strings.Index(p, "/manifests/"); i >= 0 {
		name := p[:i]
		ref := p[i+len("/manifests/"):]
		if !nameRe.MatchString(name) || !validRef(ref) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid repository name or reference"})
			return
		}

		switch r.Method {
		case http.MethodGet:
			ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
			defer cancel()
			info, err := s.svc.Manifest(ctx, name, ref)
			if err != nil {
				writeError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, info)

		case http.MethodDelete:
			if !digestRe.MatchString(ref) {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error": "deletion requires a manifest digest (sha256:...), not a tag",
				})
				return
			}
			if err := s.svc.DeleteManifest(r.Context(), name, ref); err != nil {
				writeError(w, err)
				return
			}
			// Registry 2.8 does not emit delete notifications, so record a
			// synthetic event attributed to the logged-in user.
			actor := "registry-ui"
			if user, ok := s.currentUser(r); ok && user != "" {
				actor += "/" + user
			}
			s.svc.RecordEvents([]activity.Event{{
				ID:         activity.NewID(),
				Timestamp:  time.Now(),
				Action:     "delete",
				Repository: name,
				Digest:     ref,
				UserAgent:  actor,
			}})
			writeJSON(w, http.StatusOK, map[string]bool{"ok": true})

		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		}
		return
	}

	writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
}

func validRef(ref string) bool {
	return digestRe.MatchString(ref) || tagRe.MatchString(ref)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, err error) {
	var regErr *registry.Error
	status := http.StatusBadGateway
	if errors.As(err, &regErr) {
		status = regErr.StatusCode
	}
	writeJSON(w, status, map[string]string{"error": err.Error()})
}
