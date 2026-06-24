# Build the static bundle, then serve it with nginx.
#
# The build output (HTML/JS/CSS) is architecture-neutral, so pin this stage to the
# builder's native platform ($BUILDPLATFORM). Under a multi-arch `buildx` build this
# stage then runs ONCE on the runner's own arch — no QEMU-emulated `pnpm build` per
# target. Only the tiny final COPY runs per target arch.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
# Per-build provenance, injected from CI (--build-arg). Defaults keep local builds working.
ARG VERSION=dev
ARG REVISION=dev
ARG CREATED=1970-01-01T00:00:00Z
# OCI metadata — `source` lets GHCR auto-link the package to the repo (and show its README).
LABEL org.opencontainers.image.title="OpenConsole" \
      org.opencontainers.image.description="A browser-only console for LocalStack, MinIO, and AWS" \
      org.opencontainers.image.url="https://jongsic.github.io/openconsole/" \
      org.opencontainers.image.documentation="https://github.com/Jongsic/openconsole#readme" \
      org.opencontainers.image.source="https://github.com/Jongsic/openconsole" \
      org.opencontainers.image.vendor="Jongsic" \
      org.opencontainers.image.licenses="Unlicense" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${CREATED}"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
