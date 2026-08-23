# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package configurations
COPY package*.json ./
COPY packages/shared-types/package*.json ./packages/shared-types/
COPY packages/config/package*.json ./packages/config/
COPY packages/validation/package*.json ./packages/validation/
COPY apps/web/package*.json ./apps/web/

# Install dependencies
RUN npm ci

# Copy sources
COPY tsconfig.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Build shared packages and Web bundle
RUN npm run build:packages
RUN npm --workspace=@schedulai/web run build

# Stage 2: Web Server Stage (Nginx)
FROM nginx:alpine AS runner

# Copy compiled SPA static assets
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
