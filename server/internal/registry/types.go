package registry

import "encoding/json"

// Descriptor is an OCI content descriptor as returned inside manifests.
type Descriptor struct {
	MediaType   string            `json:"mediaType"`
	Digest      string            `json:"digest"`
	Size        int64             `json:"size"`
	Platform    *Platform         `json:"platform,omitempty"`
	Annotations map[string]string `json:"annotations,omitempty"`
}

// Platform describes the target platform of a manifest entry.
type Platform struct {
	Architecture string `json:"architecture"`
	OS           string `json:"os"`
	Variant      string `json:"variant,omitempty"`
}

// manifestJSON is a single-platform image manifest (docker schema 2 / OCI).
type manifestJSON struct {
	SchemaVersion int          `json:"schemaVersion"`
	MediaType     string       `json:"mediaType"`
	Config        Descriptor   `json:"config"`
	Layers        []Descriptor `json:"layers"`
}

// indexJSON is a manifest list / OCI image index (multi-arch).
type indexJSON struct {
	SchemaVersion int          `json:"schemaVersion"`
	MediaType     string       `json:"mediaType"`
	Manifests     []Descriptor `json:"manifests"`
}

// imageConfigJSON is the image config blob (docker/OCI image config v1).
type imageConfigJSON struct {
	Architecture string `json:"architecture"`
	OS           string `json:"os"`
	Variant      string `json:"variant"`
	Created      string `json:"created"`
	Config       struct {
		Env          []string            `json:"Env"`
		Cmd          []string            `json:"Cmd"`
		Entrypoint   []string            `json:"Entrypoint"`
		Labels       map[string]string   `json:"Labels"`
		WorkingDir   string              `json:"WorkingDir"`
		User         string              `json:"User"`
		ExposedPorts map[string]struct{} `json:"ExposedPorts"`
		Volumes      map[string]struct{} `json:"Volumes"`
		StopSignal   string              `json:"StopSignal"`
	} `json:"config"`
	History []HistoryEntry `json:"history"`
}

// HistoryEntry is one step of the image build history.
type HistoryEntry struct {
	Created    string `json:"created"`
	CreatedBy string `json:"created_by"`
	EmptyLayer bool   `json:"empty_layer"`
	Comment    string `json:"comment"`
}

// Layer describes one layer of an image merged with its build-history entry.
type Layer struct {
	Digest    string `json:"digest,omitempty"`
	Size      int64  `json:"size"`
	MediaType string `json:"mediaType,omitempty"`
	Command   string `json:"command,omitempty"`
	Created   string `json:"created,omitempty"`
	Comment   string `json:"comment,omitempty"`
	Empty     bool   `json:"empty"`
}

// ImageConfig is the subset of the image config blob exposed by the API.
type ImageConfig struct {
	Created       string            `json:"created,omitempty"`
	OS            string            `json:"os,omitempty"`
	Architecture  string            `json:"architecture,omitempty"`
	Variant       string            `json:"variant,omitempty"`
	Env           []string          `json:"env,omitempty"`
	Entrypoint    []string          `json:"entrypoint,omitempty"`
	Cmd           []string          `json:"cmd,omitempty"`
	Labels        map[string]string `json:"labels,omitempty"`
	WorkingDir    string            `json:"workdir,omitempty"`
	User          string            `json:"user,omitempty"`
	ExposedPorts  []string          `json:"exposedPorts,omitempty"`
	Volumes       []string          `json:"volumes,omitempty"`
	StopSignal    string            `json:"stopSignal,omitempty"`
}

// PlatformImage is a resolved single-platform image: either a standalone
// manifest or one child of a multi-arch index.
type PlatformImage struct {
	Digest       string       `json:"digest"`
	OS           string       `json:"os,omitempty"`
	Architecture string       `json:"architecture,omitempty"`
	Variant      string       `json:"variant,omitempty"`
	TotalSize    int64        `json:"totalSize"`
	Created      string       `json:"created,omitempty"`
	Config       *ImageConfig `json:"config,omitempty"`
	Layers       []Layer      `json:"layers,omitempty"`
}

// ManifestInfo is a fully resolved manifest, ready to be served to the UI.
type ManifestInfo struct {
	Repo      string          `json:"repo"`
	Ref       string          `json:"ref"`
	Digest    string          `json:"digest"`
	MediaType string          `json:"mediaType"`
	Kind      string          `json:"kind"` // "image" | "index"
	TotalSize int64           `json:"totalSize"`
	Created   string          `json:"created,omitempty"`
	Platforms []PlatformImage `json:"platforms"`
	Raw       json.RawMessage `json:"raw"`
}
