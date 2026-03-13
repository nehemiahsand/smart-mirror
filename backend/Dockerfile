FROM node:18-slim AS pwa-builder

WORKDIR /build/mobile-pwa

COPY mobile-pwa/package*.json ./
RUN npm ci

COPY mobile-pwa/ ./

RUN npm run build

FROM node:18-slim

# Install Python, network tools, X11/Wayland utilities, and dependencies for DHT22 sensor
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    dbus-bin \
    network-manager \
    wireless-tools \
    iw \
    x11-xserver-utils \
    wlr-randr \
    locales \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Set timezone to America/Chicago (CST/CDT)
ENV TZ=America/Chicago
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Generate and set UTF-8 locale
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen
ENV LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    LANGUAGE=en_US:en

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install Node dependencies
RUN npm install --omit=dev

# Install Python dependencies for DHT22
COPY backend/src/sensors/requirements.txt ./sensors/
RUN pip3 install --no-cache-dir -r sensors/requirements.txt --break-system-packages

# Copy application code
COPY backend/ ./
COPY --from=pwa-builder /build/mobile-pwa/dist ./public

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "src/index.js"]
