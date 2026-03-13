FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    libgl1 \
    ffmpeg \
    v4l-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV MPLCONFIGDIR=/tmp/matplotlib
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# MediaPipe lazily downloads the lite pose model at runtime when model_complexity=0.
# Bake it into the image so the container can run with a read-only root filesystem.
RUN python3 -c "import urllib.request; from pathlib import Path; target = Path('/usr/local/lib/python3.11/site-packages/mediapipe/modules/pose_landmark/pose_landmark_lite.tflite'); target.write_bytes(urllib.request.urlopen('https://storage.googleapis.com/mediapipe-assets/pose_landmark_lite.tflite').read())"

# Copy application code
COPY camera_service.py .

EXPOSE 5556

CMD ["python3", "camera_service.py"]
