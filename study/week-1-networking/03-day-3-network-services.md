# Week 1 · Day 3 — Network Services

`Day 3 of 7` · [← Day 2](02-day-2-ip-addressing.md) · [Week overview](00-week-overview.md) · [Vocab practice](08-vocab-practice.md) · [Next: Day 4 →](04-day-4-wireless-dns-dhcp-vpn.md)

---

**Exam objective:** 2.3 — Explain common network services and their purposes (DNS, DHCP, file/print/mail servers, web servers, authentication, proxy, load balancer, IoT, embedded, legacy systems, etc.).
**Messer video:** 2.3 **"Network Services" (17:03)**.

---

> ### Capture list (while you watch)
> Don't take full notes — your lesson files and Messer's Course Notes PDF already have those. Instead, jot **3-5 quick lines** as you watch, then bring them to the lesson/quiz:
> 1. Anything that **confused** you (to re-explain).
> 2. Anything **surprising** or important not already in this file.
> 3. Anything Messer says is **"on the exam"** or commonly missed.

## 1. Watch (~20 min)

- Watch **Network Services**. It is a longer one — that is fine, it is a survey of many service types. Do not memorize every one; focus on DNS, DHCP, web server, mail server, proxy, and IoT.

---

## 2. Read + Vocab (~20 min)

A **network service** is a program running somewhere that provides a useful function to other devices. You have already met a few by name; today we organize them.

### The services you must know

| Service | What it does | Everyday example |
|---------|--------------|------------------|
| **DNS** | Translates names → IP addresses | You type `google.com`, DNS returns its IP |
| **DHCP** | Automatically assigns IP addresses | Your phone gets an IP when it joins Wi-Fi |
| **Web server** | Answers HTTP/HTTPS requests, serves pages | The smart-mirror backend |
| **File server** | Stores/shares files over the network | A shared drive at work |
| **Print server** | Manages shared printers | Office printer everyone uses |
| **Mail server** | Sends/receives email (SMTP/IMAP/POP3) | Gmail's servers |
| **Authentication server (AAA)** | Verifies who a user is (Authentication, Authorization, Accounting) | Logging into a company account |
| **Database server** | Stores/retrieves structured data using SQL | Microsoft SQL Server, MySQL |
| **Syslog server (SIEM)** | Collects/consolidates log messages from many devices | Central logging & correlation |
| **NTP server** | Keeps clocks accurate (Network Time Protocol) | Why your device time is always right |
| **Proxy server** | Sits between you and the internet, forwarding/filtering requests | Company web filter |
| **Load balancer** | Spreads traffic across multiple servers | Big websites handling millions of users |
| **Spam gateway** | Filters junk email | Email security appliance |
| **UTM / all-in-one appliance** | Combines firewall, IPS, URL filter, spam filter, VPN | "Next-generation firewall" at the network edge |

### The special exam terms in this objective

- **IoT (Internet of Things)** — everyday physical devices that have a small computer and network connection: smart bulbs, thermostats, cameras... **and the ESP32 console in this repo.** It reports button presses and temperature over the network.
- **Embedded system** — a computer built into a larger device to do one dedicated job (the firmware running on the ESP32 is embedded software).
- **Legacy system** — old hardware/software still in use because replacing it is hard or costly. The exam wants you to know these exist and often need special handling/security.
- **SCADA / ICS** — industrial control systems (factories, utilities). Just recognize the term.

> **Quick check:** Which service makes sure log timestamps across many devices line up, and why does that matter for security? (Answer: **NTP** — accurate, matching time lets you correlate logs and is required by many encryption systems.)

### How this maps to the smart mirror

This one project contains several "network services" working together:

- **Web server** → the backend (`backend/src/`) answers requests like `/api/health` over HTTP. It is literally a web server.
- **Message broker (MQTT)** → `mosquitto` receives messages from the ESP32 and passes them to the backend. (A broker is a specialized service; MQTT is the IoT messaging protocol.)
- **IoT device** → the **ESP32 console**: five buttons, an OLED screen, and a temperature sensor, all talking over the network.
- **DNS/DHCP consumers** → when the Pi boots and joins Wi-Fi, it uses **DHCP** to get its IP and **DNS** to look up the weather/Spotify/calendar services it calls.

So the mirror is simultaneously a **client** (it calls out to weather APIs) and a **server** (it answers your phone and the ESP32).

### Vocab to write down

`network service`, `DNS server`, `DHCP server`, `web server`, `file server`, `print server`, `mail server`, `authentication server / AAA`, `database server / SQL`, `syslog / SIEM`, `NTP`, `proxy server`, `load balancer`, `spam gateway`, `UTM`, `IoT`, `embedded system`, `legacy system`, `SCADA / ICS`, `message broker`, `client vs server`.

---

## 3. Lab + Self-check (~20 min)

### Lab 3A — Identify the "broker" service and its security setting

Open `mosquitto/mosquitto.conf`. It is short:

```
listener 1883 0.0.0.0
allow_anonymous false
password_file /mosquitto/data/mosquitto.passwd
persistence false
```

Read it line by line:

- `listener 1883 0.0.0.0` → listen on port **1883**, on **all** network interfaces (`0.0.0.0` means "any address this machine has").
- `allow_anonymous false` → you may **not** connect without a username/password. This is a security control — no random device can join.
- `password_file ...` → where the valid credentials live.

**Takeaway:** this is a real network service that requires **authentication** — connecting the "authentication" idea from today's lesson to a concrete config you can see.

### Lab 3B — See the mirror acting as a web server

Ask a few of the backend's read-only endpoints (run on the Pi, or replace `localhost` with `<pi-ip>` from your laptop):

```bash
curl http://localhost/api/health
```
```bash
curl http://localhost/api/system/info
```
```bash
curl 'http://localhost/api/console/state?device=esp32'
```

Each response is the **web server** answering a **client** (you, via `curl`). The last one returns the state that the **IoT** ESP32 device polls to update its OLED screen — you are watching an IoT device's data flow.

### Lab 3C — Spot the IoT device in the docs

Open `esp32-console/README.md`. Skim the top section. Notice it describes buttons, an OLED, a temperature sensor (DHT22), and MQTT topics. This is your textbook definition of an **IoT / embedded** device: dedicated hardware, small firmware, network-connected.

### Mini self-check

1. What does a DNS server do? What does a DHCP server do? (One sentence each.)
2. In this repo, name one thing acting as a **web server** and one thing acting as an **IoT device**.
3. What does `allow_anonymous false` in `mosquitto.conf` enforce, and which network-service concept does that match?
4. What is a **proxy server** in one sentence?
5. What is a **legacy system**, and why does the exam care about them?

*(Answers in [11-quiz-answer-key.md](11-quiz-answer-key.md) under "Day 3 self-check.")*

---

## Done?

1. Write today's terms in [08-vocab-practice.md](08-vocab-practice.md)
2. Check off Day 3 in [../02-progress-tracker.md](../02-progress-tracker.md)

**Next → [Day 4: Wireless, DNS, DHCP, VPN](04-day-4-wireless-dns-dhcp-vpn.md)**
