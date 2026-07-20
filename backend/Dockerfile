FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# [FIX] Previously ran as root (the default for node:20-alpine unless
# switched). The image already ships a low-privilege "node" user — just
# needed to actually use it. chown happens before the switch since files
# copied while still root default to root ownership.
RUN chown -R node:node /app
USER node
EXPOSE 9000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:9000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["node", "server.js"]
