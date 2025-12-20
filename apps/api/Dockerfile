# Base image with Node.js
FROM node:22-slim

# Install system dependencies for PDF parsing
RUN apt-get update && apt-get install -y \
    poppler-utils \
    binutils \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

# Set working directory
WORKDIR /app

# Copy root package files for workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy app package.json
COPY apps/api/package.json apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @analyzer/api...

# Copy application code
COPY apps/api apps/api
COPY prisma prisma

# Generate Prisma client
RUN cd apps/api && pnpm exec prisma generate

# Build the application
RUN pnpm --filter @analyzer/api run build

# Expose port
EXPOSE 8080

# Start the application
CMD ["node", "apps/api/dist/src/main.js"]
