#!/usr/bin/env python3
"""
Voice Recognition Service for Smart Mirror
Continuous voice command listener (no wake word)
Uses Vosk for 100% offline/local speech recognition
"""

import requests
import time
import logging
import json
import os
from threading import Thread
import websocket
from vosk import Model, KaldiRecognizer
import pyaudio

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:3001").rstrip("/")
default_ws_url = BACKEND_URL.replace("https://", "wss://", 1).replace("http://", "ws://", 1)
WEBSOCKET_URL = os.environ.get("WEBSOCKET_URL", default_ws_url)
WEBSOCKET_BROADCAST_URL = f"{BACKEND_URL}/api/broadcast"
VOSK_MODEL_PATH = "/app/model"
API_KEY = os.environ.get("API_KEY")

# Audio configuration
SAMPLE_RATE = 16000
CHUNK_SIZE = 4000

# Voice commands mapping
COMMANDS = {
    # Navigation
    'fun': ['fun', 'comic', 'comics', 'calvin and hobbes', 'show comic', 'open comic', 'show fun', 'open fun'],
    'spotify': ['spotify', 'music', 'music player', 'player', 'open spotify', 'go to spotify', 'show spotify', 'show music'],
    'home': ['home', 'main page', 'go home', 'main', 'homepage', 'back home', 'return home', 'go back home', 'exit', 'close', 'back', 'go back'],
    
    # Playback controls
    'play': ['play', 'resume', 'start', 'unpause', 'play music', 'start playing', 'continue', 'play song'],
    'pause': ['pause', 'stop', 'stop music', 'pause music', 'halt'],
    'next': ['next', 'skip', 'next song', 'skip song', 'skip track', 'next track', 'forward', 'skip this'],
    'previous': ['previous', 'last song', 'go back', 'back', 'previous song', 'previous track', 'last track', 'rewind'],
    'volume_up': ['volume up', 'louder', 'turn it up', 'increase volume', 'raise volume'],
    'volume_down': ['volume down', 'quieter', 'turn it down', 'lower volume', 'decrease volume'],
    
    # Spotify specific
    'play_liked': ['play my liked songs', 'play liked songs', 'play favorites', 'play my favorites'],
}

class VoiceRecognitionService:
    def __init__(self):
        self.current_page = 'home'
        self.is_listening = False
        self.ws = None
        self.model = None
        self.recognizer = None
        self.audio = None
        self.stream = None
        self.voice_enabled = True
        self._last_settings_check = 0
        
        # Initialize Vosk model
        logger.info("Initializing Vosk speech recognition (100% offline)...")
        self.setup_vosk()
        
        # Sync current page from display on startup
        self.sync_page_from_display()
        
        # Start WebSocket listener in background thread
        self.start_websocket_listener()
        
    def setup_vosk(self):
        """Initialize Vosk model and audio stream"""
        try:
            # Check if model exists
            if not os.path.exists(VOSK_MODEL_PATH):
                logger.error(f"Vosk model not found at {VOSK_MODEL_PATH}")
                return False
            
            # Load the model
            logger.info(f"Loading Vosk model from {VOSK_MODEL_PATH}...")
            self.model = Model(VOSK_MODEL_PATH)
            self.recognizer = KaldiRecognizer(self.model, SAMPLE_RATE)
            
            # Initialize PyAudio
            self.audio = pyaudio.PyAudio()
            
            # Find and open the microphone
            logger.info("Opening microphone stream...")
            self.stream = self.audio.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=SAMPLE_RATE,
                input=True,
                frames_per_buffer=CHUNK_SIZE
            )
            
            logger.info("✅ Vosk initialized successfully (100% offline, no data sent to cloud)")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize Vosk: {e}")
            return False
    
    def sync_page_from_display(self):
        """Sync current page state from display via WebSocket subscription"""
        try:
            # Try to get stored page from localStorage via API
            headers = {"X-API-Key": API_KEY} if API_KEY else {}
            response = requests.get(f"{BACKEND_URL}/api/settings", timeout=2, headers=headers)
            if response.status_code == 200:
                data = response.json()
                # Check if there's a current_page stored
                stored_page = data.get('current_page', 'home')
                self.current_page = stored_page
                # Read voice enabled flag from settings
                try:
                    voice_cfg = data.get('voice', {}) or {}
                    self.voice_enabled = bool(voice_cfg.get('enabled', True))
                except Exception:
                    self.voice_enabled = True
                logger.info(f"📱 Synced page state: {self.current_page}")
            else:
                logger.info("📱 No stored page, defaulting to: home")
                self.current_page = 'home'
        except Exception as e:
            logger.debug(f"Could not sync page state: {e}")
            self.current_page = 'home'
    
    def start_websocket_listener(self):
        """Start WebSocket connection to listen for page changes"""
        def on_message(ws, message):
            try:
                data = json.loads(message)
                if data.get('type') == 'page_change':
                    new_page = data.get('page', 'home')
                    if new_page != self.current_page:
                        logger.info(f"📱 Page changed via WebSocket: {self.current_page} → {new_page}")
                        self.current_page = new_page
                elif data.get('type') == 'standby_change':
                    # When standby mode changes, re-sync the page
                    is_standby = data.get('standby', False)
                    self.voice_enabled = not is_standby
                    logger.info(f"🎤 Voice {'disabled' if is_standby else 'enabled'} due to standby_change")
                    if not is_standby:
                        logger.info(f"📱 Exiting standby mode, re-syncing page...")
                        time.sleep(1)  # Wait for display to update
                        self.sync_page_from_display()
            except Exception as e:
                logger.debug(f"WebSocket message error: {e}")
        
        def on_error(ws, error):
            logger.debug(f"WebSocket error: {error}")
        
        def on_close(ws, close_status_code, close_msg):
            logger.info("WebSocket connection closed, reconnecting in 5s...")
            time.sleep(5)
            self.start_websocket_listener()
        
        def on_open(ws):
            logger.info("📡 WebSocket connected - listening for page changes")
        
        def run_websocket():
            self.ws = websocket.WebSocketApp(
                WEBSOCKET_URL,
                on_open=on_open,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close
            )
            self.ws.run_forever()
        
        # Run WebSocket in background thread
        ws_thread = Thread(target=run_websocket, daemon=True)
        ws_thread.start()
    
    def send_page_command(self, page):
        """Send page navigation command via WebSocket broadcast"""
        try:
            payload = {
                'type': 'page_change',
                'page': page
            }
            headers = {"X-API-Key": API_KEY} if API_KEY else {}
            response = requests.post(WEBSOCKET_BROADCAST_URL, json=payload, timeout=2, headers=headers)
            if response.status_code == 200:
                logger.info(f"✅ Page changed to: {page}")
                self.current_page = page
                return True
            else:
                logger.error(f"Failed to change page: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Error sending page command: {e}")
            return False
    
    def send_spotify_command(self, action):
        """Send Spotify playback command"""
        try:
            endpoints = {
                'play': {'method': 'PUT', 'url': '/api/spotify/play'},
                'pause': {'method': 'PUT', 'url': '/api/spotify/pause'},
                'next': {'method': 'POST', 'url': '/api/spotify/next'},
                'previous': {'method': 'POST', 'url': '/api/spotify/previous'},
                'volume_up': {'method': 'PUT', 'url': '/api/spotify/volume', 'data': {'direction': 'up'}},
                'volume_down': {'method': 'PUT', 'url': '/api/spotify/volume', 'data': {'direction': 'down'}},
            }
            
            if action not in endpoints:
                logger.error(f"Unknown Spotify action: {action}")
                return False
            
            endpoint = endpoints[action]
            url = f"{BACKEND_URL}{endpoint['url']}"
            data = endpoint.get('data', {})
            headers = {"X-API-Key": API_KEY} if API_KEY else {}
            
            method = endpoint['method']
            if method == 'PUT':
                response = requests.put(url, json=data, timeout=2, headers=headers)
            else:
                response = requests.post(url, json=data, timeout=2, headers=headers)
            if response.status_code == 200:
                logger.info(f"✅ Spotify command executed: {action}")
                return True
            else:
                logger.error(f"Failed to execute Spotify command {action}: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending Spotify command: {e}")
            return False

    def matches_keyword(self, text_lower, keyword):
        """Match single words safely and phrases by substring."""
        if len(keyword.split()) == 1:
            return (
                f" {keyword} " in f" {text_lower} "
                or text_lower.startswith(keyword + " ")
                or text_lower.endswith(" " + keyword)
                or text_lower == keyword
            )
        return keyword in text_lower

    def matches_any(self, text_lower, command_name):
        """Check if text matches any keyword in a command group."""
        return any(self.matches_keyword(text_lower, keyword) for keyword in COMMANDS[command_name])
    
    def process_command(self, text):
        """Process voice command based on current page"""
        text_lower = text.lower().strip()
        logger.info(f"🔊 Heard: '{text}' (Page: {self.current_page})")
        
        # HOME PAGE: Listen for page navigation
        if self.current_page == 'home':
            if self.matches_any(text_lower, 'fun'):
                logger.info("🎉 Navigating to Fun page")
                self.send_page_command('fun')
                return True
            if self.matches_any(text_lower, 'spotify'):
                logger.info("📱 Navigating to Spotify page")
                self.send_page_command('spotify')
                return True
            logger.debug("❌ No match on home page. Say 'Fun' or 'Spotify' to navigate.")

        # FUN PAGE: Listen for navigation only
        elif self.current_page == 'fun':
            if self.matches_any(text_lower, 'home'):
                logger.info("🏠 Navigating to home page")
                self.send_page_command('home')
                return True
            if self.matches_any(text_lower, 'spotify'):
                logger.info("🎵 Navigating to Spotify page")
                self.send_page_command('spotify')
                return True
            logger.debug("❌ No match on Fun page. Say 'Home' or 'Spotify'.")

        # SPOTIFY PAGE: Listen for playback controls and navigation
        elif self.current_page == 'spotify':
            # Check for playback commands FIRST (higher priority)
            for action, keywords in COMMANDS.items():
                if action in ['play', 'pause', 'next', 'previous']:
                    # Check if any keyword matches in the text (case insensitive, substring match)
                    for keyword in keywords:
                        if keyword in text_lower:
                            logger.info(f"🎵 Executing Spotify command: {action} (matched: '{keyword}' in '{text}')")
                            self.send_spotify_command(action)
                            return True

            if self.matches_any(text_lower, 'fun'):
                logger.info("🎉 Navigating to Fun page")
                self.send_page_command('fun')
                return True
            if self.matches_any(text_lower, 'home'):
                logger.info("🏠 Navigating to home page")
                self.send_page_command('home')
                return True

            logger.info(f"❌ No match on Spotify page for: '{text}'")
        
        return False
    
    def listen_continuously(self):
        """Main listening loop - continuous command recognition using Vosk"""
        logger.info("🎤 Voice assistant started (100% OFFLINE - Vosk)")
        logger.info("🔒 Your voice never leaves this device!")
        logger.info("📋 Home page: Say 'Fun' or 'Spotify' to navigate")
        logger.info("📋 Fun page: Say 'Home' or 'Spotify'")
        logger.info("📋 Spotify page: Say 'Home', 'Fun', 'Play', 'Pause', 'Next', 'Previous'")
        
        while True:
            try:
                # Periodically refresh voice_enabled flag from settings
                now = time.time()
                if now - self._last_settings_check > 5:
                    self.sync_page_from_display()
                    self._last_settings_check = now

                if not self.voice_enabled:
                    if self.stream is not None:
                        logger.info("🔇 Voice input disabled - closing microphone stream")
                        try:
                            self.stream.stop_stream()
                            self.stream.close()
                        except Exception:
                            pass
                        self.stream = None
                    time.sleep(0.5)
                    continue

                # Ensure microphone stream is open when enabled
                if self.stream is None and self.audio is not None:
                    logger.info("🎤 Voice enabled - opening microphone stream")
                    self.stream = self.audio.open(
                        format=pyaudio.paInt16,
                        channels=1,
                        rate=SAMPLE_RATE,
                        input=True,
                        frames_per_buffer=CHUNK_SIZE
                    )

                # Read audio data from stream
                data = self.stream.read(CHUNK_SIZE, exception_on_overflow=False)
                
                # Process with Vosk
                if self.recognizer.AcceptWaveform(data):
                    result = json.loads(self.recognizer.Result())
                    text = result.get('text', '').strip()
                    
                    if text:
                        self.process_command(text)
                else:
                    # Partial result - can be used for faster response
                    partial = json.loads(self.recognizer.PartialResult())
                    partial_text = partial.get('partial', '').strip()
                    # Could process partial results for faster response if needed
                    
            except Exception as e:
                logger.error(f"Error in listening loop: {e}")
                time.sleep(1)
    
    def cleanup(self):
        """Clean up resources"""
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
        if self.audio:
            self.audio.terminate()

def main():
    """Main entry point"""
    logger.info("=" * 60)
    logger.info("Smart Mirror Voice Recognition Service")
    logger.info("Using Vosk for 100% offline speech recognition")
    logger.info("=" * 60)
    
    service = VoiceRecognitionService()
    
    if not service.model:
        logger.error("Failed to initialize Vosk model. Exiting.")
        return
    
    try:
        service.listen_continuously()
    except KeyboardInterrupt:
        logger.info("\n👋 Voice recognition service stopped")
        service.cleanup()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        service.cleanup()

if __name__ == "__main__":
    main()
