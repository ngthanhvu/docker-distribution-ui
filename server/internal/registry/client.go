package registry

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"registryui/internal/tokenauth"
)

// manifestAccept lists all manifest media types we understand, so the
// registry returns the richest representation of an image.
const manifestAccept = "application/vnd.docker.distribution.manifest.v2+json, " +
	"application/vnd.docker.distribution.manifest.list.v2+json, " +
	"application/vnd.oci.image.manifest.v1+json, " +
	"application/vnd.oci.image.index.v1+json, " +
	"application/vnd.docker.distribution.manifest.v1+json"

const (
	// maxBodySize caps how much of a response body we read into memory.
	maxBodySize = 32 << 20
	// indexWorkers is the concurrency used to resolve multi-arch children.
	indexWorkers = 8
)

// Error is a structured error returned by the registry HTTP API.
type Error struct {
	StatusCode int
	Code       string
	Message    string
}

func (e *Error) Error() string {
	if e.Code != "" {
		return fmt.Sprintf("%s: %s", e.Code, e.Message)
	}
	return e.Message
}

// IsNotFound reports whether err is a 404 from the registry.
func IsNotFound(err error) bool {
	re, ok := err.(*Error)
	return ok && re.StatusCode == http.StatusNotFound
}

// Client talks to a Docker Distribution (registry) HTTP API v2.
type Client struct {
	baseURL  string
	hc       *http.Client
	username string
	password string

	// tokens is non-nil when the registry uses token auth. The backend owns
	// the signing key, so it mints its own bearer tokens (challenge-driven)
	// instead of going through the /api/token HTTP endpoint.
	tokens *tokenauth.Signer

	tokMu    sync.Mutex
	tokCache map[string]cachedToken
}

type cachedToken struct {
	token   string
	expires time.Time
}

func NewClient(baseURL, username, password string) *Client {
	return &Client{
		baseURL:  strings.TrimRight(baseURL, "/"),
		hc:       &http.Client{Timeout: 60 * time.Second},
		username: username,
		password: password,
		tokCache: map[string]cachedToken{},
	}
}

// SetTokenSigner enables registry token auth for this client.
func (c *Client) SetTokenSigner(s *tokenauth.Signer) {
	c.tokens = s
}

func (c *Client) do(ctx context.Context, method, path, accept string) (*http.Response, error) {
	resp, err := c.send(ctx, method, path, accept, "")
	if err != nil {
		return nil, err
	}
	if resp.StatusCode == http.StatusUnauthorized && c.tokens != nil {
		if tok, terr := c.bearer(challengeServiceAndScopes(resp.Header.Values("Www-Authenticate"))); terr == nil {
			resp.Body.Close()
			resp, err = c.send(ctx, method, path, accept, tok)
			if err != nil {
				return nil, err
			}
		}
	}
	if resp.StatusCode >= 400 {
		defer resp.Body.Close()
		apiErr := &Error{StatusCode: resp.StatusCode, Message: resp.Status}
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		var payload struct {
			Errors []struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"errors"`
		}
		if json.Unmarshal(body, &payload) == nil && len(payload.Errors) > 0 {
			apiErr.Code = payload.Errors[0].Code
			apiErr.Message = payload.Errors[0].Message
		} else if len(body) > 0 {
			apiErr.Message = strings.TrimSpace(string(body))
		}
		return nil, apiErr
	}
	return resp, nil
}

func (c *Client) send(ctx context.Context, method, path, accept, bearer string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", accept)
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	} else if c.username != "" || c.password != "" {
		req.SetBasicAuth(c.username, c.password)
	}
	return c.hc.Do(req)
}

// bearer returns a cached (or freshly minted) token granting the scopes
// the registry asked for in its Bearer challenge.
func (c *Client) bearer(service string, scopes []string) (string, error) {
	key := tokenauth.ScopeKey(scopes)
	c.tokMu.Lock()
	if e, ok := c.tokCache[key]; ok && time.Now().Before(e.expires.Add(-time.Minute)) {
		c.tokMu.Unlock()
		return e.token, nil
	}
	c.tokMu.Unlock()

	ttl := 10 * time.Minute
	tok, err := c.tokens.Mint("registry-ui-backend", service, tokenauth.ParseScopes(scopes), ttl)
	if err != nil {
		return "", err
	}
	c.tokMu.Lock()
	c.tokCache[key] = cachedToken{token: tok, expires: time.Now().Add(ttl)}
	c.tokMu.Unlock()
	return tok, nil
}

// challengeServiceAndScopes extracts the service and scope parameters from
// a "WWW-Authenticate: Bearer realm=...,service=...,scope=..." challenge.
func challengeServiceAndScopes(headers []string) (service string, scopes []string) {
	for _, h := range headers {
		if len(h) < 7 || !strings.EqualFold(h[:7], "bearer ") {
			continue
		}
		for _, part := range strings.Split(h[7:], ",") {
			kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
			if len(kv) != 2 {
				continue
			}
			val := strings.Trim(kv[1], `"`)
			switch kv[0] {
			case "service":
				service = val
			case "scope":
				for _, sc := range strings.Fields(val) {
					if sc != "" {
						scopes = append(scopes, sc)
					}
				}
			}
		}
	}
	return service, scopes
}

// Ping checks that the registry API is reachable.
func (c *Client) Ping(ctx context.Context) error {
	resp, err := c.do(ctx, http.MethodGet, "/v2/", "*/*")
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// Catalog returns all repository names, following pagination.
func (c *Client) Catalog(ctx context.Context, pageSize int) ([]string, error) {
	var all []string
	last := ""
	for page := 0; page < 100; page++ {
		q := url.Values{}
		q.Set("n", strconv.Itoa(pageSize))
		if last != "" {
			q.Set("last", last)
		}
		resp, err := c.do(ctx, http.MethodGet, "/v2/_catalog?"+q.Encode(), "application/json")
		if err != nil {
			return nil, err
		}
		var payload struct {
			Repositories []string `json:"repositories"`
		}
		err = json.NewDecoder(resp.Body).Decode(&payload)
		resp.Body.Close()
		if err != nil {
			return nil, err
		}
		if len(payload.Repositories) == 0 {
			break
		}
		all = append(all, payload.Repositories...)
		if len(payload.Repositories) < pageSize {
			break
		}
		last = payload.Repositories[len(payload.Repositories)-1]
	}
	sort.Strings(all)
	return all, nil
}

// Tags returns all tags of a repository. A repository whose manifests were
// all deleted reports 404; that is not an error, just an empty list.
func (c *Client) Tags(ctx context.Context, repo string) ([]string, error) {
	resp, err := c.do(ctx, http.MethodGet, "/v2/"+repo+"/tags/list", "application/json")
	if err != nil {
		if IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	var payload struct {
		Tags []string `json:"tags"`
	}
	err = json.NewDecoder(resp.Body).Decode(&payload)
	resp.Body.Close()
	if err != nil {
		return nil, err
	}
	sort.Strings(payload.Tags)
	return payload.Tags, nil
}

// TagDigest resolves the manifest digest of a tag with a cheap HEAD request.
func (c *Client) TagDigest(ctx context.Context, repo, tag string) (string, error) {
	resp, err := c.do(ctx, http.MethodHead, "/v2/"+repo+"/manifests/"+tag, manifestAccept)
	if err != nil {
		return "", err
	}
	resp.Body.Close()
	digest := resp.Header.Get("Docker-Content-Digest")
	if digest == "" {
		return "", fmt.Errorf("registry returned no digest for %s:%s", repo, tag)
	}
	return digest, nil
}

// DeleteManifest deletes a manifest by digest.
func (c *Client) DeleteManifest(ctx context.Context, repo, digest string) error {
	resp, err := c.do(ctx, http.MethodDelete, "/v2/"+repo+"/manifests/"+digest, manifestAccept)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// Manifest fetches and fully resolves the manifest for a tag or a digest,
// including image configs, build history and multi-arch children.
func (c *Client) Manifest(ctx context.Context, repo, ref string) (*ManifestInfo, error) {
	body, digest, mediaType, err := c.getManifest(ctx, repo, ref)
	if err != nil {
		return nil, err
	}

	info := &ManifestInfo{
		Repo:      repo,
		Ref:       ref,
		Digest:    digest,
		MediaType: mediaType,
		Raw:       json.RawMessage(body),
	}

	var idx indexJSON
	isIndex := mediaType == "application/vnd.docker.distribution.manifest.list.v2+json" ||
		mediaType == "application/vnd.oci.image.index.v1+json"
	if !isIndex {
		// Sniff the payload: an index has a non-empty "manifests" array.
		var probe indexJSON
		if json.Unmarshal(body, &probe) == nil && len(probe.Manifests) > 0 && probe.Manifests[0].Digest != "" {
			isIndex = true
		}
	}

	if isIndex {
		if err := json.Unmarshal(body, &idx); err != nil {
			return nil, fmt.Errorf("parse index: %w", err)
		}
		info.Kind = "index"
		if info.MediaType == "" {
			info.MediaType = idx.MediaType
		}
		info.Platforms = c.fetchChildren(ctx, repo, idx.Manifests)
		for _, img := range info.Platforms {
			info.TotalSize += img.TotalSize
			if img.Created > info.Created {
				info.Created = img.Created
			}
		}
		return info, nil
	}

	var man manifestJSON
	if err := json.Unmarshal(body, &man); err != nil {
		return nil, fmt.Errorf("parse manifest: %w", err)
	}
	info.Kind = "image"
	if info.MediaType == "" {
		info.MediaType = man.MediaType
	}
	img, err := c.platformImage(ctx, repo, digest, man)
	if err != nil {
		return nil, err
	}
	info.Platforms = []PlatformImage{*img}
	info.TotalSize = img.TotalSize
	info.Created = img.Created
	return info, nil
}

// getManifest downloads the raw manifest and returns body, digest and media type.
func (c *Client) getManifest(ctx context.Context, repo, ref string) (body []byte, digest, mediaType string, err error) {
	resp, err := c.do(ctx, http.MethodGet, "/v2/"+repo+"/manifests/"+ref, manifestAccept)
	if err != nil {
		return nil, "", "", err
	}
	defer resp.Body.Close()
	body, err = io.ReadAll(io.LimitReader(resp.Body, maxBodySize))
	if err != nil {
		return nil, "", "", err
	}
	digest = resp.Header.Get("Docker-Content-Digest")
	mediaType = resp.Header.Get("Content-Type")
	if i := strings.Index(mediaType, ";"); i >= 0 {
		mediaType = strings.TrimSpace(mediaType[:i])
	}
	if digest == "" {
		sum := sha256.Sum256(body)
		digest = "sha256:" + hex.EncodeToString(sum[:])
	}
	return body, digest, mediaType, nil
}

// platformImage resolves one single-platform manifest into a PlatformImage.
func (c *Client) platformImage(ctx context.Context, repo, digest string, man manifestJSON) (*PlatformImage, error) {
	img := &PlatformImage{Digest: digest}
	img.TotalSize = man.Config.Size
	for _, l := range man.Layers {
		img.TotalSize += l.Size
	}

	cfg, history, err := c.imageConfig(ctx, repo, man.Config.Digest)
	if err == nil && cfg != nil {
		img.Config = cfg
		img.Created = cfg.Created
		if cfg.OS != "" {
			img.OS = cfg.OS
		}
		if cfg.Architecture != "" {
			img.Architecture = cfg.Architecture
		}
		if cfg.Variant != "" {
			img.Variant = cfg.Variant
		}
		img.Layers = timeline(man.Layers, history)
	} else {
		for _, l := range man.Layers {
			img.Layers = append(img.Layers, Layer{Digest: l.Digest, Size: l.Size, MediaType: l.MediaType})
		}
	}
	return img, nil
}

// imageConfig fetches the config blob of an image manifest.
func (c *Client) imageConfig(ctx context.Context, repo, digest string) (*ImageConfig, []HistoryEntry, error) {
	if digest == "" {
		return nil, nil, fmt.Errorf("manifest has no config descriptor")
	}
	resp, err := c.do(ctx, http.MethodGet, "/v2/"+repo+"/blobs/"+digest, "application/json")
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()
	var raw imageConfigJSON
	if err := json.NewDecoder(io.LimitReader(resp.Body, 16<<20)).Decode(&raw); err != nil {
		return nil, nil, err
	}

	cfg := &ImageConfig{
		Created:      raw.Created,
		OS:           raw.OS,
		Architecture: raw.Architecture,
		Variant:      raw.Variant,
		Env:          raw.Config.Env,
		Cmd:          raw.Config.Cmd,
		Entrypoint:   raw.Config.Entrypoint,
		Labels:       raw.Config.Labels,
		WorkingDir:   raw.Config.WorkingDir,
		User:         raw.Config.User,
		StopSignal:   raw.Config.StopSignal,
	}
	for p := range raw.Config.ExposedPorts {
		cfg.ExposedPorts = append(cfg.ExposedPorts, p)
	}
	sort.Strings(cfg.ExposedPorts)
	for v := range raw.Config.Volumes {
		cfg.Volumes = append(cfg.Volumes, v)
	}
	sort.Strings(cfg.Volumes)
	return cfg, raw.History, nil
}

// fetchChildren resolves all manifests referenced by an index concurrently.
func (c *Client) fetchChildren(ctx context.Context, repo string, children []Descriptor) []PlatformImage {
	sem := make(chan struct{}, indexWorkers)
	var mu sync.Mutex
	var imgs []PlatformImage
	var wg sync.WaitGroup

	for _, child := range children {
		wg.Add(1)
		go func(d Descriptor) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			body, digest, _, err := c.getManifest(ctx, repo, d.Digest)
			if err != nil {
				return
			}
			var man manifestJSON
			if err := json.Unmarshal(body, &man); err != nil {
				return
			}
			img, err := c.platformImage(ctx, repo, digest, man)
			if err != nil {
				return
			}
			if d.Platform != nil {
				if img.OS == "" {
					img.OS = d.Platform.OS
				}
				if img.Architecture == "" {
					img.Architecture = d.Platform.Architecture
				}
				if img.Variant == "" {
					img.Variant = d.Platform.Variant
				}
			}
			mu.Lock()
			imgs = append(imgs, *img)
			mu.Unlock()
		}(child)
	}
	wg.Wait()

	sort.Slice(imgs, func(i, j int) bool {
		if imgs[i].OS != imgs[j].OS {
			return imgs[i].OS < imgs[j].OS
		}
		if imgs[i].Architecture != imgs[j].Architecture {
			return imgs[i].Architecture < imgs[j].Architecture
		}
		return imgs[i].Variant < imgs[j].Variant
	})
	return imgs
}

// timeline merges the manifest layer descriptors with the build history,
// producing the same ordering as `docker history` (build order).
func timeline(layers []Descriptor, history []HistoryEntry) []Layer {
	var out []Layer
	li := 0
	for _, h := range history {
		l := Layer{
			Command: h.CreatedBy,
			Created: h.Created,
			Comment: h.Comment,
			Empty:   h.EmptyLayer,
		}
		if !h.EmptyLayer && li < len(layers) {
			l.Digest = layers[li].Digest
			l.Size = layers[li].Size
			l.MediaType = layers[li].MediaType
			li++
		}
		out = append(out, l)
	}
	for ; li < len(layers); li++ {
		out = append(out, Layer{
			Digest:    layers[li].Digest,
			Size:      layers[li].Size,
			MediaType: layers[li].MediaType,
		})
	}
	return out
}
