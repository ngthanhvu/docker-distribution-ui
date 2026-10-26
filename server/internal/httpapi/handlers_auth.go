package httpapi

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"strings"
	"time"

	"registryui/internal/auth"
)

func (s *Server) handleAuthStatus(w http.ResponseWriter, r *http.Request) {
	username, ok := s.currentUser(r)
	resp := map[string]any{
		"initialized":   s.auth.Initialized(),
		"authenticated": ok,
		"username":      username,
		"authDisabled":  s.auth.Disabled(),
	}
	if ok {
		if _, createdAt, updatedAt, has := s.auth.AccountInfo(); has {
			if createdAt != "" {
				resp["createdAt"] = createdAt
			}
			if updatedAt != "" {
				resp["passwordUpdatedAt"] = updatedAt
			}
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleAuthSetup(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if !parseAuthBody(w, r, &body) {
		return
	}

	token, cookieTTL, err := s.auth.Setup(body.Username, body.Password)
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrInitialized):
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
		case errors.Is(err, auth.ErrInvalid):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return
	}
	setSessionCookie(w, token, cookieTTL)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "username": body.Username})
}

func (s *Server) handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Remember bool   `json:"remember"`
	}
	if !parseAuthBody(w, r, &body) {
		return
	}

	token, cookieTTL, err := s.auth.Login(body.Username, body.Password, clientIP(r), body.Remember)
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrBlocked):
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": err.Error()})
		case errors.Is(err, auth.ErrNotInitialized):
			writeJSON(w, http.StatusPreconditionFailed, map[string]string{"error": "no admin account exists yet, open the UI to create one"})
		default:
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid username or password"})
		}
		return
	}
	setSessionCookie(w, token, cookieTTL)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "username": body.Username})
}

// handleAuthPassword changes the admin password. The caller must already be
// logged in and must confirm the current password, so an abandoned browser
// session cannot silently take over the account.
func (s *Server) handleAuthPassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if !parseAuthBody(w, r, &body) {
		return
	}

	token, cookieTTL, err := s.auth.ChangePassword(body.CurrentPassword, body.NewPassword)
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrInvalid):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		case errors.Is(err, auth.ErrNotInitialized):
			writeJSON(w, http.StatusPreconditionFailed, map[string]string{"error": "no admin account exists"})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return
	}
	setSessionCookie(w, token, cookieTTL)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil {
		s.auth.Logout(c.Value)
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) currentUser(r *http.Request) (string, bool) {
	if s.auth.Disabled() {
		return "", true
	}
	c, err := r.Cookie(sessionCookie)
	if err != nil {
		return "", false
	}
	username, _, _, ok := s.auth.Validate(c.Value)
	if !ok {
		return "", false
	}
	return username, true
}

// setSessionCookie writes the session cookie. A ttl of zero produces a
// browser-session cookie (gone when the browser closes); a positive ttl
// produces a persistent cookie with that Max-Age.
func setSessionCookie(w http.ResponseWriter, token string, ttl time.Duration) {
	c := &http.Cookie{
		Name:     sessionCookie,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}
	if ttl > 0 {
		c.MaxAge = int(ttl.Seconds())
	}
	http.SetCookie(w, c)
}

func parseAuthBody(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 8<<10)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return false
	}
	return true
}

// clientIP extracts the client address. X-Forwarded-For entries are appended
// by each proxy, so the last entry is the address our trusted nginx saw.
func clientIP(r *http.Request) string {
	if xf := r.Header.Get("X-Forwarded-For"); xf != "" {
		parts := strings.Split(xf, ",")
		return strings.TrimSpace(parts[len(parts)-1])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
