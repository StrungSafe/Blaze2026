# Template tools (templates/web): a static page served by nginx. Dev-only tool; see web/README.md.
#
# Build with templates/ as the context:
#   cd templates && docker build -t xogrid-template-tools .
#   (or, from the repo root: docker build -t xogrid-template-tools templates)
#   docker run --rm -p 8080:8080 xogrid-template-tools        # http://localhost:8080
#
# templates/.dockerignore lets only the files the build needs into the context, so the chipnet test wallet in
# .xo-demo (mnemonic, keys) never reaches the build.

FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
# --ignore-scripts: the static build needs no native modules (sqlite drivers are only for the XO engine's wallet store,
# which the page replaces with stand-ins).
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY . ./
RUN npm run web:build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 8080
