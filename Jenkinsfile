
GITHUB_URL     = 'https://github.com/ngthanhvu/docker-distribution-ui'  // 👈 Bỏ link repo GitHub vào đây
DOCKERHUB_USER = 'ngthanhvu'                                   // 👈 Username Docker Hub

APP_DIR        = 'docker-distribution'   // thư mục clone source về
CREDENTIALS_ID = 'dockerhub-credentials' // ID credential Docker Hub đã tạo trong Jenkins
TAG            = 'latest'                // tag mặc định (parameter TAG sẽ đè lên khi build)

pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
    }

    parameters {
        string(name: 'TAG', defaultValue: 'latest', description: 'Tag cho 2 image (ví dụ: v1.0.0 hoặc latest)')
    }

    stages {

        stage('1. Pull source từ GitHub') {
            steps {
                script {
                    TAG = params.TAG ?: 'latest'
                }
                echo """
                ------------------------------------------------------------
                🚀 Build & push image lên Docker Hub:
                    - Backend:  ${DOCKERHUB_USER}/registry-ui-backend:${TAG}
                    - Frontend: ${DOCKERHUB_USER}/registry-ui-frontend:${TAG}
                    - Source:   ${GITHUB_URL}
                ------------------------------------------------------------
                """.strip()
                sh "rm -rf '${APP_DIR}'"
                sh "git clone --depth 1 '${GITHUB_URL}' '${APP_DIR}'"
            }
        }

        stage('2. Login Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId:    CREDENTIALS_ID,
                    usernameVariable: 'HUB_USER',
                    passwordVariable: 'HUB_PASS'
                )]) {
                    sh 'echo "$HUB_PASS" | docker login -u "$HUB_USER" --password-stdin'
                }
            }
        }

        stage('3. Build 2 images') {
            steps {
                echo '📦 Build backend (Go)...'
                sh "docker build -t '${DOCKERHUB_USER}/registry-ui-backend:${TAG}' '${APP_DIR}/server'"
                echo '📦 Build frontend (React)...'
                sh "docker build -t '${DOCKERHUB_USER}/registry-ui-frontend:${TAG}' '${APP_DIR}/frontend'"
            }
        }

        stage('4. Push lên Docker Hub') {
            steps {
                echo '⬆️ Push backend...'
                sh "docker push '${DOCKERHUB_USER}/registry-ui-backend:${TAG}'"
                echo '⬆️ Push frontend...'
                sh "docker push '${DOCKERHUB_USER}/registry-ui-frontend:${TAG}'"
            }
        }
    }

    post {
        always {
            echo '🧹 Clear build cache...'
            sh 'docker builder prune -af || true'

            // Xóa 2 image vừa build để agent không phình disk (xóa dòng này nếu muốn giữ image lại)
            sh "docker rmi '${DOCKERHUB_USER}/registry-ui-backend:${TAG}' '${DOCKERHUB_USER}/registry-ui-frontend:${TAG}' || true"

            sh 'docker logout || true'
            deleteDir()
        }
        success {
            echo "✅ HOÀN TẤT! Đã đẩy lên Docker Hub: ${DOCKERHUB_USER}/registry-ui-backend:${TAG} & ${DOCKERHUB_USER}/registry-ui-frontend:${TAG}"
        }
        failure {
            echo '❌ Build thất bại — xem log phía trên.'
        }
    }
}
