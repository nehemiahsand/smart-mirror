# Mosquitto for Nexus

The final Compose configuration uses authenticated, CA-verified MQTT TLS on **8883**. There is no plaintext listener or insecure TLS fallback.

Read [Nexus deployment](../docs/NEXUS_DEPLOYMENT.md) before changing a running broker. Existing clients must migrate before closing 1883; use an explicit temporary local dual-listener configuration only during that migration.

Run `scripts/provision-mqtt.py --backend-user YOUR_BACKEND_USERNAME` on the deployment host, adding reserved IPs or tailnet DNS names used by clients. It creates ignored certificates, per-device credentials, and topic ACLs. Preserve the CA and never commit or print credentials. The broker key must be readable by UID/GID 1883 with mode 0640. The CA private key is never mounted.

The backend uses `MQTT_USERNAME` and `MQTT_PASSWORD` from `backend/.env`, `mqtts://mosquitto:8883`, and the public CA. Compose generates its hashed password file in tmpfs. `clients.local` adds separate accounts for the console, smart clock, Pi, Mac, and ThinkPad; agent ACLs isolate each device's command/telemetry topics.

- Console: `smartmirror/esp32/<deviceId>/event` and `/status`.
- Clock: `smartmirror/esp32/smart-clock/{status,state,event,response,command}`.
- Computer agents: `smartmirror/devices/<deviceId>/{status,telemetry,response,command}`.

Passwords remain required in addition to TLS. Backend and ESP clients retain certificate/hostname validation. Use the ignored clock secret template only after checking the separate clock firmware's current configuration names. The installed clock still requires a future physical-access provisioning flash.
