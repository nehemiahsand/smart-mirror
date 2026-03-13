"""
Camera service with native MJPEG preview and low-frequency detection.

The webcam already produces MJPEG natively. The efficient path is to let ffmpeg
own the camera, forward those JPEG frames unchanged for preview, and only
decode occasional samples for motion / brightness / person detection.
"""

import logging
import os
import subprocess
import threading
import time

import cv2
import mediapipe as mp
import numpy as np
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


class PersonDetector:
    def __init__(self, camera_index=0):
        self.camera_index = camera_index
        self.enabled = True

        self.capture_width = env_int("CAMERA_CAPTURE_WIDTH", 1280)
        self.capture_height = env_int("CAMERA_CAPTURE_HEIGHT", 720)
        self.capture_fps = max(env_int("CAMERA_CAPTURE_FPS", 10), 1)
        self.stream_fps = max(env_float("CAMERA_STREAM_FPS", float(self.capture_fps)), 1.0)
        self.ai_process_interval = max(env_float("CAMERA_AI_INTERVAL_SECONDS", 5.0), 1.0)
        self.detection_sample_interval = max(env_float("CAMERA_DETECTION_SAMPLE_INTERVAL_SECONDS", 1.0), 0.2)
        self.disable_dynamic_framerate = env_bool("CAMERA_DISABLE_DYNAMIC_FRAMERATE", True)

        self.ffmpeg_process = None
        self.capture_active = False
        self.capture_lock = threading.Lock()

        self.stream_condition = threading.Condition()
        self.stream_viewers = 0
        self.latest_stream_jpeg = None
        self.latest_stream_frame_id = 0
        self.last_published_stream_time = 0.0

        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=0,
            smooth_landmarks=False,
            enable_segmentation=False,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.7,
        )

        self.prev_frame_gray = None
        self.motion_threshold = 1500
        self.motion_detected = False

        self.person_detected = False
        self.last_detection_time = None
        self.detection_cooldown = 1.0
        self.last_ai_process_time = 0.0
        self.last_detection_sample_time = 0.0
        self.ai_skip_count = 0
        self.total_detections = 0

        self.brightness = 100
        self.is_dark = False
        self.dark_threshold = 30
        self.light_threshold = 50

        self.fps = 0.0
        self.last_fps_time = time.time()
        self.frame_count = 0

    def build_ffmpeg_command(self):
        return [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-fflags",
            "nobuffer",
            "-f",
            "v4l2",
            "-input_format",
            "mjpeg",
            "-framerate",
            str(self.capture_fps),
            "-video_size",
            f"{self.capture_width}x{self.capture_height}",
            "-i",
            f"/dev/video{self.camera_index}",
            "-an",
            "-c:v",
            "copy",
            "-f",
            "mjpeg",
            "pipe:1",
        ]

    def initialize_capture(self):
        with self.capture_lock:
            if self.ffmpeg_process and self.ffmpeg_process.poll() is None:
                return True

            self.configure_camera_controls()
            command = self.build_ffmpeg_command()
            try:
                self.ffmpeg_process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    bufsize=0,
                )
                self.capture_active = True
                logger.info(
                    "Native MJPEG capture started (%sx%s @ %sfps)",
                    self.capture_width,
                    self.capture_height,
                    self.capture_fps,
                )
                threading.Thread(target=self._drain_ffmpeg_stderr, daemon=True).start()
                return True
            except Exception as error:
                logger.error("Failed to start ffmpeg capture: %s", error)
                self.ffmpeg_process = None
                self.capture_active = False
                return False

    def configure_camera_controls(self):
        if not self.disable_dynamic_framerate:
            return

        device = f"/dev/video{self.camera_index}"
        command = [
            "v4l2-ctl",
            "--device",
            device,
            "--set-ctrl=exposure_dynamic_framerate=0",
        ]

        try:
            subprocess.run(
                command,
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                text=True,
            )
        except FileNotFoundError:
            logger.warning("v4l2-ctl not available; cannot disable dynamic framerate on %s", device)
        except subprocess.CalledProcessError as error:
            stderr = (error.stderr or "").strip()
            if stderr:
                logger.warning("Failed to disable dynamic framerate on %s: %s", device, stderr)
            else:
                logger.warning("Failed to disable dynamic framerate on %s", device)

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

        while self.enabled and process.poll() is None:
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

        if current_time - self.last_detection_sample_time < self.detection_sample_interval:
            return

        self.last_detection_sample_time = current_time
        frame_array = np.frombuffer(jpeg_bytes, dtype=np.uint8)
        frame = cv2.imdecode(frame_array, cv2.IMREAD_COLOR)
        if frame is None:
            return

        self.detect_brightness(frame)
        self.process_ai_detection(frame, current_time)

    def detect_motion(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        small_gray = cv2.resize(gray, (160, 120))

        if self.prev_frame_gray is None:
            self.prev_frame_gray = small_gray
            return True

        frame_diff = cv2.absdiff(self.prev_frame_gray, small_gray)
        motion_pixels = cv2.countNonZero(cv2.threshold(frame_diff, 25, 255, cv2.THRESH_BINARY)[1])
        self.prev_frame_gray = small_gray
        self.motion_detected = motion_pixels > self.motion_threshold
        return self.motion_detected

    def detect_brightness(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        self.brightness = int(gray.mean())

        if self.is_dark and self.brightness > self.light_threshold:
            self.is_dark = False
            logger.info("Room is now LIGHT (brightness: %s)", self.brightness)
        elif not self.is_dark and self.brightness < self.dark_threshold:
            self.is_dark = True
            logger.info("Room is now DARK (brightness: %s)", self.brightness)

        return self.brightness

    def detect_person(self, frame):
        small_frame = cv2.resize(frame, (160, 120))
        rgb_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        results = self.pose.process(rgb_frame)

        if results.pose_landmarks is None:
            return False

        landmarks = results.pose_landmarks.landmark
        required_landmarks = [
            self.mp_pose.PoseLandmark.NOSE,
            self.mp_pose.PoseLandmark.LEFT_SHOULDER,
            self.mp_pose.PoseLandmark.RIGHT_SHOULDER,
        ]

        visible_count = 0
        for landmark_idx in required_landmarks:
            landmark = landmarks[landmark_idx.value]
            if landmark.visibility > 0.7:
                visible_count += 1

        return visible_count >= 3

    def process_ai_detection(self, frame, current_time):
        if not self.detect_motion(frame):
            self.ai_skip_count += 1
            if self.ai_skip_count % 10 == 0:
                logger.info("AI skipped %s times (no motion)", self.ai_skip_count)

            if (
                self.person_detected
                and self.last_detection_time
                and (current_time - self.last_detection_time) > 2.0
            ):
                self.person_detected = False
                logger.info("Person no longer detected (no motion)")
            return

        if current_time - self.last_ai_process_time < self.ai_process_interval:
            return

        self.last_ai_process_time = current_time
        person_found = self.detect_person(frame)

        if person_found:
            if (
                not self.person_detected
                or self.last_detection_time is None
                or (current_time - self.last_detection_time) > self.detection_cooldown
            ):
                self.total_detections += 1
                logger.info(
                    "Person detected (total=%s, ai_skips=%s)",
                    self.total_detections,
                    self.ai_skip_count,
                )
            self.person_detected = True
            self.last_detection_time = current_time
        elif self.person_detected and self.last_detection_time and (
            current_time - self.last_detection_time
        ) > 2.0:
            self.person_detected = False
            logger.info("Person no longer detected (motion but no person found)")

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

                self.stream_condition.wait(remaining)

    def release(self):
        self.stop_capture()

    def close(self):
        self.stop_capture()
        self.pose.close()


detector = PersonDetector(camera_index=0)


def capture_loop():
    logger.info(
        "Starting native MJPEG camera loop (%sx%s @ %sfps, detection sample every %ss, AI every %ss)",
        detector.capture_width,
        detector.capture_height,
        detector.capture_fps,
        detector.detection_sample_interval,
        detector.ai_process_interval,
    )

    while True:
        try:
            if not detector.enabled:
                if detector.capture_active:
                    logger.info("Camera disabled - stopping capture")
                    detector.stop_capture()
                time.sleep(0.5)
                continue

            if not detector.initialize_capture():
                time.sleep(5)
                continue

            detector.process_mjpeg_stream()
            logger.warning("MJPEG capture stream ended - restarting")
            detector.stop_capture()
            time.sleep(1)
        except Exception as error:
            logger.error("Error in camera loop: %s", error)
            detector.stop_capture()
            time.sleep(1)


threading.Thread(target=capture_loop, daemon=True).start()


@app.route("/health", methods=["GET"])
def health():
    process = detector.ffmpeg_process
    return jsonify(
        {
            "status": "ok",
            "camera_active": bool(process and process.poll() is None),
            "stream_viewers": detector.stream_viewers,
        }
    )


@app.route("/detection/status", methods=["GET"])
def detection_status():
    return jsonify(
        {
            "enabled": detector.enabled,
            "person_detected": detector.person_detected,
            "motion_detected": detector.motion_detected,
            "last_detection": detector.last_detection_time,
            "total_detections": detector.total_detections,
            "ai_skip_count": detector.ai_skip_count,
            "fps": round(detector.fps, 1),
            "brightness": detector.brightness,
            "is_dark": detector.is_dark,
            "stream_viewers": detector.stream_viewers,
            "capture_resolution": {
                "width": detector.capture_width,
                "height": detector.capture_height,
            },
            "stream_resolution": {
                "width": detector.capture_width,
                "height": detector.capture_height,
            },
            "stream_fps_limit": detector.stream_fps,
        }
    )


@app.route("/control/enable", methods=["POST"])
def enable_camera():
    detector.enabled = True
    logger.info("Camera input ENABLED via control endpoint")
    return jsonify({"success": True, "enabled": True})


@app.route("/control/disable", methods=["POST"])
def disable_camera():
    detector.enabled = False
    logger.info("Camera input DISABLED via control endpoint")
    return jsonify({"success": True, "enabled": False})


@app.route("/video/raw")
def video_raw():
    def generate():
        detector.add_stream_viewer()
        last_frame_id = 0
        try:
            while True:
                frame, frame_id = detector.wait_for_stream_frame(last_frame_id)
                if frame is None or frame_id == last_frame_id:
                    continue

                last_frame_id = frame_id
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
        finally:
            detector.remove_stream_viewer()

    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")


if __name__ == "__main__":
    logger.info("Camera service starting on port 5556...")
    app.run(host="0.0.0.0", port=5556, threaded=True, debug=False)
