#!/usr/bin/env python3
"""
DHT22 HTTP sidecar for Raspberry Pi 5.

The sensor itself should be read on a fixed cadence, not per request. This keeps
HTTP responses fast, avoids concurrent GPIO access, and keeps one last known
reading available through transient checksum failures.
"""

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import adafruit_dht
import board

READ_INTERVAL_SECONDS = 30

dht_device = adafruit_dht.DHT22(board.D4, use_pulseio=False)
state_lock = threading.Lock()
read_lock = threading.Lock()
last_reading = {"temperature": None, "humidity": None, "timestamp": 0}
last_error = None


def read_sensor_once():
    global last_reading, last_error

    with read_lock:
        try:
            temperature = dht_device.temperature
            humidity = dht_device.humidity

            if temperature is None or humidity is None:
                raise RuntimeError("No data from sensor")

            reading = {
                "temperature": round(temperature, 1),
                "humidity": round(humidity, 1),
                "timestamp": time.time(),
            }

            with state_lock:
                last_reading = reading
                last_error = None
        except RuntimeError as error:
            with state_lock:
                last_error = str(error)
        except Exception as error:
            with state_lock:
                last_error = str(error)


def sensor_loop():
    while True:
        read_sensor_once()
        time.sleep(READ_INTERVAL_SECONDS)


class SensorHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        with state_lock:
            reading = dict(last_reading)
            error = last_error

        # Prime the cache on the first request instead of returning an empty payload.
        if reading["timestamp"] == 0:
            read_sensor_once()
            with state_lock:
                reading = dict(last_reading)
                error = last_error

        age_seconds = time.time() - reading["timestamp"] if reading["timestamp"] else None
        response = {
            "temperature": reading["temperature"],
            "humidity": reading["humidity"],
            "error": error,
            "cached": True,
            "age_seconds": round(age_seconds, 1) if age_seconds is not None else None,
        }

        if reading["timestamp"]:
            response["timestamp"] = reading["timestamp"]

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    threading.Thread(target=sensor_loop, daemon=True).start()
    server = ThreadingHTTPServer(("0.0.0.0", 5555), SensorHandler)
    print("DHT22 sensor server running on http://0.0.0.0:5555")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        dht_device.exit()
        print("Sensor server stopped")
