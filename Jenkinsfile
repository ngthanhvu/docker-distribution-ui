
pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        timeout(time: 60, unit: 'MINUTES')
        timestamps()
    }

    parameters {
        string(
            name: 'TAG',
            defaultValue: 'latest',
            description: 'Docker image tag'
        )
    }

    environment {
        GITHUB_URL     = 'https://github.com/ngthanhvu/docker-distribution-ui.git'
        DOCKERHUB_USER = 'ngthanhvu'
        CREDENTIALS_ID = 'dockerhub-credentials'

        PLATFORMS      = 'linux/amd64,linux/arm64'
        BUILDER_NAME   = 'registry-multiarch'
        TAG            = "${params.TAG}"
    }

    stages {

        stage('1. Validate & Checkout') {
            steps {
                script {
                    if (!(env.TAG ==~ /^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$/)) {
                        error('Invalid Docker tag')
                    }
                }

                echo """
                ============================================
                Docker Multi-Platform Build
                ============================================
                Backend  : ${DOCKERHUB_USER}/registry-ui-backend:${TAG}
                Frontend : ${DOCKERHUB_USER}/registry-ui-frontend:${TAG}
                Platforms: ${PLATFORMS}
                ============================================
                """

                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    extensions: [
                        [$class: 'CleanBeforeCheckout']
                    ],
                    userRemoteConfigs: [
                        [url: env.GITHUB_URL]
                    ]
                ])
            }
        }

        stage('2. Docker Buildx Setup') {
            steps {
                sh '''
                    set -eu

                    docker version
                    docker buildx version

                    if ! docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
                        docker buildx create \
                            --name "$BUILDER_NAME" \
                            --driver docker-container
                    fi

                    docker buildx inspect \
                        --builder "$BUILDER_NAME" \
                        --bootstrap

                    echo "Checking supported platforms..."

                    docker buildx inspect \
                        --builder "$BUILDER_NAME"
                '''
            }
        }

        stage('3. Login Docker Hub') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: env.CREDENTIALS_ID,
                        usernameVariable: 'HUB_USER',
                        passwordVariable: 'HUB_PASS'
                    )
                ]) {
                    sh '''
                        set +x
                        printf '%s' "$HUB_PASS" |
                            docker login \
                                --username "$HUB_USER" \
                                --password-stdin
                    '''
                }
            }
        }

        stage('4. Build & Push Backend') {
            steps {
                echo 'Building Go backend for AMD64 + ARM64...'

                sh '''
                    docker buildx build \
                        --builder "$BUILDER_NAME" \
                        --platform "$PLATFORMS" \
                        --tag "$DOCKERHUB_USER/registry-ui-backend:$TAG" \
                        --push \
                        ./server
                '''
            }
        }

        stage('5. Build & Push Frontend') {
            steps {
                echo 'Building React frontend for AMD64 + ARM64...'

                sh '''
                    docker buildx build \
                        --builder "$BUILDER_NAME" \
                        --platform "$PLATFORMS" \
                        --tag "$DOCKERHUB_USER/registry-ui-frontend:$TAG" \
                        --push \
                        ./frontend
                '''
            }
        }

        stage('6. Verify Multi-Architecture Images') {
            steps {
                sh '''
                    set -eu

                    echo "Verify backend:"
                    docker buildx imagetools inspect \
                        "$DOCKERHUB_USER/registry-ui-backend:$TAG"

                    echo "Verify frontend:"
                    docker buildx imagetools inspect \
                        "$DOCKERHUB_USER/registry-ui-frontend:$TAG"
                '''
            }
        }
    }

    post {
        always {
            echo 'Cleaning workspace and Docker credentials...'

            sh 'docker logout || true'

            // Keep Buildx cache for faster subsequent builds.
            // Do not prune the entire Docker builder cache.

            cleanWs()
        }

        success {
            echo """
            ============================================
            BUILD SUCCESSFUL

            Backend:
            ${DOCKERHUB_USER}/registry-ui-backend:${TAG}

            Frontend:
            ${DOCKERHUB_USER}/registry-ui-frontend:${TAG}

            Architectures:
            - linux/amd64
            - linux/arm64
            ============================================
            """
        }

        failure {
            echo 'Multi-architecture build failed. Check logs.'
        }
    }
}
