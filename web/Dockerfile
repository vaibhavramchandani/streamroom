# Build from the repo root: docker build -f web/Dockerfile .
# (the design tokens live in replica/design, outside web/)
FROM node:22-alpine AS build
WORKDIR /app
COPY web/package.json web/package-lock.json web/
# `npm install`, not `npm ci`: the lockfile was written on Windows and lacks Linux-only optional packages.
RUN cd web && npm install --no-audit --no-fund
COPY web web
COPY replica/design replica/design
# The browser calls the API directly, so this is the URL as seen from the user's machine.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL
RUN cd web && npm run build

FROM nginx:1.27-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
