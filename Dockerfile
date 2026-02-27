FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (including dev deps so prisma can generate)
COPY package*.json ./
RUN npm ci

# Copy source and generate Prisma client
COPY . .
RUN npx prisma generate || true

# Production image
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy only necessary files from build stage
COPY --from=builder /app .

# Install production dependencies only
RUN npm ci --production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

USER node
CMD ["node", "server.js"]
