# Use the official Bun image
FROM oven/bun:1 as base
WORKDIR /app

# 1. Install dependencies
# Copy package.json and lockfile (if exists)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# 2. Copy source code
COPY . .

# 3. Build the frontend
# This compiles TS to JS and bundles it to dist/ or src/client/js depending on your script
RUN bun run build:client

# 4. Expose the port Fly.io expects
# You mentioned internal port 8080 in your config
ENV PORT=8080
EXPOSE 8080

# 5. Start the server
CMD ["bun", "run", "src/server/index.ts"]
