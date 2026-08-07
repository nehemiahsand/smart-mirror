# Week 1 · Day 1 — Ports and Protocols

`Day 1 of 7` · [Week overview](00-week-overview.md) · [Vocab practice](08-vocab-practice.md) · [Next: Day 2 →](02-day-2-ip-addressing.md)

---

**Exam objective:** 2.1 — Compare and contrast Transmission Control Protocol (TCP) and User Datagram Protocol (UDP) ports, protocols, and their purposes.
**Messer video:** 2.1 "Introduction to IP" (19:04) — you already watched this. Rewatch the first ~8 minutes if it feels fuzzy. Also watch **"Common Ports" (12:52)**.

---

> ### Capture list (while you watch)
>
> - use cases for UDP and TCP
> - if something is a "protocol", what does that mean? what is a protocol?
> - what is netBIOS/SMB?

## 1. Watch (~20 min)

- Rewatch/skim: **Introduction to IP** (focus on: what IP does, what a port is, TCP vs UDP).
- Watch: **Common Ports**.

As you watch, just try to absorb the *idea*. We drill the actual port numbers below and again on the review day.

---

## 2. Read + Vocab (~20 min)

### The big picture: how two devices talk

Imagine sending a letter:

1. You need the **address** of the building → this is the **IP address** (which *device*).
2. You need the **apartment/office number** inside the building → this is the **port** (which *service/program* on that device).
3. You need a shared **language and rules** so the letter makes sense → this is the **protocol**.

So a full conversation is: **IP address + port + protocol.**

Example, all on one device (your smart-mirror Raspberry Pi):

- `http://192.168.1.50:3000` → device `192.168.1.50`, door `3000`, language `http` → the mirror **display**.
- `http://192.168.1.50/` → same device, door `80` (the default HTTP door), language `http` → the **admin PWA / API**.
- `192.168.1.50:1883` → same device, door `1883`, protocol `MQTT` → the **message broker** the ESP32 talks to.

**Same device (same IP), different doors (ports), different services.** That is the single most important idea today.

### What exactly is a port?

A port is just a **number** (0-65535) that a program "listens" on so incoming traffic knows which program to reach. Think of the IP as the street address and the port as the specific door. Messer uses a moving analogy: **IP is the truck** that drives to an address, the **boxes inside are TCP/UDP data**, and the **port number written on each box** tells the operating system which "room" (service) to deliver it to.

Ports come in two groups (Messer stresses this):

- **Non-ephemeral ports (0-1023)** — "permanent" / well-known port numbers. These sit on the **server/service** side (HTTP is 80, HTTPS is 443, etc.). **These are the ones CompTIA makes you memorize.**
- **Ephemeral ports (1024-65535)** — "temporary" port numbers the **client** picks at random for one conversation, then throws away. The mirror display's `3000` and MQTT's `1883` are just higher-numbered ports the apps chose — not on the memorize list.

Two exam-flagged facts from the video:

- **Port numbers are for communication, not security.** They are just reference numbers; changing a service's port does not "hide" it.
- **TCP port 80 is not the same as UDP port 80.** TCP and UDP each have their own separate set of ports 0-65535.

> **Quick check:** When you browse to the mirror, your laptop uses a *random high* port as its source and connects to the server's *well-known* port 80. Which of those two is the ephemeral port? (Answer: your laptop's random high one.)

**Go deeper (optional)** — sockets, multiplexing, encapsulation

- A **socket** is the full combination of **IP address + protocol (TCP/UDP) + port number**. Server socket + client socket together define one conversation.
- **Multiplexing** is how one device holds many conversations at once (web, email, voice) by using different ports.
- **Encapsulation** is the "boxes inside boxes" idea: an Ethernet frame holds an IP packet, which holds a TCP/UDP segment, which holds the application data (e.g., HTTP). You do not need the OSI model for A+, but you may hear TCP/UDP called "Layer 4."



### TCP vs UDP (this is on the exam a lot)

Both TCP and UDP are ways to actually move the data, but they behave differently:


|             | **TCP** (Transmission Control Protocol)                 | **UDP** (User Datagram Protocol)                  |
| ----------- | ------------------------------------------------------- | ------------------------------------------------- |
| Connection  | Sets up a connection first ("handshake")                | No connection — just fires data off               |
| Reliability | Guaranteed delivery + correct order; re-sends lost data | No guarantee; lost data stays lost                |
| Speed       | Slightly slower (all that checking)                     | Faster (no overhead)                              |
| Analogy     | A phone call (you confirm the other person hears you)   | Shouting across a room (fast, but maybe unheard)  |
| Used by     | Web (HTTP/HTTPS), email, file transfer, SSH             | Streaming video, voice (VoIP), DNS lookups, games |


Memory hook: **TCP = "Telephone Call Protocol"** (reliable, connected). **UDP = "Unreliable Datagram Protocol"** (fast, fire-and-forget).

The smart mirror uses **TCP** for its web traffic (ports 80, 3000) and for MQTT (1883) — because those need reliable delivery.

### The must-memorize ports (start today, drill all week)


| Port      | Protocol      | TCP/UDP       | What it does                     |
| --------- | ------------- | ------------- | -------------------------------- |
| 20 / 21   | FTP           | TCP           | Transfer files                   |
| 22        | SSH           | TCP           | Secure remote command line       |
| 23        | Telnet        | TCP           | Old, insecure remote access      |
| 25        | SMTP          | TCP           | Send email                       |
| 53        | DNS           | UDP (and TCP) | Name → IP lookup                 |
| 67 / 68   | DHCP          | UDP           | Auto-assign IP addresses         |
| 80        | HTTP          | TCP           | Web (unencrypted)                |
| 110       | POP3          | TCP           | Receive email                    |
| 143       | IMAP          | TCP           | Receive email (keeps on server)  |
| 137-139   | NetBIOS/NetBT | TCP/UDP       | Old Windows name/session service |
| 389 / 636 | LDAP / LDAPS  | TCP           | Directory lookups (plain/secure) |
| 443       | HTTPS         | TCP           | Web (encrypted)                  |
| 445       | SMB / CIFS    | TCP           | Windows file/print sharing       |
| 3389      | RDP           | TCP           | Remote Desktop (graphical)       |


Two details Messer calls out: FTP uses **20** for the actual data transfer and **21** for control/commands; and **445 (SMB)** is the modern "direct" Windows sharing that replaced the older **137-139 NetBIOS** ports.

Do not panic — you are not memorizing these in one sitting. Today, just get familiar. The Day 7 review has a drill, and the quiz will test the most common ones.

### Vocab to write down

`protocol`, `port`, `TCP`, `UDP`, `HTTP (80)`, `HTTPS (443)`, `SSH (22)`, `DNS (53)`, `DHCP (67/68)`, `well-known ports`, `non-ephemeral vs ephemeral ports`, `socket`, `multiplexing`, `encapsulation`, `NetBIOS (137-139)`, `SMB/CIFS (445)`, `client`, `server`.

(Full definitions are in `../vocab/master-glossary.md`.)

---

## 3. Lab + Self-check (~20 min)

### Lab 1A — See the ports the smart mirror actually uses

Open the file `docker-compose.yml` in the project root. Find the `ports:` lines. You will see entries like:

```yaml
ports:
  - "1883:1883"   # mosquitto (MQTT broker)
```

```yaml
ports:
  - "80:3001"     # backend (API + PWA)
```

```yaml
ports:
  - "3000:3000"   # display (mirror UI)
```

Read `"80:3001"` as **"outside port 80 → inside port 3001."** Docker is acting like a receptionist: visitors knock on the building's door **80**, and Docker walks them to office **3001** inside where the backend actually lives. (We go deeper on this in Day 6.)

**Question to answer in your head:** which of these three published ports is a *standard* well-known port, and which two are not? (Answer: 80 is standard HTTP; 3000 and 1883 are not "memorize-list" ports.)

### Lab 1B — Prove services are listening (run ON THE PI)

If the mirror stack is running, this shows the containers and their port mappings:

```bash
docker compose ps
```

Now ask the backend "are you alive?" using its HTTP port:

```bash
curl http://localhost/api/health
```

`curl` is a command-line tool that makes a web request — exactly like a browser, but text-only. `localhost` means "this same machine." Because you did not type a port, it defaulted to **80** — the HTTP door. You should get back a small chunk of JSON with a status.

**Try it wrong on purpose** (to feel what a port does):

```bash
curl http://localhost:1883/api/health
```

This will fail or hang, because port **1883** is the MQTT broker, not a web server. Right building, wrong door. Press `Ctrl + C` to stop it.

### Mini self-check

1. In `http://192.168.1.50:3000`, what is the IP, what is the port, and what is the protocol?
2. You browse to `http://192.168.1.50/` with no port typed. Which port are you actually using, and why?
3. Would a live video stream more likely use TCP or UDP? Why?
4. Match: HTTP → __, HTTPS → __, SSH → __, DNS → __.
5. In `"80:3001"` from `docker-compose.yml`, which number is the "outside" port people connect to?

*(Answers are in [11-quiz-answer-key.md](11-quiz-answer-key.md) under "Day 1 self-check.")*

---

## Done? Finish these three things

1. Write today's terms in [08-vocab-practice.md](08-vocab-practice.md)
2. Check off Day 1 in [../02-progress-tracker.md](../02-progress-tracker.md)
3. Move on when ready

**Next → [Day 2: IP Addressing](02-day-2-ip-addressing.md)**