# UNTESTED: the sandbox this was written in has no Docker daemon. Build from the repo root:
#   docker build -t xogrid .
#   docker run -p 3000:3000 -v hubdata:/data -e ADMIN_IDENTITIES="name=<pubkey|address|xpub>" xogrid
# The web app imports a small file from server/src, so the build context must be the repo root.
FROM node:22-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package.json ./server/
RUN cd server && npm install --no-audit --no-fund
COPY web/package.json ./web/
RUN cd web && npm install --no-audit --no-fund --legacy-peer-deps
COPY server ./server
COPY web ./web
ARG VITE_SLIDES_URL=
ARG VITE_REPO_URL=https://github.com/XOGrid-Cash/Blaze2026_XOGrid
ARG VITE_EMBER_ADDRESS=
RUN cd web && npm run build
RUN cd server && npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/data/hub.db WEB_DIR=/app/web-dist
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/package.json ./
COPY --from=build /app/web/dist ./web-dist
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "dist/index.js"]
