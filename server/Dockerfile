# syntax=docker/dockerfile:1
#
# Headless node: the same binary the desktop app supervises, running on a home
# server instead. It is a real deployment target, not a build artifact — a user
# with a NAS wants the library and downloads there, and only the UI on their
# laptop.
#
# Build from the repository root:
#   docker build -f server/Dockerfile -t mediary-node ./server

ARG GO_VERSION=1.27

FROM golang:${GO_VERSION}-alpine AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY . .

ARG VERSION=0.0.0-dev
ARG COMMIT=unknown
ARG BUILT=unknown

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -trimpath \
      -ldflags "-s -w -X main.version=${VERSION} -X main.commit=${COMMIT} -X main.built=${BUILT}" \
      -o /out/nodesrv ./cmd/nodesrv

# Alpine rather than distroless, unlike the cloud image: this node shells out to
# mpv and ffmpeg, so the runtime needs them present and a shell to find them.
FROM alpine:3.22 AS runtime

RUN apk add --no-cache ffmpeg mpv ca-certificates tini \
 && addgroup -g 1000 mediary \
 && adduser -D -u 1000 -G mediary mediary

COPY --from=builder /out/nodesrv /usr/local/bin/nodesrv

# A headless node is reachable over the network by definition, so the loopback
# default does not apply — but config.validate then requires NODE_TOKEN, which
# has to be supplied at run time. Starting without one is a hard failure, not a
# warning.
ENV NODE_ENV=production \
    NODE_HTTP_HOST=0.0.0.0 \
    NODE_HTTP_PORT=43711 \
    NODE_DATA_DIR=/data \
    NODE_LOG_PRETTY=false

RUN mkdir -p /data && chown mediary:mediary /data
VOLUME ["/data"]

USER mediary:mediary

EXPOSE 43711

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:43711/healthz || exit 1

ENTRYPOINT ["/sbin/tini", "--", "nodesrv"]
