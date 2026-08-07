# Week 1 · Day 6 — LAB DAY: Trace a Request End-to-End

`Day 6 of 7` · [← Day 5](05-day-5-network-devices-types-tools.md) · [Week overview](00-week-overview.md) · [Vocab practice](08-vocab-practice.md) · [Next: Day 7 →](07-day-7-review-and-quiz.md)

---

**Goal:** tie together everything from Days 1-5 by following real network traffic through the smart mirror. No new videos today — this is hands-on.

**What you will practice:** IP + port + protocol, client vs server, web server, ports mapping (Docker), WebSocket vs HTTP, and MQTT/IoT.

> Difficulty note: Labs A-C are read-only and safe. Lab D uses MQTT credentials (still safe). Anything marked ADVANCED is optional.

---

## The mental model

Here is the journey of a request when you open the mirror admin page on your phone, and when you press a button on the ESP32:

```
YOUR PHONE (client, on the LAN)
     |  http request to  <pi-ip>:80
     v
DOCKER on the Pi  ---- maps outside port 80  --->  inside port 3001
     |
     v
BACKEND container (web server: Express + WebSocket)
     |  ws:// live updates
     v
DISPLAY container (mirror UI, port 3000)

ESP32 (IoT device)
     |  MQTT publish on port 1883  (button press / temperature)
     v
MOSQUITTO broker  ---->  BACKEND (subscribes to the topics)
```

Keep this picture next to you while you do the labs.

---

## Lab A — Confirm the "doors" (ports) from the config

Open `docker-compose.yml` and confirm these three published ports:

- `"1883:1883"` — MQTT broker (`mosquitto`)
- `"80:3001"` — backend (outside 80 → inside 3001)
- `"3000:3000"` — display

Then, on the Pi, confirm the containers are running and mapped:

```bash
docker compose ps
```

You should see the same port numbers in the output. **You just matched configuration to reality** — a core troubleshooting skill.

---

## Lab B — Be the client hitting the web server

From your **laptop**, make requests to the Pi's web server (replace `<pi-ip>`):

```bash
curl http://<pi-ip>/api/health
```

Break down what just happened, out loud:

- `http` → the **protocol** (Day 1)
- `<pi-ip>` → the **IP address**, finding the device (Day 2)
- no port typed → defaults to **80**, the HTTP door (Day 1)
- Docker forwards **80 → 3001** (today's model)
- the **backend web server** answers (Day 3)
- you (`curl`) are the **client** (Day 3)

Now try one that fails, to reinforce ports:

```bash
curl http://<pi-ip>:1883/api/health
```

It fails/hangs (Ctrl+C to stop): 1883 is the **MQTT** door, not a web door. Right IP, wrong port/protocol.

---

## Lab C — Watch the live WebSocket connection count

The mirror's display keeps a live **WebSocket** connection to the backend (that is how the screen updates instantly without refreshing). The health endpoint reports how many are connected:

```bash
curl http://<pi-ip>/api/health
```

Look for a field like `wsConnections`. Now, if you can, open the display in a browser (`http://<pi-ip>:3000`) or make sure the mirror is on, and run the health check again. **Did the count change?** More open display clients = more WebSocket connections. You are observing the difference between:

- **HTTP** — ask once, get one answer, done (like `curl /api/health`).
- **WebSocket** — a connection stays open for continuous two-way updates (the live mirror).

This HTTP-vs-persistent-connection distinction is exactly the kind of thing the exam expects you to reason about.

---

## Lab D — Sniff the IoT device (MQTT)

This shows the ESP32 (IoT) talking to the broker in real time. You need the MQTT username/password (from `backend/.env`, the `MQTT_USERNAME` / `MQTT_PASSWORD` values).

If `mosquitto_sub` is not installed on the Pi, install the client tools first:

```bash
sudo apt-get install -y mosquitto-clients
```

Then subscribe to **all** ESP32 topics and watch (replace credentials):

```bash
mosquitto_sub -h localhost -p 1883 -u <MQTT_USERNAME> -P <MQTT_PASSWORD> -t 'smartmirror/esp32/#' -v
```

- `-h localhost -p 1883` → the broker's IP and **port** (Day 1/2)
- `-u ... -P ...` → **authentication** (Day 3; remember `allow_anonymous false`)
- `-t 'smartmirror/esp32/#'` → subscribe to every ESP32 topic (`#` = wildcard)
- `-v` → verbose (show the topic with each message)

Now **press buttons on the ESP32** and watch messages appear. You are literally watching an **IoT device** publish over **MQTT (1883/TCP)** to a **broker**, which the **backend** also subscribes to. Press `Ctrl + C` to stop.

**Prove the auth matters:** try again with a wrong password. The connection is refused. That is `allow_anonymous false` doing its job (a security control you can now demonstrate).

---

## Lab E (ADVANCED / OPTIONAL) — Trace names and gateways

On the Pi:

```bash
ip route            # find 'default via <gateway>' = your router
ping -c 4 8.8.8.8   # can the Pi reach the internet by IP? (WAN)
```

If `ping 8.8.8.8` works but websites do not load, that points to a **DNS** problem (you can reach IPs but not resolve names) — a classic Week 4 troubleshooting scenario, previewed here.

---

## Wrap-up: write it in your own words

In a notebook (or a scratch file), write 3-4 sentences describing the full path of a button press from the ESP32 to the mirror screen, using these words correctly: **IP address, port, protocol, MQTT, broker, backend, web server, WebSocket.** If you can write that clearly, you have absorbed Week 1's core.

---

## Done?

Check off Day 6 in [../02-progress-tracker.md](../02-progress-tracker.md).

**Next → [Day 7: Review + Quiz](07-day-7-review-and-quiz.md)**
