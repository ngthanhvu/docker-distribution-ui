package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"registryui/internal/activity"
	"registryui/internal/auth"
	"registryui/internal/config"
	"registryui/internal/httpapi"
	"registryui/internal/registry"
	"registryui/internal/service"
	"registryui/internal/tokenauth"
)

var version = "dev"

func main() {
	cfg := config.FromEnv()

	authStore, err := auth.New(cfg.AuthFile, cfg.AuthDisabled)
	if err != nil {
		log.Fatalf("auth: %v", err)
	}

	act := activity.New(cfg.DataDir)
	if err := act.Load(); err != nil {
		log.Printf("activity: load: %v", err)
	}

	var tokens *tokenauth.Signer
	if cfg.TokenAuth {
		tokens, err = tokenauth.LoadOrCreate(cfg.TokenKeyDir, cfg.TokenIssuer)
		if err != nil {
			log.Fatalf("tokenauth: %v", err)
		}
		log.Printf("tokenauth: signing key ready in %s (issuer %q, service %q)", cfg.TokenKeyDir, cfg.TokenIssuer, cfg.TokenService)
	}

	client := registry.NewClient(cfg.RegistryURL, cfg.RegistryUsername, cfg.RegistryPassword)
	client.SetTokenSigner(tokens)
	svc := service.New(client, cfg.CacheTTL, act, cfg.StorageRoot)
	api := httpapi.New(cfg, svc, authStore, tokens, version)

	srv := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           api.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Printf("registry-ui %s listening on %s (registry: %s)", version, cfg.ListenAddr, cfg.RegistryURL)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	log.Println("shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}
