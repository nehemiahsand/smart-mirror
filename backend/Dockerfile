FROM node:18-slim

# Install Python, network tools, X11/Wayland utilities, and dependencies for DHT22 sensor
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    network-manager \
    wireless-tools \
    iw \
    x11-xserver-utils \
    wlr-randr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install --only=production

# Install Python dependencies for DHT22
COPY src/sensors/requirements.txt ./sensors/
RUN pip3 install --no-cache-dir -r sensors/requirements.txt --break-system-packages

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "src/index.js"]
