FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w -X main.version=1.0.0" -o /out/registry-ui ./cmd/server

FROM alpine:3.20
RUN adduser -D -u 10001 appuser && mkdir -p /data && chown appuser:appuser /data
COPY --from=build /out/registry-ui /usr/local/bin/registry-ui
USER appuser
EXPOSE 8080
ENTRYPOINT ["registry-ui"]
