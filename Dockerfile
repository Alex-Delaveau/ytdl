# Dockerfile

# Build Stage
FROM node:18-alpine AS build

# Set working directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Production Stage
FROM node:18-alpine

# Install necessary tools
RUN apk add --no-cache dumb-init ffmpeg curl

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create app directory and tmp folder with root permissions
WORKDIR /home/app
RUN mkdir -p /home/app/tmp && chown -R appuser:appgroup /home/app

# Switch to non-root user
USER appuser

# Copy node_modules and application files
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY . .

# Expose the application port
EXPOSE 8080

# Health check to ensure the container is running
HEALTHCHECK --interval=10m --timeout=5s \
  CMD curl -f http://localhost:$PORT || exit 1

# Start the application using dumb-init
CMD ["dumb-init", "node", "app.js"]
