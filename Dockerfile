# Single image: builds the frontend and the server; the server serves the built frontend.
# Build from the repo root:  docker compose up --build
FROM node:22-slim AS build
# Build tools are only needed if a native module (better-sqlite3) has no prebuilt binary for the platform.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --no-audit --no-fund
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci --no-audit --no-fund --legacy-peer-deps

COPY server ./server
COPY frontend ./frontend

ARG VITE_API_URL=
ARG VITE_SLIDES_URL=
ARG VITE_REPO_URL=https://github.com/XOGrid-Cash/Blaze2026_XOGrid
ARG VITE_EMBER_ADDRESS=
RUN cd frontend && npm run build
RUN cd server && npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/data/hub.db WEB_DIR=/app/web-dist
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/package.json ./
COPY --from=build /app/frontend/dist ./web-dist
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "dist/index.js"]
