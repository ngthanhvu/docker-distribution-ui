# Docker Registry UI

Private Docker image registry (**Docker Distribution**) + web UI tự viết:
backend **Go** (stdlib, không dependency) và frontend **React + Vite** (served bởi nginx).
Toàn bộ chạy bằng Docker Compose.

## Kiến trúc

```
                    ┌────────────────────────────────────────────┐
 :8080 ──► registry-frontend (nginx)                             │
              │  static React build + SPA fallback               │
              │  /api/* ──► proxy ──► registry-backend (Go :8080)│
                                        │                        │
                                        │ Registry HTTP API v2   │
                                        ▼                        │
 :5000 ──► registry (docker distribution 2.8.3)                  │
              │  storage: volume registry-data                   │
              └──────────────────────────────────────────────────┘
```

| Service | Container | Port | Vai trò |
|---|---|---|---|
| `registry` | `registry:2.8.3` | 5000 | Lưu image (Docker Distribution) |
| `backend` | Go + Alpine | nội bộ 8080 | Client Registry API v2, tổng hợp dữ liệu cho UI |
| `frontend` | nginx + Vite build | 8080 | React UI, proxy `/api` sang backend |

## Chạy

```bash
docker compose up -d --build
```

- Web UI: http://localhost:8080
- Registry: http://localhost:5000 (kiểm tra `curl http://localhost:5000/v2/`)

Đổi port qua biến môi trường khi chạy compose:

```bash
REGISTRY_PORT=5000 UI_PORT=8080 REGISTRY_PUBLIC_URL=http://my-host:5000 docker compose up -d
```

`REGISTRY_PUBLIC_URL` là địa chỉ public của registry (dùng trong lệnh push/pull
hiển thị trên UI).

## Sử dụng registry

```bash
docker pull nginx:alpine
docker tag nginx:alpine localhost:5000/demo/nginx:v1
docker push localhost:5000/demo/nginx:v1
docker pull localhost:5000/demo/nginx:v1
```

> **Từ máy khác**: Docker chỉ cho phép HTTP thường (không TLS) với
> `localhost`. Với registry trên IP/domain, thêm vào `/etc/docker/daemon.json`
> của client:
> ```json
> { "insecure-registries": ["my-host:5000"] }
> ```
> rồi restart docker. Nên cấu hình TLS + auth khi mở ra internet (xem dưới).

## Tính năng UI

- Đăng nhập: lần đầu vào web hiện trang tạo tài khoản admin, sau đó login bằng
  session cookie (xem mục Bảo mật)
- Dashboard: danh sách repository, tag, dung lượng (quét nền, cache TTL),
  **disk usage thật** + **reclaimable** (blob không còn được repo nào tham chiếu),
  cột last pushed / last pulled thật, size bar so sánh các repo
- **Activity feed realtime**: mọi push/pull lên registry được Distribution
  gửi event về backend (notifications webhook) — hiển thị timeline ai
  (user-agent, IP) pull/push gì, lúc nào; kèm stats pull/push count mỗi repo
- Trang repo: danh sách tag kèm digest, loại (image/multi-arch), os/arch,
  size, thời gian tạo; lệnh push/pull copy-1-click; activity riêng của repo
- Trang chi tiết manifest: layers + build history (như `docker history`),
  image config (env, entrypoint, cmd, labels…), platforms của multi-arch
  index, raw manifest JSON
- Xóa manifest theo digest (kèm cảnh báo), tự invalidate cache

Lưu ý về activity:

- Pull/push events đến từ notifications của registry (cấu hình trong
  `registry/config.yml`). Stats chỉ tính **từ khi bật tính năng này**
- Event do chính UI backend tạo (user-agent `Go-http-client`) bị lọc khỏi
  stats để không tự đếm pull của chính nó
- Registry 2.8 không phát event DELETE — khi xóa qua UI, backend tự ghi
  event `delete` gắn tên user thực hiện

## API của backend (nội bộ)

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/auth/status` | Trạng thái auth (đã setup? đã login?) |
| POST | `/api/auth/setup` | Tạo admin lần đầu (tự login) |
| POST | `/api/auth/login` | Đăng nhập |
| POST | `/api/auth/logout` | Đăng xuất |
| GET | `/api/health` | Kiểm tra registry |
| GET | `/api/config` | Cấu hình public + version |
| GET | `/api/catalog` | Danh sách repository + tag + stats push/pull |
| GET | `/api/activity?n=&repo=` | Event feed (push/pull/delete) |
| GET | `/api/storage` | Disk usage thật + reclaimable (blob orphan) |
| POST | `/api/events` | Nhận notification từ registry (secret header) |
| GET | `/api/repositories/{name}/tags` | Tags + digest + size + metadata |
| GET | `/api/repositories/{name}/manifests/{ref}` | Chi tiết manifest (ref = tag hoặc digest) |
| DELETE | `/api/repositories/{name}/manifests/{digest}` | Xóa manifest (phải dùng digest) |

Biến môi trường backend: `REGISTRY_URL`, `REGISTRY_PUBLIC_URL`,
`REGISTRY_USERNAME`, `REGISTRY_PASSWORD`, `CACHE_TTL`, `LISTEN_ADDR`,
`DATA_DIR`, `AUTH_FILE`, `AUTH_DISABLED`, `EVENT_SECRET`
(shared secret giữa `registry/config.yml` và backend — đổi thì đổi cả hai),
`REGISTRY_STORAGE_DIR` (mount `registry-data` read-only vào backend để có
disk stats; bỏ mount nếu không muốn).

## Bảo mật

### Web UI authentication

Lần **đầu tiên** mở UI, sẽ hiện trang **tạo tài khoản admin** (username + password
tối thiểu 8 ký tự). Các lần sau phải đăng nhập. Chi tiết:

- Mật khẩu hash bằng **PBKDF2-SHA256** (600.000 vòng, stdlib Go) + salt random,
  lưu trong volume `backend-data` (`/data/auth.json`, mode 0600)
- Session: cookie `HttpOnly` + `SameSite=Lax`, hết hạn 7 ngày (tự gia hạn khi dùng)
- Login sai quá 10 lần / 10 phút / IP → tạm chặn (HTTP 429)
- Mọi API endpoint (trừ `/api/health` và `/api/auth/*`) yêu cầu session

Quên mật khẩu? Xóa file auth rồi restart backend, UI sẽ quay lại màn hình tạo tài khoản:

```bash
docker compose exec backend rm /data/auth.json
docker compose restart backend
```

Tắt hẳn authentication (chỉ dùng ở môi trường tin cậy/cục bộ): uncomment
`AUTH_DISABLED: "true"` trong `docker-compose.yml`.

### Basic auth cho registry (lớp riêng, bảo vệ API :5000)

Auth của UI chỉ bảo vệ web; clients (`docker push/pull`) nói chuyện trực tiếp với
`:5000`. Muốn bảo vệ luôn cả registry:

```bash
mkdir -p registry/auth
docker run --rm --entrypoint htpasswd httpd:2.4-alpine \
  -Bbn admin 'MatKhauManh' > registry/auth/htpasswd
```

Bỏ comment 2 dòng `auth:` trong `registry/config.yml` và volume
`./registry/auth` trong `docker-compose.yml`, uncomment
`REGISTRY_USERNAME`/`REGISTRY_PASSWORD` cho backend, rồi `docker compose up -d`.
Sau đó client phải `docker login localhost:5000` trước khi push/pull.

Với production nên đặt TLS trước registry (reverse proxy) và dùng domain.

## Dọn rác (garbage collection)

Xóa manifest không xóa blob trên đĩa. Dashboard có thẻ **Reclaimable** cho
biết blob nào không còn được repo nào tham chiếu. Chạy GC định kỳ:

```bash
docker compose stop registry
docker compose run --rm registry registry garbage-collect /etc/docker/registry/config.yml
docker compose start registry
```

## Phát triển (dev)

Backend (chạy bằng docker, không cần cài Go):

```bash
docker run --rm -p 8080:8080 -v "$PWD/server":/src -w /src \
  -e REGISTRY_URL=http://localhost:5000 -e AUTH_FILE=/tmp/auth.json \
  golang:1.24-alpine go run ./cmd/server
```

Frontend (hot reload, proxy `/api` sang :8080):

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

Cấu trúc project:

```
docker-distribution/
├── docker-compose.yml
├── registry/config.yml          # cấu hình distribution
├── server/                      # Go backend
│   ├── cmd/server/main.go
│   └── internal/
│       ├── activity/            # event feed + stats push/pull (notifications)
│       ├── auth/                # đăng nhập, session, PBKDF2
│       ├── config/              # env config
│       ├── registry/            # client Registry HTTP API v2
│       ├── storage/             # scan disk usage thật
│       ├── cache/               # TTL cache
│       ├── service/             # tổng hợp dữ liệu cho UI
│       └── httpapi/             # routes, middleware, auth handlers
└── frontend/                    # React + Vite
    ├── nginx.conf               # static + proxy /api
    └── src/pages/               # Dashboard, Repository, TagDetail, Login, Setup
```
