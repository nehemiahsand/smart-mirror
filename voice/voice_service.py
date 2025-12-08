#!/usr/bin/env python3
"""
Voice Recognition Service for Smart Mirror
Continuous voice command listener (no wake word)
"""

import speech_recognition as sr
import requests
import time
import logging
import json
from threading import Thread
import websocket

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
BACKEND_URL = "http://localhost:3001"
WEBSOCKET_URL = "ws://localhost:3001"
WEBSOCKET_BROADCAST_URL = f"{BACKEND_URL}/api/broadcast"

# Voice commands mapping
COMMANDS = {
    # Navigation
    'spotify': ['spotify', 'music', 'music player', 'player', 'open spotify', 'go to spotify', 'show spotify', 'show music'],
    'home': ['home', 'main page', 'go home', 'main', 'homepage', 'back home', 'return home', 'go back home', 'exit', 'close', 'back', 'go back'],
    
    # Playback controls
    'play': ['play', 'resume', 'start', 'unpause', 'play music', 'start playing', 'continue', 'play song'],
    'pause': ['pause', 'stop', 'stop music', 'pause music', 'halt', 'freeze'],
    'next': ['next', 'skip', 'next song', 'skip song', 'skip track', 'next track', 'forward', 'skip this'],
    'previous': ['previous', 'last song', 'go back', 'back', 'previous song', 'previous track', 'last track', 'rewind', 'go back'],
    'volume_up': ['volume up', 'louder', 'turn it up', 'increase volume', 'raise volume', 'up'],
    'volume_down': ['volume down', 'quieter', 'turn it down', 'lower volume', 'decrease volume', 'down'],
    
    # Spotify specific
    'play_liked': ['play my liked songs', 'play liked songs', 'play favorites', 'play my favorites'],
}

class VoiceRecognitionService:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.microphone = None
        self.current_page = 'home'
        self.is_listening = False
        self.wake_word_active = False
        self.ws = None
        
        # Adjust for ambient noise on startup
        logger.info("Initializing voice recognition...")
        self.setup_microphone()
        
        # Sync current page from display on startup
        self.sync_page_from_display()
        
        # Start WebSocket listener in background thread
        self.start_websocket_listener()
        
    def setup_microphone(self):
        """Initialize and configure microphone"""
        try:
            # List available microphones
            mic_list = sr.Microphone.list_microphone_names()
            logger.info(f"Available microphones: {mic_list}")
            
            # Use default microphone
            self.microphone = sr.Microphone()
            
            # Calibrate for ambient noise
            logger.info("Calibrating for ambient noise (5 seconds)...")
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=5)
            
            logger.info(f"Microphone initialized: {mic_list[0] if mic_list else 'Default'}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize microphone: {e}")
            return False
    
    def sync_page_from_display(self):
        """Sync current page state from display via WebSocket subscription"""
        try:
            # Try to get stored page from localStorage via API
            response = requests.get(f"{BACKEND_URL}/api/settings", timeout=2)
            if response.status_code == 200:
                data = response.json()
                # Check if there's a current_page stored
                stored_page = data.get('current_page', 'home')
                self.current_page = stored_page
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
            response = requests.post(WEBSOCKET_BROADCAST_URL, json=payload, timeout=2)
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
                'play': {'method': 'POST', 'url': '/api/spotify/play'},
                'pause': {'method': 'POST', 'url': '/api/spotify/pause'},
                'next': {'method': 'POST', 'url': '/api/spotify/next'},
                'previous': {'method': 'POST', 'url': '/api/spotify/previous'},
                'volume_up': {'method': 'POST', 'url': '/api/spotify/volume', 'data': {'direction': 'up'}},
                'volume_down': {'method': 'POST', 'url': '/api/spotify/volume', 'data': {'direction': 'down'}},
            }
            
            if action not in endpoints:
                logger.error(f"Unknown Spotify action: {action}")
                return False
            
            endpoint = endpoints[action]
            url = f"{BACKEND_URL}{endpoint['url']}"
            data = endpoint.get('data', {})
            
            response = requests.post(url, json=data, timeout=2)
            if response.status_code == 200:
                logger.info(f"✅ Spotify command executed: {action}")
                return True
            else:
                logger.error(f"Failed to execute Spotify command {action}: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending Spotify command: {e}")
            return False
    
    def process_command(self, text):
        """Process voice command based on current page"""
        text_lower = text.lower().strip()
        logger.info(f"🔊 Heard: '{text}' (Page: {self.current_page})")
        
        # HOME PAGE: Only listen for "spotify" to navigate
        if self.current_page == 'home':
            if any(keyword in text_lower for keyword in COMMANDS['spotify']):
                logger.info("📱 Navigating to Spotify page")
                self.send_page_command('spotify')
                return True
            else:
                logger.debug(f"❌ No match on home page. Say 'Spotify' to navigate.")
        
        # SPOTIFY PAGE: Listen for playback controls and "home"
        elif self.current_page == 'spotify':
            # Check for home navigation first (highest priority)
            for keyword in COMMANDS['home']:
                if keyword in text_lower:
                    logger.info(f"🏠 Navigating to home page (matched: '{keyword}')")
                    self.send_page_command('home')
                    return True
            
            # Check for playback commands
            for action, keywords in COMMANDS.items():
                if action in ['play', 'pause', 'next', 'previous']:
                    if any(keyword in text_lower for keyword in keywords):
                        logger.info(f"🎵 Executing Spotify command: {action}")
                        self.send_spotify_command(action)
                        return True
            
            logger.debug(f"❌ No match on Spotify page. Available: Home, Play, Pause, Next, Previous")
        
        return False
    
    def listen_continuously(self):
        """Main listening loop - continuous command recognition"""
        logger.info("🎤 Voice assistant started")
        logger.info("📋 Home page: Say 'Spotify' to navigate")
        logger.info("📋 Spotify page: Say 'Home', 'Play', 'Pause', 'Next', 'Previous'")
        
        while True:
            try:
                with self.microphone as source:
                    audio = self.recognizer.listen(source, timeout=3, phrase_time_limit=2)
                    
                try:
                    text = self.recognizer.recognize_google(audio)
                    self.process_command(text)
                    
                except sr.UnknownValueError:
                    pass  # Ignore speech we can't understand
                except sr.RequestError as e:
                    logger.error(f"Speech recognition error: {e}")
                    time.sleep(1)
                    
            except sr.WaitTimeoutError:
                pass  # Normal timeout, keep listening
                
            except Exception as e:
                logger.error(f"Error in listening loop: {e}")
                time.sleep(1)

def main():
    """Main entry point"""
    logger.info("=" * 60)
    logger.info("Smart Mirror Voice Recognition Service")
    logger.info("=" * 60)
    
    service = VoiceRecognitionService()
    
    if not service.microphone:
        logger.error("Failed to initialize microphone. Exiting.")
        return
    
    try:
        service.listen_continuously()
    except KeyboardInterrupt:
        logger.info("\n👋 Voice recognition service stopped")
    except Exception as e:
        logger.error(f"Fatal error: {e}")

if __name__ == "__main__":
    main()
