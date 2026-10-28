package httpapi

import (
	"errors"
	"net/http"
	"time"

	"registryui/internal/activity"
	"registryui/internal/auth"
	"registryui/internal/tokenauth"
)

const tokenTTL = 30 * time.Minute

const maxScopes = 32

func (s *Server) handleToken(w http.ResponseWriter, r *http.Request) {
	if s.tokens == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "token auth is not configured"})
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "GET or POST only"})
		return
	}

	account := r.FormValue("account")
	service := r.FormValue("service")
	var scopes []string
	if r.Method == http.MethodPost {
		if err := r.ParseForm(); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid form body"})
			return
		}
		scopes = r.Form["scope"]
	} else {
		scopes = r.URL.Query()["scope"]
	}
	if len(scopes) > maxScopes {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "too many scopes"})
		return
	}

	ip := clientIP(r)
	access := tokenauth.ParseScopes(scopes)
	anonymous := false
	if s.auth.Disabled() {
		if user, _, ok := r.BasicAuth(); ok && user != "" {
			account = user
		} else if account == "" {
			account = "anonymous"
		}
	} else {
		user, pass, ok := r.BasicAuth()
		if !ok || user == "" {
			if !pullOnly(access) {
				w.Header().Set("WWW-Authenticate", `Basic realm="registry-ui"`)
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
				return
			}
			anonymous = true
			account = "anonymous"
		} else {
			if err := s.auth.CheckCredentials(user, pass, ip); err != nil {
				w.Header().Set("WWW-Authenticate", `Basic realm="registry-ui"`)
				if errors.Is(err, auth.ErrBlocked) {
					writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": err.Error()})
				} else {
					writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid username or password"})
				}
				return
			}
			account = user
		}
	}

	audience := service
	if audience == "" {
		audience = s.cfg.TokenService
	}
	token, err := s.tokens.Mint(account, audience, access, tokenTTL)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to issue token"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"token":      token,
		"access_token": token,
		"expires_in": int(tokenTTL.Seconds()),
		"issued_at":  time.Now().UTC().Format(time.RFC3339),
	})

	if len(scopes) == 0 && !anonymous {
		s.svc.RecordEvents([]activity.Event{{
			ID:        activity.NewID(),
			Timestamp: time.Now().UTC(),
			Action:    "login",
			Account:   account,
			UserAgent: r.UserAgent(),
			Addr:      ip,
		}})
	}
}

func pullOnly(access []tokenauth.Access) bool {
	for _, a := range access {
		for _, act := range a.Actions {
			if act != "pull" {
				return false
			}
		}
	}
	return true
}
