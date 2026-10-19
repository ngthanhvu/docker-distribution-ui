# Hướng dẫn Deploy qua Docker Hub

Thư mục `deploy/` này được thiết kế để **độc lập hoàn toàn** với mã nguồn. Bạn có thể copy cả thư mục này sang bất kỳ máy chủ nào khác (VPS, server nội bộ, cloud) để chạy.

---

## 1. Cấu trúc thư mục `deploy/`

```
deploy/
├── docker-compose.yml       # Stack: registry, backend, frontend
├── nginx.conf               # [QUAN TRỌNG] Nginx tự động điều hướng /v2/ và /api/ và Web UI
├── .env.example             # Mẫu biến môi trường
├── .env                     # File cấu hình thực tế (DOCKERHUB_USERNAME, PORT, ...)
├── registry/
│   └── config.yml           # Cấu hình Docker Registry v2 (storage, webhook event về UI)
└── README.md                # Hướng dẫn này
```

Thư mục này **hoàn toàn độc lập** với mã nguồn (không cần code Go, không cần React). File `nginx.conf` được mount sẵn vào stack để tự động chia luồng:
- `/v2/*` → chuyển tiếp vào Docker Registry
- `/api/*` → chuyển tiếp vào Go Backend
- `/*` → phục vụ Web UI React

Do đó trên máy chủ (dù dùng 1Panel, Nginx host, hay Caddy), bạn **chỉ cần trỏ domain vào duy nhất 1 cổng `8080`**, không cần cấu hình phức tạp gì thêm!

---

## 2. Bước 1: Build và Push Image lên Docker Hub (Chạy tại repo gốc `docker-distribution/`)

Tại máy phát triển (nơi có mã nguồn `docker-distribution`):

1. Đăng nhập Docker Hub:
   ```bash
   docker login
   ```

2. Chạy script `push-hub.sh` ở thư mục gốc:
   ```bash
   ./push-hub.sh <username_docker_hub>
   ```
   *Ví dụ: `./push-hub.sh hungdev`*

   Script sẽ tự động:
   - Build image backend: `<username>/registry-ui-backend:latest`
   - Build image frontend: `<username>/registry-ui-frontend:latest`
   - Push cả 2 image lên tài khoản Docker Hub của bạn.
   - Tự động cập nhật `DOCKERHUB_USERNAME` vào file `.env`.

---

## 3. Bước 2: Chạy ở nơi khác (VPS / Máy chủ mới)

Chỉ cần copy thư mục `deploy/` sang máy chủ mới (bằng Git, SCP, SFTP, hoặc nén zip/tar rồi tải về):

```bash
# Ví dụ copy qua scp:
scp -r deploy user@ip-server-moi:/root/
```

Trên máy chủ mới:

```bash
cd deploy

# 1. Kiểm tra file .env xem DOCKERHUB_USERNAME đã đúng tên tài khoản Docker Hub của bạn chưa
nano .env

# 2. Khởi chạy stack:
docker compose up -d
```

> **Điều gì xảy ra khi chạy lệnh trên?**
> Docker trên máy chủ mới sẽ tự động `pull` 3 image:
> - `registry:2.8.3` (từ Docker Hub chính thức)
> - `<username>/registry-ui-backend:latest` (từ Docker Hub của bạn)
> - `<username>/registry-ui-frontend:latest` (từ Docker Hub của bạn)
> Sau đó khởi động toàn bộ hệ thống mà không cần bất kỳ công cụ build nào (không cần Node.js, không cần Go).

---

## 4. Truy cập dịch vụ

- **Web UI quản lý Registry**: `http://<IP-SERVER>:8080` (lần đầu vào sẽ có màn hình tạo tài khoản Admin).
- **Docker Registry**: `http://<IP-SERVER>:5000`

### Đẩy/kéo Docker image từ máy client tới Registry này:

Vì chạy theo IP:port chưa có SSL, trên máy client cần thêm IP vào file `/etc/docker/daemon.json`:
```json
{
  "insecure-registries": ["<IP-SERVER>:5000"]
}
```
Khởi động lại Docker trên máy client (`sudo systemctl restart docker`), sau đó:
```bash
docker tag nginx:alpine <IP-SERVER>:5000/my-app:v1
docker push <IP-SERVER>:5000/my-app:v1
docker pull <IP-SERVER>:5000/my-app:v1
```

---

## 5. (Nâng cao) Chạy chung 1 Domain + Tự động xin SSL Let's Encrypt

Nếu bạn có tên miền trỏ về IP server (ví dụ: `hub.example.com`):

1. Sửa trong file `.env`:
   ```bash
   HUB_DOMAIN=hub.example.com
   ACME_EMAIL=email-cua-ban@gmail.com
   REGISTRY_PUBLIC_URL=https://hub.example.com
   UI_PORT=127.0.0.1:8080
   REGISTRY_PORT=127.0.0.1:5000
   ```

2. Chạy với profile `domain`:
   ```bash
   docker compose --profile domain up -d
   ```
   Lúc này Nginx sẽ đứng trước:
   - `https://hub.example.com/` → Giao diện Web UI
   - `https://hub.example.com/v2/` → Docker Registry (client push/pull không cần cấu hình `insecure-registries`)
