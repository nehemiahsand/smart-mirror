#!/usr/bin/env python3
"""
DHT22 HTTP Server for Raspberry Pi 5
Keeps GPIO initialized and serves readings via HTTP
"""
import board
import adafruit_dht
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
import time

# Initialize DHT22 once
dht_device = adafruit_dht.DHT22(board.D4, use_pulseio=False)
last_reading = {"temperature": None, "humidity": None, "timestamp": 0}

class SensorHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global last_reading
        
        try:
            # Rate limit: return cached if less than 30 seconds old
            now = time.time()
            if now - last_reading["timestamp"] < 30:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "temperature": last_reading["temperature"],
                    "humidity": last_reading["humidity"],
                    "error": None,
                    "cached": True
                }).encode())
                return
            
            # Read sensor
            temperature = dht_device.temperature
            humidity = dht_device.humidity
            
            if temperature is not None and humidity is not None:
                last_reading = {
                    "temperature": round(temperature, 1),
                    "humidity": round(humidity, 1),
                    "timestamp": now
                }
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "temperature": last_reading["temperature"],
                    "humidity": last_reading["humidity"],
                    "error": None,
                    "cached": False
                }).encode())
            else:
                raise RuntimeError("No data from sensor")
                
        except RuntimeError as e:
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e), "temperature": None, "humidity": None}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e), "temperature": None, "humidity": None}).encode())
    
    def log_message(self, format, *args):
        pass  # Suppress HTTP logs

if __name__ == "__main__":
    server = HTTPServer(('127.0.0.1', 5555), SensorHandler)
    print("DHT22 sensor server running on http://127.0.0.1:5555")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        dht_device.exit()
        print("Sensor server stopped")
