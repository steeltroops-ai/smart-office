# Smart Office - Docker Build for Render.com
FROM oven/bun:1-alpine
WORKDIR /app

# 1. Copy package files
COPY package.json ./
COPY bun.lock ./

# 2. Install dependencies
RUN bun install --frozen-lockfile --production

# 3. Copy source code
COPY src ./src
COPY templates ./templates

# 4. Create data directory for documents
RUN mkdir -p /app/data

# 5. Build the frontend
RUN bun run build:client

# 6. Expose port
ENV PORT=8080
EXPOSE 8080

# 7. Start the server
CMD ["bun", "run", "src/server/index.ts"]
