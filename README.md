# RestreamStream

A powerful IPTV stream re-broadcaster with monitoring and management capabilities, featuring a modern dark-themed UI. Designed to run in a Docker container on Ubuntu Server.

![RestreamStream](https://user-images.githubusercontent.com/4341881/177691307-5c214876-20e7-4126-92a9-d919ab4f6e26.png)

## Features

- **24/7 Stream Monitoring**: Automatically detects and recovers from stream failures
- **Modern Dark-Themed UI**: Sleek interface with animated components and gradient effects
- **Multiple Format Support**: Works with m3u8, ts, mpeg2 and other formats
- **HTTP Output**: All streams are available over HTTP on port 8088
- **Backup & Restore**: Export/import your stream configurations
- **Docker Support**: Easy deployment on any Ubuntu Server
- **Health Monitoring**: Track the status and health of each stream
- **Low Resource Usage**: Designed to be CPU friendly
- **Responsive Design**: Works on desktop and mobile devices

## Requirements

- Ubuntu Server 20.04 LTS or newer
- Docker 20.10+ and Docker Compose V2
- Internet connection for accessing source streams

## Deployment on Ubuntu Server

### 1. Install Docker and Docker Compose

If you don't have Docker installed, run the following commands:

```bash
# Update package index
sudo apt update

# Install prerequisites
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

# Add Docker repository
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.15.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add your user to the docker group (to use Docker without sudo)
sudo usermod -aG docker $USER

# Apply the new group membership (or you can log out and log back in)
newgrp docker
```

### 2. Clone and Deploy RestreamStream

```bash
# Clone the repository
git clone https://github.com/yourusername/restreamstream.git
cd restreamstream

# Create necessary directories
mkdir -p data/hls logs

# Build and start the Docker container
docker-compose up -d

# Check if the container is running
docker-compose ps
```

### 3. Access the Web Interface

Open your browser and navigate to:
```
http://your-server-ip:8080
```

## Docker Compose Configuration

The `docker-compose.yml` file is configured with:

```yaml
version: '3'

services:
  restream-app:
    build: 
      context: .
      dockerfile: Dockerfile
    container_name: restream-app
    ports:
      - "8080:8080"  # Web interface
      - "8088:8088"  # Streaming output
    volumes:
      - ./data:/app/data
      - ./data/hls:/app/data/hls
      - ./logs:/app/logs
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=8080
      - STREAMS_PORT=8088
      - LOG_LEVEL=info
      - MAX_RECONNECT_ATTEMPTS=10
      - RECONNECT_DELAY=5
      - HEALTH_CHECK_INTERVAL=30
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8080/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
```

## Updating the Application

To update to the latest version:

```bash
# Pull the latest code
git pull

# Rebuild and restart the container
docker-compose down
docker-compose build
docker-compose up -d
```

## Adding Streams

1. Access the web interface at `http://your-server-ip:8080`
2. Go to the "Streams" section
3. Click "Add Stream"
4. Enter a name and the source URL for your stream
5. Click "Add Stream"

## Accessing Re-streamed Content

Each stream is accessible via HTTP at:
```
http://your-server-ip:8088/stream-id
```

Where `stream-id` is the UUID assigned to your stream when it was created.

You can easily copy this URL from the stream details page.

## Stream Management

- **Start/Stop**: Control individual streams
- **Restart**: Manually restart a stream if needed
- **Edit**: Change stream name or source URL
- **Delete**: Remove streams you no longer need

## Monitoring

The dashboard provides an overview of:
- Total number of streams
- Running streams
- Streams with health issues
- Status distribution (running, stopped, error)
- Health distribution (good, degraded, failed, unknown)
- System resource usage (CPU, memory, disk)

## Backup and Restore

### Backup
1. Go to "Settings"
2. Click "Export Configuration"
3. Save the JSON file to a secure location

### Restore
1. Go to "Settings"
2. Click "Upload Backup File" or paste the backup JSON
3. Click "Import Configuration"

## Troubleshooting

### Container not starting
```bash
# Check container logs
docker-compose logs

# Verify container status
docker-compose ps
```

### Stream not starting
- Check if the source URL is valid and accessible
- Ensure FFmpeg can handle the input format
- Check the server logs for specific errors:
```bash
docker-compose logs | grep ERROR
```

### High CPU usage
- Reduce the number of concurrent streams
- Use lower quality source streams
- Consider upgrading your server resources

### Stream buffering or stuttering
- Check your network bandwidth
- Verify the source stream quality
- Ensure your server has adequate resources

### Accessing logs
```bash
# View all logs
docker-compose logs

# View real-time logs
docker-compose logs -f

# View last 100 lines
docker-compose logs --tail=100
```

## Development

### Backend

The backend is built with Node.js and Express:

```
cd backend
npm install
npm run dev
```

### Frontend

The frontend is built with React and Material-UI:

```
cd frontend
npm install
npm start
```

## Building for Production

```
docker-compose build
docker-compose up -d
```

## License

MIT

## Acknowledgements

- FFmpeg for handling the streaming
- Node.js for the backend
- React and Material-UI for the frontend
- Framer Motion for animations
- Chart.js for data visualization
