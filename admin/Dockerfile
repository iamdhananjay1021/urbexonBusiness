FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ARG VITE_WS_URL=wss://api.urbexon.in
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
RUN npm run build

# [FIX] nginx:alpine runs as root by default and can't bind :80 as a
# non-root user without extra capabilities. nginxinc/nginx-unprivileged is
# the standard drop-in replacement: already configured to run as a
# low-privilege user and listen on 8080 instead. If this image is deployed
# via Docker (the primary path is Vercel per vercel.json), map the host/
# platform port to container port 8080 instead of 80.
FROM nginxinc/nginx-unprivileged:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
