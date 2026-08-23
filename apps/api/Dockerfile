# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo configuration files
COPY package*.json ./
COPY packages/shared-types/package*.json ./packages/shared-types/
COPY packages/config/package*.json ./packages/config/
COPY packages/validation/package*.json ./packages/validation/
COPY apps/api/package*.json ./apps/api/

# Install dependencies
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Build shared packages and API
RUN npm run build:packages
RUN npm --workspace=@schedulai/api run build

# Stage 2: Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy root and package manifests for runtime production install
COPY package*.json ./
COPY packages/shared-types/package*.json ./packages/shared-types/
COPY packages/config/package*.json ./packages/config/
COPY packages/validation/package*.json ./packages/validation/
COPY apps/api/package*.json ./apps/api/

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled artifacts from builder stage
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/validation/dist ./packages/validation/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Security: run as non-root user
USER node

EXPOSE 5000

CMD ["node", "apps/api/dist/src/index.js"]
