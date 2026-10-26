// Package tokenauth issues RS256 JWTs that a Docker Distribution registry
// (configured with auth.token) accepts as bearer credentials. It also
// implements the credential-check side of the docker login flow: docker
// clients request a token from this service using HTTP Basic auth.
package tokenauth

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const (
	keyFile  = "token.key"       // RSA private key (backend only, 0600)
	certFile = "token-root.pem"  // self-signed cert the registry trusts (rootcertificates)
	keyBits  = 2048
)

// Access is one granted scope inside a token's access claim.
type Access struct {
	Type    string   `json:"type"`
	Name    string   `json:"name"`
	Actions []string `json:"actions"`
}

// Signer mints registry bearer tokens signed with a persistent RSA key.
type Signer struct {
	key     *rsa.PrivateKey
	certDER []byte // self-signed cert, published in the JWT x5c header
	issuer  string
}

// LoadOrCreate reads (or generates on first run) the signing key and the
// self-signed certificate in dir. The registry must be able to read the
// certificate file, typically via a shared read-only volume mount.
func LoadOrCreate(dir, issuer string) (*Signer, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	key, created, err := loadOrCreateKey(filepath.Join(dir, keyFile))
	if err != nil {
		return nil, err
	}
	certPath := filepath.Join(dir, certFile)
	if created || !fileExists(certPath) {
		if err := writeCert(certPath, key); err != nil {
			return nil, err
		}
	}
	der, err := readCertDER(certPath)
	if err != nil {
		return nil, err
	}
	return &Signer{key: key, certDER: der, issuer: issuer}, nil
}

// Mint issues a JWT for account, valid for the given audience (the registry
// service name) with the granted access scopes. The token carries the
// signing certificate in its x5c header, which is how the registry finds
// and verifies the signing key.
func (s *Signer) Mint(account, audience string, access []Access, ttl time.Duration) (string, error) {
	now := time.Now()
	header, err := json.Marshal(struct {
		Typ string   `json:"typ"`
		Alg string   `json:"alg"`
		X5c []string `json:"x5c"`
	}{
		Typ: "JWT",
		Alg: "RS256",
		X5c: []string{base64.StdEncoding.EncodeToString(s.certDER)},
	})
	if err != nil {
		return "", err
	}
	claims, err := json.Marshal(struct {
		Issuer  string   `json:"iss"`
		Subject string   `json:"sub"`
		Aud     string   `json:"aud"`
		Exp     int64    `json:"exp"`
		Nbf     int64    `json:"nbf"`
		Iat     int64    `json:"iat"`
		Access  []Access `json:"access,omitempty"`
	}{
		Issuer:  s.issuer,
		Subject: account,
		Aud:     audience,
		Exp:     now.Add(ttl).Unix(),
		Nbf:     now.Add(-10 * time.Second).Unix(),
		Iat:     now.Unix(),
		Access:  access,
	})
	if err != nil {
		return "", err
	}
	enc := base64.RawURLEncoding
	signing := enc.EncodeToString(header) + "." + enc.EncodeToString(claims)
	sum := sha256.Sum256([]byte(signing))
	sig, err := rsa.SignPKCS1v15(rand.Reader, s.key, crypto.SHA256, sum[:])
	if err != nil {
		return "", err
	}
	return signing + "." + enc.EncodeToString(sig), nil
}

// ParseScopes converts scope strings like "repository:my/app:pull,push"
// into access entries. Malformed entries are skipped.
func ParseScopes(scopes []string) []Access {
	var out []Access
	for _, sc := range scopes {
		parts := strings.SplitN(sc, ":", 3)
		if len(parts) != 3 {
			continue
		}
		var actions []string
		for _, a := range strings.Split(parts[2], ",") {
			if a = strings.TrimSpace(a); a != "" {
				actions = append(actions, a)
			}
		}
		if len(actions) == 0 {
			continue
		}
		out = append(out, Access{Type: parts[0], Name: parts[1], Actions: actions})
	}
	return out
}

// ScopeKey builds a stable cache key for a set of scope strings.
func ScopeKey(scopes []string) string {
	sorted := append([]string(nil), scopes...)
	sort.Strings(sorted)
	return strings.Join(sorted, " ")
}

func loadOrCreateKey(path string) (*rsa.PrivateKey, bool, error) {
	if data, err := os.ReadFile(path); err == nil {
		block, _ := pem.Decode(data)
		if block == nil {
			return nil, false, fmt.Errorf("tokenauth: %s is not a PEM key", path)
		}
		key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			return nil, false, fmt.Errorf("tokenauth: parse %s: %w", path, err)
		}
		return key, false, nil
	}

	key, err := rsa.GenerateKey(rand.Reader, keyBits)
	if err != nil {
		return nil, false, err
	}
	data := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	})
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return nil, false, err
	}
	return key, true, nil
}

func writeCert(path string, key *rsa.PrivateKey) error {
	now := time.Now()
	tmpl := x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "registry-ui-token-root"},
		NotBefore:             now.Add(-time.Hour),
		NotAfter:              now.AddDate(10, 0, 0),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
		IsCA:                  true,
	}
	der, err := x509.CreateCertificate(rand.Reader, &tmpl, &tmpl, &key.PublicKey, key)
	if err != nil {
		return err
	}
	data := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	return os.WriteFile(path, data, 0o644)
}

// readCertDER returns the DER bytes of the first certificate in a PEM file.
func readCertDER(path string) ([]byte, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	block, _ := pem.Decode(data)
	if block == nil || block.Type != "CERTIFICATE" {
		return nil, fmt.Errorf("tokenauth: %s is not a certificate PEM", path)
	}
	return block.Bytes, nil
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
