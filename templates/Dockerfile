# Template tools (templates/web): a static page served by nginx. Dev-only tool; see web/README.md.
#
# Build from the repo root, because the page uses the logo from frontend/:
#   docker build -f templates/Dockerfile -t xogrid-template-tools .
#   docker run --rm -p 8080:8080 xogrid-template-tools        # http://localhost:8080
#
# templates/Dockerfile.dockerignore lets only the files the build needs into the context, so the chipnet test wallet in
# templates/.xo-demo (mnemonic, keys) never reaches the build.

FROM node:22-slim AS build
WORKDIR /repo/templates

COPY templates/package.json templates/package-lock.json ./
# --ignore-scripts: the static build needs no native modules (sqlite drivers are only for the XO engine's wallet store,
# which the page replaces with stand-ins).
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY frontend/src/assets/images/xogridlogo.png /repo/frontend/src/assets/images/xogridlogo.png
COPY templates ./
RUN npm run web:build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY templates/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/templates/web/dist /usr/share/nginx/html
EXPOSE 8080
