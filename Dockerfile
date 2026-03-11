# Base image with Node.js
FROM node:22-slim

# Install system dependencies for PDF parsing and Prisma
RUN apt-get update && apt-get install -y \
    poppler-utils \
    binutils \
    openssl \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

# Set working directory
WORKDIR /app

# Copy root package files for workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy app package.json
COPY apps/api/package.json apps/api/

# Install dependencies (--ignore-scripts skips the prepare hook which runs lefthook install,
# which requires git — not available in the build layer)
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @dealwire/api...

# Copy application code
COPY apps/api apps/api

# Generate Prisma client
RUN cd apps/api && pnpm exec prisma generate

# Build the application
RUN pnpm --filter @dealwire/api run build

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD sh -c 'curl -sf http://localhost:${PORT:-3001}/health || exit 1'

# Start the application (runs prisma migrate deploy, then starts the server)
CMD cd apps/api && pnpm start
