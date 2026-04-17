FROM node:18-slim

# Install only basic CA certificates for HTTPS
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Enable productions optimizations
ENV NODE_ENV=production
ENV IN_DOCKER=true

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy the rest of the application
COPY . .

# Build providers (requires node and esbuild which is in devDeps or main deps)
# Note: build.js is needed to bundle the providers
RUN node build.js || echo "Build failed, continuing anyway..."

EXPOSE 7000

# Start the addon directly
CMD ["node", "stremio_addon.js"]
