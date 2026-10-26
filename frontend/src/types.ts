export interface Health {
  ok: boolean
  registry: string
  error?: string
}

export interface AppConfig {
  registryPublicUrl: string
  version: string
}

export interface CatalogEntry {
  name: string
  tagCount: number
  lastPush?: string
  lastPull?: string
  pushCount?: number
  pullCount?: number
}

export interface CatalogResponse {
  repositories: CatalogEntry[]
  count: number
}

export interface PlatformSummary {
  os?: string
  architecture?: string
  variant?: string
}

export interface TagInfo {
  name: string
  digest: string
  kind: string
  totalSize: number
  created?: string
  os?: string
  architecture?: string
  variant?: string
  platforms?: PlatformSummary[]
}

export interface RepoSummary {
  name: string
  tagCount: number
  totalSize: number
  lastCreated?: string
  tags: TagInfo[]
  lastPush?: string
  lastPull?: string
  pushCount?: number
  pullCount?: number
}

export interface Layer {
  digest?: string
  size: number
  mediaType?: string
  command?: string
  created?: string
  comment?: string
  empty: boolean
}

export interface ImageConfigInfo {
  created?: string
  os?: string
  architecture?: string
  variant?: string
  env?: string[]
  entrypoint?: string[]
  cmd?: string[]
  labels?: Record<string, string>
  workdir?: string
  user?: string
  exposedPorts?: string[]
  volumes?: string[]
  stopSignal?: string
}

export interface PlatformImage {
  digest: string
  os?: string
  architecture?: string
  variant?: string
  totalSize: number
  created?: string
  config?: ImageConfigInfo
  layers?: Layer[]
}

export interface ManifestInfo {
  repo: string
  ref: string
  digest: string
  mediaType: string
  kind: string
  totalSize: number
  created?: string
  platforms: PlatformImage[]
  raw: unknown
}

export interface ActivityEvent {
  id: string
  timestamp: string
  action: 'push' | 'pull' | 'delete' | 'mount' | 'login'
  repository: string
  tag?: string
  digest?: string
  mediaType?: string
  account?: string
  userAgent?: string
  addr?: string
}

export interface ActivityResponse {
  events: ActivityEvent[]
  count: number
}

export interface StorageStats {
  available: boolean
  totalBytes: number
  blobCount: number
  reclaimableBytes: number
  reclaimableCount: number
  scannedAt: string
}
