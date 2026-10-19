package httpapi

import (
	"log"
	"net/http"
	"strings"
	"time"

	"registryui/internal/auth"
	"registryui/internal/config"
	"registryui/internal/service"
)

const sessionCookie = "rui_session"

// Server serves the JSON API consumed by the React frontend.
type Server struct {
	cfg     config.Config
	svc     *service.Service
	auth    *auth.Store
	version string
}

func New(cfg config.Config, svc *service.Service, authStore *auth.Store, version string) *Server {
	return &Server{cfg: cfg, svc: svc, auth: authStore, version: version}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", s.handleHealth)
	mux.HandleFunc("GET /api/auth/status", s.handleAuthStatus)
	mux.HandleFunc("POST /api/auth/setup", s.handleAuthSetup)
	mux.HandleFunc("POST /api/auth/login", s.handleAuthLogin)
	mux.HandleFunc("POST /api/auth/logout", s.handleAuthLogout)
	mux.HandleFunc("POST /api/events", s.handleEvents) // called by the registry
	mux.HandleFunc("GET /api/activity", s.handleActivity)
	mux.HandleFunc("GET /api/storage", s.handleStorage)
	mux.HandleFunc("GET /api/config", s.handleConfig)
	mux.HandleFunc("GET /api/catalog", s.handleCatalog)
	mux.HandleFunc("/api/repositories/", s.handleRepositories)
	mux.HandleFunc("GET /api", s.handleAPIIndex)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"service": "registry-ui",
			"version": s.version,
			"api":     "/api",
		})
	})

	return withLogging(withRecover(s.withAuth(mux)))
}

// publicAPI lists endpoints reachable without a session.
var publicAPI = map[string]bool{
	"/api":              true,
	"/api/health":       true,
	"/api/auth/status":  true,
	"/api/auth/setup":   true,
	"/api/auth/login":   true,
	"/api/auth/logout":  true,
	"/api/events":       true, // protected by the shared event secret instead
}

// withAuth requires a valid session for every API endpoint except the
// public ones (health + auth endpoints).
func (s *Server) withAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.auth.Disabled() || !strings.HasPrefix(r.URL.Path, "/api/") || publicAPI[r.URL.Path] {
			next.ServeHTTP(w, r)
			return
		}
		if c, err := r.Cookie(sessionCookie); err == nil {
			if _, cookieTTL, extended, ok := s.auth.Validate(c.Value); ok {
				if extended {
					setSessionCookie(w, c.Value, cookieTTL)
				}
				next.ServeHTTP(w, r)
				return
			}
		}
		w.Header().Set("WWW-Authenticate", "Session")
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(sw, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, sw.status, time.Since(start).Round(time.Millisecond))
	})
}

func withRecover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("panic handling %s %s: %v", r.Method, r.URL.Path, rec)
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
			}
		}()
		next.ServeHTTP(w, r)
	})
}
