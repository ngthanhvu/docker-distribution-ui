pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
    }

    parameters {
        string(name: 'TAG', defaultValue: 'latest', description: 'Tag cho 2 image (ví dụ: v1.0.0 hoặc latest)')
    }

    environment {
        GITHUB_URL     = 'https://github.com/ngthanhvu/docker-distribution-ui.git'
        DOCKERHUB_USER = 'ngthanhvu'
        CREDENTIALS_ID = 'dockerhub-credentials'
        TAG            = "${params.TAG ?: 'latest'}"
    }

    stages {

        stage('1. Checkout source code') {
            steps {
                echo """
                ------------------------------------------------------------
                🚀 Build & push image lên Docker Hub:
                    - Backend:  ${DOCKERHUB_USER}/registry-ui-backend:${TAG}
                    - Frontend: ${DOCKERHUB_USER}/registry-ui-frontend:${TAG}
                    - Source:   ${GITHUB_URL}
                ------------------------------------------------------------
                """
                // Dùng step checkout chuẩn của Jenkins:
                // Nếu job cấu hình "Pipeline script from SCM" thì scm đã có sẵn.
                // Nếu job là Pipeline script rời thì tự pull từ repo về workspace hiện tại.
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    doGenerateSubmoduleConfigurations: false,
                    extensions: [[$class: 'CleanBeforeCheckout']],
                    userRemoteConfigs: [[url: env.GITHUB_URL]]
                ])
            }
        }

        stage('2. Login Docker Hub') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId:    env.CREDENTIALS_ID,
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
                sh "docker build -t '${env.DOCKERHUB_USER}/registry-ui-backend:${env.TAG}' ./server"
                echo '📦 Build frontend (React)...'
                sh "docker build -t '${env.DOCKERHUB_USER}/registry-ui-frontend:${env.TAG}' ./frontend"
            }
        }

        stage('4. Push lên Docker Hub') {
            steps {
                echo '⬆️ Push backend...'
                sh "docker push '${env.DOCKERHUB_USER}/registry-ui-backend:${env.TAG}'"
                echo '⬆️ Push frontend...'
                sh "docker push '${env.DOCKERHUB_USER}/registry-ui-frontend:${env.TAG}'"
            }
        }
    }

    post {
        always {
            echo '🧹 Clear build cache & logout...'
            sh 'docker builder prune -af || true'
            // Xóa image vừa build để tránh đầy ổ đĩa Jenkins server
            sh "docker rmi '${env.DOCKERHUB_USER}/registry-ui-backend:${env.TAG}' '${env.DOCKERHUB_USER}/registry-ui-frontend:${env.TAG}' || true"
            sh 'docker logout || true'
            cleanWs() // Dọn dẹp workspace sạch sẽ
        }
        success {
            echo "✅ HOÀN TẤT! Đã đẩy lên Docker Hub: ${env.DOCKERHUB_USER}/registry-ui-backend:${env.TAG} & ${env.DOCKERHUB_USER}/registry-ui-frontend:${env.TAG}"
        }
        failure {
            echo '❌ Build thất bại — xem log chi tiết phía trên.'
        }
    }
}
