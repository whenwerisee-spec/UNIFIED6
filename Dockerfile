# Build stage
FROM node:22 AS builder
WORKDIR /app
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production runtime stage
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=10000

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public 2>/dev/null || true

EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:10000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/sbin/dumb-init", "--"]

CMD ["node", "dist/server.cjs"]
