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
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service
COPY voice_service.py .

# Run the voice recognition service
CMD ["python3", "-u", "voice_service.py"]
