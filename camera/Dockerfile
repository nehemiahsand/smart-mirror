FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    v4l-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY camera_service.py .

EXPOSE 5556

CMD ["python3", "camera_service.py"]
