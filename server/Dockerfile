# UNTESTED: the sandbox this was written in has no Docker daemon. Build it on your machine and fix anything that breaks.
FROM node:22-slim AS build
# Build tools are only needed if a native module (better-sqlite3, sqlite3) has no prebuilt binary for the platform.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json yarn.lock* ./
RUN yarn install
COPY tsconfig.json ./
COPY src ./src
RUN yarn build && yarn install --production

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
