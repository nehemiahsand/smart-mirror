FROM python:3.11-slim

# Install system dependencies for audio and build tools
RUN apt-get update && apt-get install -y \
    portaudio19-dev \
    python3-pyaudio \
    alsa-utils \
    flac \
    gcc \
    g++ \
    make \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache

# Download Vosk model (small English model - ~50MB)
RUN wget -q https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip \
    && unzip vosk-model-small-en-us-0.15.zip \
    && mv vosk-model-small-en-us-0.15 model \
    && rm vosk-model-small-en-us-0.15.zip

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service
COPY voice_service.py .

# Run the voice recognition service
CMD ["python3", "-u", "voice_service.py"]
