package httpapi

import (
	"errors"
	"net/http"
	"time"

	"registryui/internal/activity"
	"registryui/internal/auth"
	"registryui/internal/tokenauth"
)

// tokenTTL is how long a minted bearer token stays valid. Docker clients
// transparently request new tokens when they expire.
const tokenTTL = 30 * time.Minute

// maxScopes caps the number of scope parameters accepted in one token
// request, so a client cannot ask for an unbounded token.
const maxScopes = 32

// handleToken implements the Distribution token auth protocol: docker
// clients call it (with HTTP Basic credentials) after the registry answers
// GET /v2/ with a Bearer challenge. A valid response lets docker login
// succeed; the backend records the login in the activity feed.
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
	if s.auth.Disabled() {
		// No UI account exists (AUTH_DISABLED): grant tokens freely so the
		// registry stays usable in trusted environments.
		if user, _, ok := r.BasicAuth(); ok && user != "" {
			account = user
		} else if account == "" {
			account = "anonymous"
		}
	} else {
		user, pass, ok := r.BasicAuth()
		if !ok || user == "" {
			w.Header().Set("WWW-Authenticate", `Basic realm="registry-ui"`)
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
			return
		}
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

	audience := service
	if audience == "" {
		audience = s.cfg.TokenService
	}
	token, err := s.tokens.Mint(account, audience, tokenauth.ParseScopes(scopes), tokenTTL)
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

	// A token request without scopes is the docker login / session ping:
	// record it as a login event (deduplicated by account+IP in the store).
	if len(scopes) == 0 {
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
