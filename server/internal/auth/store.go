package auth

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	iterations = 600000 // OWASP recommendation for PBKDF2-HMAC-SHA256
	saltSize   = 16
	keyLen     = 32
	sessionTTL = 7 * 24 * time.Hour
	rememberTTL = 30 * 24 * time.Hour // "remember me" sessions
	maxFails    = 10
	failWindow  = 10 * time.Minute
)

var (
	ErrNotInitialized = errors.New("auth is not initialized")
	ErrInitialized     = errors.New("admin account already exists")
	ErrInvalid         = errors.New("invalid username or password")
	ErrBlocked         = errors.New("too many failed login attempts, try again later")
)

var usernameRe = regexp.MustCompile(`^[a-zA-Z0-9._-]{3,32}$`)

// record is the on-disk credential file (JSON, 0600).
type record struct {
	Username   string `json:"username"`
	Algorithm  string `json:"algorithm"`
	Iterations int    `json:"iterations"`
	Salt       string `json:"salt"`
	Hash       string `json:"hash"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at,omitempty"` // last password change
}

type session struct {
	username string
	expires  time.Time
	ttl      time.Duration // full lifetime; also drives the sliding window
	// cookieTTL is the Max-Age for the session cookie. Zero means a
	// browser-session cookie that disappears when the browser closes.
	cookieTTL time.Duration
}

type failEntry struct {
	count int
	first time.Time
}

// Store holds the admin account, active sessions and login throttling.
type Store struct {
	mu        sync.Mutex
	path      string
	disabled  bool
	rec       *record
	sessions  map[string]*session
	failures  map[string]*failEntry
	lastSweep time.Time
}

func New(path string, disabled bool) (*Store, error) {
	s := &Store{
		path:     path,
		disabled: disabled,
		sessions: make(map[string]*session),
		failures: make(map[string]*failEntry),
	}
	if disabled || path == "" {
		return s, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return s, nil // first run: setup screen will appear
		}
		return nil, err
	}
	var rec record
	if err := json.Unmarshal(data, &rec); err != nil {
		return nil, fmt.Errorf("parse auth file %s: %w", path, err)
	}
	if rec.Username == "" || rec.Salt == "" || rec.Hash == "" || rec.Iterations <= 0 {
		return nil, fmt.Errorf("invalid auth file %s", path)
	}
	s.rec = &rec
	return s, nil
}

func (s *Store) Disabled() bool { return s.disabled }

// Initialized reports whether an admin account exists.
func (s *Store) Initialized() bool {
	if s.disabled {
		return true
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.rec != nil
}

func ValidUsername(u string) bool { return usernameRe.MatchString(u) }

func ValidPassword(p string) bool { return len(p) >= 8 && len(p) <= 128 }

// Setup creates the admin account (only allowed on first run) and returns
// a session token so the user is logged in immediately.
func (s *Store) Setup(username, password string) (string, time.Duration, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.disabled {
		return "", 0, ErrInitialized
	}
	if s.rec != nil {
		return "", 0, ErrInitialized
	}
	if !ValidUsername(username) {
		return "", 0, fmt.Errorf("%w: username must be 3-32 characters (letters, digits, . _ -)", ErrInvalid)
	}
	if !ValidPassword(password) {
		return "", 0, fmt.Errorf("%w: password must be 8-128 characters", ErrInvalid)
	}

	salt := make([]byte, saltSize)
	if _, err := rand.Read(salt); err != nil {
		return "", 0, err
	}
	key, err := pbkdf2.Key(sha256.New, password, salt, iterations, keyLen)
	if err != nil {
		return "", 0, err
	}

	s.rec = &record{
		Username:   username,
		Algorithm:  "pbkdf2-sha256",
		Iterations: iterations,
		Salt:       hex.EncodeToString(salt),
		Hash:       hex.EncodeToString(key),
		CreatedAt:  time.Now().UTC().Format(time.RFC3339),
	}
	if err := s.saveLocked(); err != nil {
		s.rec = nil
		return "", 0, err
	}
	return s.newSessionLocked(username, sessionTTL, sessionTTL), sessionTTL, nil
}

// Login verifies credentials and returns a session token plus the cookie
// Max-Age that matches the requested persistence (0 = browser session).
func (s *Store) Login(username, password, ip string, remember bool) (string, time.Duration, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.disabled || s.rec == nil {
		return "", 0, ErrNotInitialized
	}
	if s.blockedLocked(ip) {
		return "", 0, ErrBlocked
	}

	salt, err := hex.DecodeString(s.rec.Salt)
	if err != nil {
		return "", 0, err
	}
	want, err := hex.DecodeString(s.rec.Hash)
	if err != nil {
		return "", 0, err
	}
	key, err := pbkdf2.Key(sha256.New, password, salt, s.rec.Iterations, keyLen)
	if err != nil {
		return "", 0, err
	}

	userOK := subtle.ConstantTimeCompare([]byte(strings.TrimSpace(username)), []byte(s.rec.Username)) == 1
	passOK := subtle.ConstantTimeCompare(key, want) == 1
	if !userOK || !passOK {
		s.recordFailLocked(ip)
		return "", 0, ErrInvalid
	}
	delete(s.failures, ip)
	if remember {
		return s.newSessionLocked(s.rec.Username, rememberTTL, rememberTTL), rememberTTL, nil
	}
	return s.newSessionLocked(s.rec.Username, sessionTTL, 0), 0, nil
}

// CheckCredentials verifies a username/password pair without creating a
// web session. It backs the docker login token endpoint and shares the
// per-IP lockout with the web login.
func (s *Store) CheckCredentials(username, password, ip string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.disabled || s.rec == nil {
		return ErrNotInitialized
	}
	if s.blockedLocked(ip) {
		return ErrBlocked
	}

	salt, err := hex.DecodeString(s.rec.Salt)
	if err != nil {
		return err
	}
	want, err := hex.DecodeString(s.rec.Hash)
	if err != nil {
		return err
	}
	key, err := pbkdf2.Key(sha256.New, password, salt, s.rec.Iterations, keyLen)
	if err != nil {
		return err
	}

	userOK := subtle.ConstantTimeCompare([]byte(strings.TrimSpace(username)), []byte(s.rec.Username)) == 1
	passOK := subtle.ConstantTimeCompare(key, want) == 1
	if !userOK || !passOK {
		s.recordFailLocked(ip)
		return ErrInvalid
	}
	return nil
}

// ChangePassword verifies the current password, replaces it with a new one
// and invalidates every active session. A fresh session token is returned
// so the caller stays logged in with the new credentials.
func (s *Store) ChangePassword(current, newPassword string) (string, time.Duration, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.disabled || s.rec == nil {
		return "", 0, ErrNotInitialized
	}

	salt, err := hex.DecodeString(s.rec.Salt)
	if err != nil {
		return "", 0, err
	}
	want, err := hex.DecodeString(s.rec.Hash)
	if err != nil {
		return "", 0, err
	}
	key, err := pbkdf2.Key(sha256.New, current, salt, s.rec.Iterations, keyLen)
	if err != nil {
		return "", 0, err
	}
	if subtle.ConstantTimeCompare(key, want) != 1 {
		return "", 0, ErrInvalid
	}
	if !ValidPassword(newPassword) {
		return "", 0, fmt.Errorf("%w: new password must be 8-128 characters", ErrInvalid)
	}

	newSalt := make([]byte, saltSize)
	if _, err := rand.Read(newSalt); err != nil {
		return "", 0, err
	}
	newKey, err := pbkdf2.Key(sha256.New, newPassword, newSalt, iterations, keyLen)
	if err != nil {
		return "", 0, err
	}

	old := s.rec
	s.rec = &record{
		Username:   old.Username,
		Algorithm:  "pbkdf2-sha256",
		Iterations: iterations,
		Salt:       hex.EncodeToString(newSalt),
		Hash:       hex.EncodeToString(newKey),
		CreatedAt:  old.CreatedAt,
		UpdatedAt:  time.Now().UTC().Format(time.RFC3339),
	}
	if err := s.saveLocked(); err != nil {
		s.rec = old
		return "", 0, err
	}
	s.sessions = make(map[string]*session)
	return s.newSessionLocked(s.rec.Username, sessionTTL, sessionTTL), sessionTTL, nil
}

// AccountInfo returns the admin username plus the account creation and
// last password change timestamps (RFC3339, empty when unknown).
func (s *Store) AccountInfo() (username, createdAt, updatedAt string, ok bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.disabled || s.rec == nil {
		return "", "", "", false
	}
	return s.rec.Username, s.rec.CreatedAt, s.rec.UpdatedAt, true
}

// Validate checks a session token. It returns the username, the cookie
// Max-Age that should be (re-)applied when the session expiry was extended
// (sliding window), and whether the token is valid.
func (s *Store) Validate(token string) (username string, cookieTTL time.Duration, extended bool, ok bool) {
	if token == "" {
		return "", 0, false, false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.disabled {
		return "", 0, false, true
	}
	sess, found := s.sessions[token]
	if !found || time.Now().After(sess.expires) {
		if found {
			delete(s.sessions, token)
		}
		return "", 0, false, false
	}
	if time.Until(sess.expires) < sess.ttl/4 {
		sess.expires = time.Now().Add(sess.ttl)
		extended = true
	}
	s.sweepLocked()
	return sess.username, sess.cookieTTL, extended, true
}

// Logout removes a session.
func (s *Store) Logout(token string) {
	if token == "" {
		return
	}
	s.mu.Lock()
	delete(s.sessions, token)
	s.mu.Unlock()
}

func (s *Store) newSessionLocked(username string, ttl, cookieTTL time.Duration) string {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		panic("auth: crypto/rand unavailable: " + err.Error())
	}
	token := hex.EncodeToString(buf)
	s.sessions[token] = &session{
		username:  username,
		expires:   time.Now().Add(ttl),
		ttl:       ttl,
		cookieTTL: cookieTTL,
	}
	return token
}

func (s *Store) sweepLocked() {
	if time.Since(s.lastSweep) < time.Minute {
		return
	}
	s.lastSweep = time.Now()
	now := time.Now()
	for tok, sess := range s.sessions {
		if now.After(sess.expires) {
			delete(s.sessions, tok)
		}
	}
	for ip, f := range s.failures {
		if now.Sub(f.first) > failWindow {
			delete(s.failures, ip)
		}
	}
}

func (s *Store) blockedLocked(ip string) bool {
	f, ok := s.failures[ip]
	if !ok {
		return false
	}
	if time.Since(f.first) > failWindow {
		delete(s.failures, ip)
		return false
	}
	return f.count >= maxFails
}

func (s *Store) recordFailLocked(ip string) {
	f, ok := s.failures[ip]
	if !ok || time.Since(f.first) > failWindow {
		s.failures[ip] = &failEntry{count: 1, first: time.Now()}
		return
	}
	f.count++
}

// saveLocked writes the credential file atomically.
func (s *Store) saveLocked() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s.rec, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}
