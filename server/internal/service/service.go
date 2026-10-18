package service

import (
	"context"
	"sort"
	"sync"
	"time"

	"registryui/internal/activity"
	"registryui/internal/cache"
	"registryui/internal/registry"
	"registryui/internal/storage"
)

const (
	workerLimit    = 8
	storageCacheTTL = 60 * time.Second
)

// Service aggregates raw registry API calls into the payloads the UI needs.
type Service struct {
	client   *registry.Client
	cache    *cache.Cache
	act      *activity.Store
	storRoot string

	storMu      sync.Mutex
	storStats   storage.Stats
	storScanned time.Time
	storValid   bool
}

func New(client *registry.Client, ttl time.Duration, act *activity.Store, storRoot string) *Service {
	return &Service{client: client, cache: cache.New(ttl), act: act, storRoot: storRoot}
}

// PlatformSummary is a compact platform descriptor used in tag lists.
type PlatformSummary struct {
	OS           string `json:"os,omitempty"`
	Architecture string `json:"architecture,omitempty"`
	Variant      string `json:"variant,omitempty"`
}

// TagInfo describes a single tag of a repository.
type TagInfo struct {
	Name         string            `json:"name"`
	Digest       string            `json:"digest"`
	Kind         string            `json:"kind"`
	TotalSize    int64             `json:"totalSize"`
	Created      string            `json:"created,omitempty"`
	OS           string            `json:"os,omitempty"`
	Architecture string            `json:"architecture,omitempty"`
	Variant      string            `json:"variant,omitempty"`
	Platforms    []PlatformSummary `json:"platforms,omitempty"`
}

// RepoSummary is the full listing of one repository.
type RepoSummary struct {
	Name        string    `json:"name"`
	TagCount    int       `json:"tagCount"`
	TotalSize   int64     `json:"totalSize"`
	LastCreated string    `json:"lastCreated,omitempty"`
	Tags        []TagInfo `json:"tags"`

	LastPush  *time.Time `json:"lastPush,omitempty"`
	LastPull  *time.Time `json:"lastPull,omitempty"`
	PushCount int64      `json:"pushCount,omitempty"`
	PullCount int64      `json:"pullCount,omitempty"`
}

// CatalogEntry is one row of the repository catalog.
type CatalogEntry struct {
	Name      string `json:"name"`
	TagCount  int    `json:"tagCount"`

	LastPush  *time.Time `json:"lastPush,omitempty"`
	LastPull  *time.Time `json:"lastPull,omitempty"`
	PushCount int64      `json:"pushCount,omitempty"`
	PullCount int64      `json:"pullCount,omitempty"`
}

func (s *Service) Ping(ctx context.Context) error {
	return s.client.Ping(ctx)
}

// Catalog lists all repositories with tag counts and activity stats.
func (s *Service) Catalog(ctx context.Context) ([]CatalogEntry, error) {
	repos, err := s.client.Catalog(ctx, 100)
	if err != nil {
		return nil, err
	}
	entries := make([]CatalogEntry, len(repos))
	for i, r := range repos {
		entries[i] = CatalogEntry{Name: r}
	}
	runLimited(len(repos), workerLimit, func(i int) {
		if tags, err := s.client.Tags(ctx, repos[i]); err == nil {
			entries[i].TagCount = len(tags)
		}
	})
	for i := range entries {
		s.mergeStats(&entries[i].LastPush, &entries[i].LastPull, &entries[i].PushCount, &entries[i].PullCount, entries[i].Name)
	}
	return entries, nil
}

// Repo returns all tags of a repository with sizes and metadata.
func (s *Service) Repo(ctx context.Context, name string) (*RepoSummary, error) {
	if v, ok := s.cache.Get("repo:" + name); ok {
		if sum, ok := v.(*RepoSummary); ok {
			out := *sum
			s.mergeStats(&out.LastPush, &out.LastPull, &out.PushCount, &out.PullCount, name)
			return &out, nil
		}
	}

	tags, err := s.client.Tags(ctx, name)
	if err != nil {
		return nil, err
	}
	sum := &RepoSummary{Name: name, TagCount: len(tags), Tags: make([]TagInfo, 0, len(tags))}

	// Resolve the digest of every tag with cheap HEAD requests.
	digests := make([]string, len(tags))
	runLimited(len(tags), workerLimit, func(i int) {
		if d, err := s.client.TagDigest(ctx, name, tags[i]); err == nil {
			digests[i] = d
		}
	})

	// Fetch each unique manifest once.
	seen := make(map[string]bool, len(tags))
	unique := make([]string, 0, len(tags))
	for _, d := range digests {
		if d != "" && !seen[d] {
			seen[d] = true
			unique = append(unique, d)
		}
	}
	infos := make([]*registry.ManifestInfo, len(unique))
	runLimited(len(unique), workerLimit, func(i int) {
		if info, err := s.client.Manifest(ctx, name, unique[i]); err == nil {
			infos[i] = info
		}
	})
	byDigest := make(map[string]*registry.ManifestInfo, len(infos))
	for _, info := range infos {
		if info != nil {
			byDigest[info.Digest] = info
		}
	}

	counted := make(map[string]bool, len(unique))
	for i, tag := range tags {
		ti := TagInfo{Name: tag, TotalSize: -1}
		if d := digests[i]; d != "" {
			ti.Digest = d
			if info, ok := byDigest[d]; ok {
				ti.Kind = info.Kind
				ti.TotalSize = info.TotalSize
				ti.Created = info.Created
				if info.Kind == "index" {
					ti.Platforms = make([]PlatformSummary, 0, len(info.Platforms))
					for _, p := range info.Platforms {
						ti.Platforms = append(ti.Platforms, PlatformSummary{
							OS: p.OS, Architecture: p.Architecture, Variant: p.Variant,
						})
					}
				} else if len(info.Platforms) > 0 {
					p := info.Platforms[0]
					ti.OS = p.OS
					ti.Architecture = p.Architecture
					ti.Variant = p.Variant
				}
				if !counted[d] {
					counted[d] = true
					sum.TotalSize += info.TotalSize
				}
				if info.Created > sum.LastCreated {
					sum.LastCreated = info.Created
				}
			}
		}
		sum.Tags = append(sum.Tags, ti)
	}
	sort.Slice(sum.Tags, func(i, j int) bool { return sum.Tags[i].Name < sum.Tags[j].Name })

	s.cache.Set("repo:"+name, sum)
	out := *sum
	s.mergeStats(&out.LastPush, &out.LastPull, &out.PushCount, &out.PullCount, name)
	return &out, nil
}

// Manifest returns the resolved manifest for a tag or digest reference.
func (s *Service) Manifest(ctx context.Context, name, ref string) (*registry.ManifestInfo, error) {
	key := "manifest:" + name + "/" + ref
	if v, ok := s.cache.Get(key); ok {
		if info, ok := v.(*registry.ManifestInfo); ok {
			return info, nil
		}
	}
	info, err := s.client.Manifest(ctx, name, ref)
	if err != nil {
		return nil, err
	}
	s.cache.Set(key, info)
	return info, nil
}

// DeleteManifest removes a manifest by digest and invalidates cached data.
func (s *Service) DeleteManifest(ctx context.Context, name, digest string) error {
	if err := s.client.DeleteManifest(ctx, name, digest); err != nil {
		return err
	}
	s.cache.DeletePrefix("repo:" + name)
	s.cache.DeletePrefix("manifest:" + name + "/")
	return nil
}

// RecordEvents stores incoming registry notification events.
func (s *Service) RecordEvents(events []activity.Event) int {
	return s.act.Add(events)
}

// Activity returns the newest events, optionally filtered by repository.
func (s *Service) Activity(n int, repo string) []activity.Event {
	return s.act.List(n, repo)
}

// StorageStats scans the registry filesystem (mounted read-only) for real
// disk usage. Results are cached for one minute.
func (s *Service) StorageStats() storage.Stats {
	if s.storRoot == "" {
		return storage.Stats{}
	}
	s.storMu.Lock()
	defer s.storMu.Unlock()
	if s.storValid && time.Since(s.storScanned) < storageCacheTTL {
		return s.storStats
	}
	stats, err := storage.Scan(s.storRoot)
	if err != nil {
		if s.storValid {
			return s.storStats
		}
		return storage.Stats{}
	}
	s.storStats, s.storScanned, s.storValid = stats, time.Now(), true
	return stats
}

func (s *Service) mergeStats(lastPush, lastPull **time.Time, pushes, pulls *int64, repo string) {
	if lp, ll, ps, pl, ok := s.act.StatsFor(repo); ok {
		*lastPush = timePtr(lp)
		*lastPull = timePtr(ll)
		*pushes = ps
		*pulls = pl
	}
}

func timePtr(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	return &t
}

// runLimited runs fn(i) for i in [0, n) with at most limit goroutines.
func runLimited(n, limit int, fn func(i int)) {
	if n <= 0 {
		return
	}
	if limit < 1 {
		limit = 1
	}
	sem := make(chan struct{}, limit)
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			fn(i)
		}(i)
	}
	wg.Wait()
}
