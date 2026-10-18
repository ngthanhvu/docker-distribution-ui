package storage

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Stats is the result of scanning the registry storage directory.
type Stats struct {
	Available        bool      `json:"available"` // storage directory is mounted & readable
	TotalBytes       int64     `json:"totalBytes"`
	BlobCount        int64     `json:"blobCount"`
	ReclaimableBytes int64     `json:"reclaimableBytes"` // blobs not referenced by any repo (reclaimed by GC)
	ReclaimableCount int64     `json:"reclaimableCount"`
	ScannedAt        time.Time `json:"scannedAt"`
}

// Scan walks the distribution filesystem layout:
//
//	<root>/docker/registry/v2/blobs/sha256/<xx>/<hex>/data   — blobs
//	<root>/docker/registry/v2/repositories/<repo>/**/link   — digest links
//
// and computes total disk usage plus the bytes that garbage collection
// would reclaim (blobs no longer referenced by any repository).
func Scan(root string) (Stats, error) {
	stats := Stats{ScannedAt: time.Now().UTC()}
	if root == "" {
		return stats, nil
	}
	v2 := filepath.Join(root, "docker", "registry", "v2")
	if _, err := os.Stat(v2); err != nil {
		return stats, err
	}
	stats.Available = true

	blobSize := make(map[string]int64)
	blobsDir := filepath.Join(v2, "blobs", "sha256")
	_ = filepath.WalkDir(blobsDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || d.Name() != "data" {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return nil
		}
		hex := filepath.Base(filepath.Dir(path))
		blobSize[hex] = info.Size()
		stats.TotalBytes += info.Size()
		stats.BlobCount++
		return nil
	})

	referenced := make(map[string]bool)
	repoDir := filepath.Join(v2, "repositories")
	_ = filepath.WalkDir(repoDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || d.Name() != "link" {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		digest := strings.TrimSpace(string(data)) // e.g. "sha256:abc..."
		if i := strings.Index(digest, ":"); i >= 0 {
			digest = digest[i+1:]
		}
		if digest != "" {
			referenced[digest] = true
		}
		return nil
	})

	for hex, size := range blobSize {
		if !referenced[hex] {
			stats.ReclaimableBytes += size
			stats.ReclaimableCount++
		}
	}
	return stats, nil
}
