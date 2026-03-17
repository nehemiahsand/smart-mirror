import logging
import os
import subprocess
import threading
import time

from flask import Flask, Response, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def env_int(name, default):
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default

def env_float(name, default):
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default

def env_bool(name, default):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}

class CameraStreamer:
    def __init__(self, camera_index=0):
        self.camera_index = camera_index
        self.enabled = True

        self.capture_width = env_int("CAMERA_CAPTURE_WIDTH", 1280)
        self.capture_height = env_int("CAMERA_CAPTURE_HEIGHT", 720)
        self.capture_fps = max(env_int("CAMERA_CAPTURE_FPS", 10), 1)
        self.stream_fps = max(env_float("CAMERA_STREAM_FPS", float(self.capture_fps)), 1.0)

        self.ffmpeg_process = None
        self.capture_active = False
        self.capture_lock = threading.Lock()

        self.stream_condition = threading.Condition()
        self.stream_viewers = 0
        self.latest_stream_jpeg = None
        self.latest_stream_frame_id = 0
        self.last_published_stream_time = 0.0

        self.fps = 0.0
        self.last_fps_time = time.time()
        self.frame_count = 0

    def build_ffmpeg_command(self):
        return [
            "ffmpeg",
            "-hide_banner",
            "-loglevel", "error",
            "-fflags", "nobuffer",
            "-f", "v4l2",
            "-input_format", "mjpeg",
            "-framerate", str(self.capture_fps),
            "-video_size", f"{self.capture_width}x{self.capture_height}",
            "-i", f"/dev/video{self.camera_index}",
            "-an",
            "-c:v", "copy",
            "-f", "mjpeg",
            "pipe:1",
        ]

    def initialize_capture(self):
        with self.capture_lock:
            if self.ffmpeg_process and self.ffmpeg_process.poll() is None:
                return True

            command = self.build_ffmpeg_command()
            try:
                self.ffmpeg_process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    bufsize=0,
                )
                self.capture_active = True
                logger.info("Native MJPEG capture started (%sx%s @ %sfps)", self.capture_width, self.capture_height, self.capture_fps)
                threading.Thread(target=self._drain_ffmpeg_stderr, daemon=True).start()
                return True
            except Exception as error:
                logger.error("Failed to start ffmpeg capture: %s", error)
                self.ffmpeg_process = None
                self.capture_active = False
                return False

    def _drain_ffmpeg_stderr(self):
        process = self.ffmpeg_process
        if not process or not process.stderr:
            return

        for raw_line in iter(process.stderr.readline, b""):
            line = raw_line.decode("utf-8", errors="ignore").strip()
            if line:
                logger.warning("ffmpeg: %s", line)

    def stop_capture(self):
        with self.capture_lock:
            process = self.ffmpeg_process
            self.ffmpeg_process = None
            self.capture_active = False

        if process:
            try:
                process.terminate()
                process.wait(timeout=2)
            except Exception:
                process.kill()
                try:
                    process.wait(timeout=1)
                except Exception:
                    pass

        self.latest_stream_jpeg = None
        with self.stream_condition:
            self.latest_stream_frame_id += 1
            self.stream_condition.notify_all()

    def process_mjpeg_stream(self):
        process = self.ffmpeg_process
        if not process or not process.stdout:
            return

        buffer = bytearray()
        stdout = process.stdout

        while self.enabled and self.stream_viewers > 0 and process.poll() is None:
            chunk = stdout.read(65536)
            if not chunk:
                break

            buffer.extend(chunk)

            while True:
                start = buffer.find(b"\xff\xd8")
                if start == -1:
                    if len(buffer) > 1:
                        del buffer[:-1]
                    break

                end = buffer.find(b"\xff\xd9", start + 2)
                if end == -1:
                    if start > 0:
                        del buffer[:start]
                    if len(buffer) > 8 * 1024 * 1024:
                        del buffer[:-2]
                    break

                frame = bytes(buffer[start : end + 2])
                del buffer[: end + 2]
                self.handle_jpeg_frame(frame)

    def handle_jpeg_frame(self, jpeg_bytes):
        current_time = time.time()
        min_interval = 1.0 / self.stream_fps
        
        if current_time - self.last_published_stream_time >= min_interval:
            with self.stream_condition:
                self.latest_stream_jpeg = jpeg_bytes
                self.latest_stream_frame_id += 1
                self.stream_condition.notify_all()
            self.last_published_stream_time = current_time

        self.calculate_fps()

    def calculate_fps(self):
        self.frame_count += 1
        current_time = time.time()
        elapsed = current_time - self.last_fps_time

        if elapsed >= 1.0:
            self.fps = self.frame_count / elapsed
            self.frame_count = 0
            self.last_fps_time = current_time

    def add_stream_viewer(self):
        with self.stream_condition:
            self.stream_viewers += 1
            logger.info("Video stream connected (viewers=%s)", self.stream_viewers)

    def remove_stream_viewer(self):
        with self.stream_condition:
            self.stream_viewers = max(0, self.stream_viewers - 1)
            logger.info("Video stream disconnected (viewers=%s)", self.stream_viewers)

    def wait_for_stream_frame(self, last_frame_id, timeout=2.0):
        deadline = time.time() + timeout
        with self.stream_condition:
            while True:
                if self.latest_stream_jpeg is not None and self.latest_stream_frame_id != last_frame_id:
                    return self.latest_stream_jpeg, self.latest_stream_frame_id

                remaining = deadline - time.time()
                if remaining <= 0:
                    return None, last_frame_id
                self.stream_condition.wait(timeout=remaining)

    def close(self):
        self.stop_capture()


streamer = CameraStreamer(camera_index=0)

def capture_loop():
    logger.info("Starting lightweight native MJPEG camera loop (%sx%s @ %sfps)", streamer.capture_width, streamer.capture_height, streamer.capture_fps)
    while True:
        try:
            if streamer.stream_viewers == 0:
                if streamer.capture_active:
                    logger.info("0 viewers - stopping capture to save power")
                    streamer.stop_capture()
                time.sleep(0.5)
                continue

            if not streamer.initialize_capture():
                time.sleep(5)
                continue

            streamer.process_mjpeg_stream()
            logger.warning("MJPEG capture stream ended - restarting")
            streamer.stop_capture()
            time.sleep(1)
        except Exception as error:
            logger.error("Error in camera loop: %s", error)
            streamer.stop_capture()
            time.sleep(1)

threading.Thread(target=capture_loop, daemon=True).start()

@app.route("/health", methods=["GET"])
def health():
    process = streamer.ffmpeg_process
    return jsonify({
        "status": "ok",
        "camera_active": bool(process and process.poll() is None),
        "stream_viewers": streamer.stream_viewers,
    })

@app.route("/detection/status", methods=["GET"])
def detection_status():
    # Return dummy data to keep backend happy, but no AI logic is running.
    return jsonify({
        "enabled": streamer.enabled,
        "person_detected": False,
        "motion_detected": False,
        "last_detection": None,
        "total_detections": 0,
        "ai_skip_count": 0,
        "fps": round(streamer.fps, 1),
        "brightness": 100,
        "is_dark": False,
        "stream_viewers": streamer.stream_viewers,
        "capture_resolution": {
            "width": streamer.capture_width,
            "height": streamer.capture_height,
        },
        "stream_resolution": {
            "width": streamer.capture_width,
            "height": streamer.capture_height,
        },
        "stream_fps_limit": streamer.stream_fps,
    })

@app.route("/control/enable", methods=["POST"])
def enable_camera():
    streamer.enabled = True
    return jsonify({"success": True, "enabled": True})

@app.route("/control/disable", methods=["POST"])
def disable_camera():
    streamer.enabled = False
    return jsonify({"success": True, "enabled": False})

@app.route("/video/raw")
def video_raw():
    def generate():
        streamer.add_stream_viewer()
        last_frame_id = 0
        try:
            while True:
                frame, frame_id = streamer.wait_for_stream_frame(last_frame_id)
                if frame is None or frame_id == last_frame_id:
                    continue
                last_frame_id = frame_id
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
        finally:
            streamer.remove_stream_viewer()

    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")

if __name__ == "__main__":
    logger.info("Mjpeg streaming service starting on port 5556 without AI features...")
    app.run(host="0.0.0.0", port=5556, threaded=True, debug=False)
