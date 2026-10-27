import { useEffect, useState } from 'react'
import type {
  ActivityResponse,
  AppConfig,
  CatalogResponse,
  Health,
  ManifestInfo,
  RepoSummary,
  StorageStats,
} from './types'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export interface AuthStatus {
  initialized: boolean
  authenticated: boolean
  username?: string
  authDisabled: boolean
  createdAt?: string
  passwordUpdatedAt?: string
}

let unauthorizedHandler: (() => void) | null = null

/** Registers the global handler invoked when a request returns 401. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn
}

interface RequestOpts {
  /** Do not trigger the global 401 handler (used by auth endpoints). */
  ignoreAuth?: boolean
}

async function request<T>(path: string, init?: RequestInit, opts?: RequestOpts): Promise<T> {
  const res = await fetch(path, init)
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && !opts?.ignoreAuth) {
      unauthorizedHandler?.()
    }
    const message =
      body && typeof body.error === 'string' ? body.error : `HTTP ${res.status}`
    throw new ApiError(message, res.status)
  }
  return body as T
}

function jsonInit(method: string, payload: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
}

function encodeRepoName(name: string): string {
  return name.split('/').map(encodeURIComponent).join('/')
}

export const api = {
  health: () => request<Health>('/api/health', undefined, { ignoreAuth: true }),
  config: () => request<AppConfig>('/api/config'),
  catalog: () => request<CatalogResponse>('/api/catalog'),
  repo: (name: string) =>
    request<RepoSummary>(`/api/repositories/${encodeRepoName(name)}/tags`),
  manifest: (name: string, ref: string) =>
    request<ManifestInfo>(
      `/api/repositories/${encodeRepoName(name)}/manifests/${encodeURIComponent(ref)}`,
    ),
  deleteManifest: (name: string, digest: string) =>
    request<{ ok: boolean }>(
      `/api/repositories/${encodeRepoName(name)}/manifests/${encodeURIComponent(digest)}`,
      { method: 'DELETE' },
    ),
  deleteRepository: (name: string) =>
    request<{ ok: boolean }>(`/api/repositories/${encodeRepoName(name)}`, {
      method: 'DELETE',
    }),
  activity: (n = 50, repo?: string) =>
    request<ActivityResponse>(
      `/api/activity?n=${n}${repo ? `&repo=${encodeURIComponent(repo)}` : ''}`,
    ),
  storage: () => request<StorageStats>('/api/storage'),
  auth: {
    status: () => request<AuthStatus>('/api/auth/status', undefined, { ignoreAuth: true }),
    setup: (username: string, password: string) =>
      request<{ ok: boolean; username: string }>(
        '/api/auth/setup',
        jsonInit('POST', { username, password }),
        { ignoreAuth: true },
      ),
    login: (username: string, password: string, remember: boolean) =>
      request<{ ok: boolean; username: string }>(
        '/api/auth/login',
        jsonInit('POST', { username, password, remember }),
        { ignoreAuth: true },
      ),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ ok: boolean }>(
        '/api/auth/password',
        jsonInit('POST', { currentPassword, newPassword }),
      ),
    logout: () =>
      request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }, { ignoreAuth: true }),
  },
}

let cachedConfig: AppConfig | null = null

/** Loads the UI/backend config once and caches it for the session. */
export function useConfig(): AppConfig | null {
  const [cfg, setCfg] = useState<AppConfig | null>(cachedConfig)
  useEffect(() => {
    if (!cachedConfig) {
      api
        .config()
        .then((c) => {
          cachedConfig = c
          setCfg(c)
        })
        .catch(() => {})
    }
  }, [])
  return cfg
}

/** Runs async tasks over items with bounded concurrency. */
export async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const item = items[next++]
        try {
          await fn(item)
        } catch {
          // background loading: ignore individual failures
        }
      }
    },
  )
  await Promise.all(workers)
}
