FROM node:18-alpine as frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
# Install dependencies with clean npm install and use production flag for optimization
RUN npm install --no-fund
COPY frontend/ ./
RUN npm run build

FROM node:18-alpine

# Install ffmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy backend files
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./

# Copy frontend build
COPY --from=frontend-build /app/frontend/build /app/public

# Create data directory for stream configuration
RUN mkdir -p /app/data
RUN mkdir -p /app/data/hls

# Set proper permissions
RUN chmod -R 755 /app/data

EXPOSE 8080
EXPOSE 8088

CMD ["node", "server.js"]
