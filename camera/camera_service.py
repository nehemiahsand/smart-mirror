"""
Camera Service with AI-based Person Detection
Uses MediaPipe Pose Detection (ultra-optimized for low power)
"""

import cv2
import mediapipe as mp
import time
import threading
from flask import Flask, Response, jsonify
from flask_cors import CORS
import logging

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PersonDetector:
    def __init__(self, camera_index=0):
        self.camera_index = camera_index
        self.camera = None
        
        # MediaPipe Pose with maximum optimization
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=0,  # Lightest model
            smooth_landmarks=False,  # Disable smoothing
            enable_segmentation=False,  # Disable segmentation
            min_detection_confidence=0.5,  # Higher threshold to reduce false positives
            min_tracking_confidence=0.5
        )
        
        # Motion detection (pre-screening before AI)
        self.prev_frame_gray = None
        self.motion_threshold = 1500  # Minimum pixel difference to trigger AI
        self.motion_detected = False
        
        # Detection state
        self.person_detected = False
        self.last_detection_time = None
        self.detection_cooldown = 1.0  # seconds
        self.frame = None
        self.raw_frame = None  # Store raw frame without overlay
        self.frame_lock = threading.Lock()
        self.stream_active = False  # Track if anyone is watching the stream
        
        # Statistics
        self.total_detections = 0
        self.fps = 0
        self.last_fps_time = time.time()
        self.frame_count = 0
        self.last_ai_process_time = 0  # Track when AI last ran
        self.ai_process_interval = 5.0  # Run AI detection every 5 seconds (ultra-optimized)
        self.ai_skip_count = 0  # Count how many times AI was skipped due to no motion
        
    def initialize_camera(self):
        """Initialize camera with retry logic"""
        max_retries = 5
        for attempt in range(max_retries):
            try:
                self.camera = cv2.VideoCapture(self.camera_index)
                if self.camera.isOpened():
                    # Set camera to maximum resolution for widest field of view
                    self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                    self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                    self.camera.set(cv2.CAP_PROP_FPS, 10)  # 10 FPS for smoother video stream
                    self.camera.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Reduce buffer for lower latency
                    logger.info(f"Camera initialized successfully on attempt {attempt + 1}")
                    return True
                else:
                    logger.warning(f"Camera open failed on attempt {attempt + 1}")
                    time.sleep(1)
            except Exception as e:
                logger.error(f"Camera initialization error: {e}")
                time.sleep(1)
        
        logger.error("Failed to initialize camera after all retries")
        return False
    
    def detect_motion(self, frame):
        """
        Fast motion detection using frame differencing
        Returns True if significant motion detected (pre-screens for AI)
        This is MUCH faster than running AI - only ~0.1% CPU
        """
        # Convert to grayscale and downsample for speed
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        small_gray = cv2.resize(gray, (160, 120))
        
        # First frame - just store and return True to run AI once
        if self.prev_frame_gray is None:
            self.prev_frame_gray = small_gray
            return True
        
        # Calculate difference between frames
        frame_diff = cv2.absdiff(self.prev_frame_gray, small_gray)
        
        # Count pixels with significant change
        motion_pixels = cv2.countNonZero(cv2.threshold(frame_diff, 25, 255, cv2.THRESH_BINARY)[1])
        
        # Update previous frame
        self.prev_frame_gray = small_gray
        
        # Return True if enough motion detected
        self.motion_detected = motion_pixels > self.motion_threshold
        return self.motion_detected
    
    def detect_person(self, frame):
        """
        Detect person using MediaPipe Pose (ultra-optimized)
        Returns True if a person is detected with high confidence
        """
        # Downsample to 160x120 for ultra-low CPU usage (75% reduction from 320x240)
        small_frame = cv2.resize(frame, (160, 120))
        
        # Convert BGR to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        
        # Process frame
        results = self.pose.process(rgb_frame)
        
        # Check if pose detected with validation
        if results.pose_landmarks is None:
            return False
        
        # Validate that we have key body landmarks (reduce false positives)
        # Check for nose, shoulders, and hips - core body parts
        landmarks = results.pose_landmarks.landmark
        required_landmarks = [
            self.mp_pose.PoseLandmark.NOSE,
            self.mp_pose.PoseLandmark.LEFT_SHOULDER,
            self.mp_pose.PoseLandmark.RIGHT_SHOULDER,
        ]
        
        # Count how many required landmarks have good visibility
        visible_count = 0
        for landmark_idx in required_landmarks:
            landmark = landmarks[landmark_idx.value]
            # Check visibility (>0.5 means landmark is visible and confident)
            if landmark.visibility > 0.5:
                visible_count += 1
        
        # Require at least 2 out of 3 key landmarks to be visible
        return visible_count >= 2
    
    def calculate_fps(self):
        """Calculate current FPS"""
        self.frame_count += 1
        current_time = time.time()
        elapsed = current_time - self.last_fps_time
        
        if elapsed >= 1.0:
            self.fps = self.frame_count / elapsed
            self.frame_count = 0
            self.last_fps_time = current_time
    
    def process_frame(self):
        """Process a single frame - reads camera and stores raw frame"""
        if not self.camera or not self.camera.isOpened():
            return None
        
        ret, frame = self.camera.read()
        if not ret:
            logger.warning("Failed to read frame from camera")
            return None
        
        current_time = time.time()
        
        # Only store raw frame if someone is actively streaming (saves CPU on encoding)
        if self.stream_active:
            with self.frame_lock:
                self.raw_frame = frame.copy()
        
        # Only run AI detection once per second (instead of every frame)
        if current_time - self.last_ai_process_time >= self.ai_process_interval:
            self.last_ai_process_time = current_time
            self.process_ai_detection(frame.copy())
        
        # Calculate FPS
        self.calculate_fps()
        
        return frame
    
    def process_ai_detection(self, frame):
        """Run AI person detection on a frame (called less frequently, with motion pre-screening)"""
        # OPTIMIZATION: Only run expensive AI if motion detected
        if not self.detect_motion(frame):
            self.ai_skip_count += 1
            if self.ai_skip_count % 10 == 0:  # Log every 10 skips
                logger.info(f"AI skipped {self.ai_skip_count} times (no motion)")
            return
        
        # Motion detected - run AI person detection
        person_found = self.detect_person(frame)
        
        # Update detection state
        current_time = time.time()
        if person_found:
            if not self.person_detected or (current_time - self.last_detection_time) > self.detection_cooldown:
                self.person_detected = True
                self.last_detection_time = current_time
                self.total_detections += 1
                logger.info(f"Person detected! Total detections: {self.total_detections} (AI skipped {self.ai_skip_count} times)")
        else:
            # Only clear detection if cooldown has passed
            if self.person_detected and (current_time - self.last_detection_time) > 2.0:
                self.person_detected = False
                logger.info("Person no longer detected")
    
    def get_raw_jpeg_frame(self):
        """Get current raw frame as JPEG without overlay"""
        with self.frame_lock:
            if self.raw_frame is None:
                return None
            # Lower quality = faster encoding, less CPU
            _, jpeg = cv2.imencode('.jpg', self.raw_frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
            return jpeg.tobytes()
    
    def release(self):
        """Release camera resources"""
        if self.camera:
            self.camera.release()
        self.pose.close()

# Global detector instance
detector = PersonDetector(camera_index=0)

def detection_loop():
    """Main camera capture loop running in background thread"""
    if not detector.initialize_camera():
        logger.error("Camera initialization failed - detection disabled")
        return
    
    logger.info("Starting camera capture loop (10 FPS capture, AI detection every 5 seconds)...")
    while True:
        try:
            detector.process_frame()
            time.sleep(0.1)  # Capture at 10 FPS for smoother video
        except Exception as e:
            logger.error(f"Error in camera loop: {e}")
            time.sleep(1)

# Start detection thread
detection_thread = threading.Thread(target=detection_loop, daemon=True)
detection_thread.start()

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'camera_active': detector.camera is not None and detector.camera.isOpened()
    })

@app.route('/detection/status', methods=['GET'])
def detection_status():
    """Get current person detection status"""
    return jsonify({
        'person_detected': detector.person_detected,
        'motion_detected': detector.motion_detected,
        'last_detection': detector.last_detection_time,
        'total_detections': detector.total_detections,
        'ai_skip_count': detector.ai_skip_count,
        'fps': round(detector.fps, 1)
    })

@app.route('/video/raw')
def video_raw():
    """Video streaming route - raw feed without AI overlay"""
    def generate():
        detector.stream_active = True  # Mark stream as active
        try:
            while True:
                frame = detector.get_raw_jpeg_frame()
                if frame is None:
                    time.sleep(0.05)
                    continue
                
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
        finally:
            detector.stream_active = False  # Mark stream as inactive when connection closes
            logger.info("Video stream disconnected")
    
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    logger.info("Camera service starting on port 5556...")
    app.run(host='0.0.0.0', port=5556, threaded=True, debug=False)
