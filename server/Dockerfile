# API-only image (no frontend). Build with the server/ folder as the context:
#   docker build -t xogrid-server server
#   docker run -p 3000:3000 -v hubdata:/data -e ADMIN_IDENTITIES="name=<pubkey|address|xpub>" xogrid-server
# Set DATABASE_URL (PostgreSQL) to use a hosted database instead of the SQLite file in /data.
FROM node:22-slim AS build
# Build tools are only needed if a native module (better-sqlite3) has no prebuilt binary for the platform.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/data/hub.db
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "dist/index.js"]
