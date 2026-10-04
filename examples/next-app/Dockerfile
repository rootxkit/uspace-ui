# The example's image, the recipe a system's web/ image follows (docs/
# CONSUMING.md): Next.js standalone output, built in CI and pulled by tag;
# a server never runs `next build`.
#
#   docker build -t uspace-ui-example examples/next-app
#
# The context is examples/next-app alone. The kit is the GitHub Release
# tarball package.json pins, installed with `pnpm install
# --frozen-lockfile` from docker/pnpm-lock.yaml, which records its
# integrity: no `npm ci`, no build of the kit and no devDependency of the
# kit in the image. (In the kit's repository the same package.json is
# linked to the current source instead; see the root pnpm-workspace.yaml.)
# pnpm is the version package.json pins (packageManager), through
# corepack. The base image is pinned by digest (node 22, alpine).
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json ./
COPY docker/pnpm-lock.yaml docker/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
