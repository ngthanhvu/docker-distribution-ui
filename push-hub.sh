#!/usr/bin/env bash
set -e

# ==============================================================================
# Script build và push 2 Docker image lên Docker Hub
# Cách dùng:
#   ./push-hub.sh <tên-user-dockerhub> [tag]
# Ví dụ:
#   ./push-hub.sh myusername
#   ./push-hub.sh myusername v1.0.0
# ==============================================================================

USERNAME="$1"
TAG="${2:-latest}"

if [ -z "$USERNAME" ]; then
  echo "❌ Lỗi: Chưa nhập username Docker Hub."
  echo "👉 Cách dùng: $0 <username_docker_hub> [tag]"
  echo "👉 Ví dụ:     $0 hungdev latest"
  exit 1
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$DIR"
DEPLOY_DIR="$DIR/deploy"

BACKEND_IMAGE="$USERNAME/registry-ui-backend:$TAG"
FRONTEND_IMAGE="$USERNAME/registry-ui-frontend:$TAG"

echo "------------------------------------------------------------"
echo "🚀 Đang build và push image lên Docker Hub:"
echo " - Backend:  $BACKEND_IMAGE"
echo " - Frontend: $FRONTEND_IMAGE"
echo "------------------------------------------------------------"

# 1. Build Backend
echo "📦 [1/4] Đang build Go backend..."
docker build -t "$BACKEND_IMAGE" "$ROOT_DIR/server"

# 2. Build Frontend
echo "📦 [2/4] Đang build React frontend..."
docker build -t "$FRONTEND_IMAGE" "$ROOT_DIR/frontend"

# 3. Push Backend
echo "⬆️ [3/4] Đang push backend lên Docker Hub ($BACKEND_IMAGE)..."
docker push "$BACKEND_IMAGE"

# 4. Push Frontend
echo "⬆️ [4/4] Đang push frontend lên Docker Hub ($FRONTEND_IMAGE)..."
docker push "$FRONTEND_IMAGE"

# 5. Cập nhật .env trong deploy
echo "⚙️ Cập nhật cấu hình trong deploy/.env..."
if [ -f "$DEPLOY_DIR/.env" ]; then
  sed -i "s|^DOCKERHUB_USERNAME=.*|DOCKERHUB_USERNAME=$USERNAME|" "$DEPLOY_DIR/.env"
  sed -i "s|^TAG=.*|TAG=$TAG|" "$DEPLOY_DIR/.env"
fi
if [ -f "$DEPLOY_DIR/.env.example" ]; then
  sed -i "s|^DOCKERHUB_USERNAME=.*|DOCKERHUB_USERNAME=$USERNAME|" "$DEPLOY_DIR/.env.example"
  sed -i "s|^TAG=.*|TAG=$TAG|" "$DEPLOY_DIR/.env.example"
fi

echo ""
echo "============================================================"
echo "✅ HOÀN TẤT ĐẨY IMAGE LÊN DOCKER HUB!"
echo "============================================================"
echo "Bây giờ bạn chỉ cần copy thư mục 'deploy' sang bất kỳ máy chủ nào khác."
echo "Trên máy chủ đó, chỉ cần gõ:"
echo "    cd deploy"
echo "    docker compose up -d"
echo ""
echo "Docker sẽ tự động PULL hai image từ Docker Hub về và chạy ngay lập tức!"
