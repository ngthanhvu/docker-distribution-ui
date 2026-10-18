package config

import (
	"os"
	"path/filepath"
	"strconv"
	"time"
)

// Config holds all runtime configuration, sourced from environment variables.
type Config struct {
	ListenAddr        string        // address the API server listens on
	RegistryURL       string        // internal address of the Docker registry (Distribution) API
	RegistryPublicURL string        // public address shown in the UI for push/pull commands
	RegistryUsername  string        // optional basic-auth username for the registry
	RegistryPassword  string        // optional basic-auth password for the registry
	CacheTTL          time.Duration // TTL of the in-memory response cache
	DataDir           string        // persistent data dir (auth + activity history)
	AuthFile          string        // path of the admin credential file
	AuthDisabled      bool          // completely disable UI authentication
	EventSecret       string        // shared secret required on POST /api/events
	StorageRoot       string        // registry data dir mounted read-only ("" disables disk stats)
}

func FromEnv() Config {
	dataDir := env("DATA_DIR", "/data")
	cfg := Config{
		ListenAddr:        env("LISTEN_ADDR", ":8080"),
		RegistryURL:       env("REGISTRY_URL", "http://localhost:5000"),
		RegistryUsername:  os.Getenv("REGISTRY_USERNAME"),
		RegistryPassword:  os.Getenv("REGISTRY_PASSWORD"),
		DataDir:           dataDir,
		AuthFile:          env("AUTH_FILE", filepath.Join(dataDir, "auth.json")),
		AuthDisabled:      envBool("AUTH_DISABLED", false),
		EventSecret:       env("EVENT_SECRET", "dev-registry-events-secret"),
		StorageRoot:       os.Getenv("REGISTRY_STORAGE_DIR"),
		CacheTTL:          30 * time.Second,
	}
	cfg.RegistryPublicURL = env("REGISTRY_PUBLIC_URL", cfg.RegistryURL)
	if d, err := time.ParseDuration(env("CACHE_TTL", "30s")); err == nil {
		cfg.CacheTTL = d
	}
	return cfg
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envBool(key string, def bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return def
}
