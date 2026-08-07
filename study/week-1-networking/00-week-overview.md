# Week 1 — Networking (Exam Domain 2.0, 23%)

This is the biggest single-domain focus of the whole month, and for good reason: networking underpins everything else, and it is 23% of the exam. It is also the domain most visible in the smart-mirror project.

By the end of the week you will be able to explain how a device gets an address, how services are reached by port, and how the mirror's pieces talk to each other over the network.

---

## This week's checklist

- [x] **Day 1** — [Ports and Protocols](01-day-1-ports-and-protocols.md) (Messer 2.1)
- [ ] **Day 2** — [IP Addressing](02-day-2-ip-addressing.md) (Messer 2.6)
- [ ] **Day 3** — [Network Services](03-day-3-network-services.md) (Messer 2.3)
- [ ] **Day 4** — [Wireless, DNS, DHCP, VPN](04-day-4-wireless-dns-dhcp-vpn.md) (Messer 2.2, 2.4)
- [ ] **Day 5** — [Network Devices, Types & Tools](05-day-5-network-devices-types-tools.md) (Messer 2.5, 2.7, 2.8)
- [ ] **Day 6** — [LAB: Trace a request end-to-end + MQTT](06-day-6-lab-trace-a-request.md)
- [ ] **Day 7** — [Review + Quiz](07-day-7-review-and-quiz.md)

**Files in this folder, in the order you use them:**

| File | What it is |
| ---- | ---------- |
| `01`-`07` day files | The lessons. Just go in order. |
| [08-vocab-practice.md](08-vocab-practice.md) | **You write in this one.** Then say "check my vocab". |
| [09-vocab-answer-key.md](09-vocab-answer-key.md) | Vocab answers (for grading) |
| [10-quiz.md](10-quiz.md) | Week quiz — Day 7 only |
| [11-quiz-answer-key.md](11-quiz-answer-key.md) | Quiz answers — open after the quiz |

---

## Learning goals (what "done" looks like)

You can:

- Explain the difference between an **IP address** and a **port**, and give the protocol for common ports (80, 443, 22, 53, 67/68, etc.).
- Compare **TCP vs UDP** and say when each is used.
- Identify **public vs private** IPs and the three private ranges.
- Explain **static vs dynamic (DHCP)** addressing and what **APIPA (169.254.x.x)** signals.
- Describe common **network services** (DNS, DHCP, web server, IoT) and **devices** (router, switch, AP, firewall).
- Classify **network types** (PAN/LAN/WLAN/WAN).
- Point to where each concept lives in the smart-mirror repo.

---

## Repo anchors used this week


| Concept            | File / command                                              |
| ------------------ | ----------------------------------------------------------- |
| Published ports    | `docker-compose.yml`                                        |
| MQTT broker + auth | `mosquitto/mosquitto.conf`                                  |
| Wi-Fi / IP tooling | `backend/src/services/wifi.js`, `/api/wifi/current`         |
| Web server health  | `/api/health`, `/api/system/info`                           |
| IoT device         | `esp32-console/README.md`, MQTT topics                      |
| VPN / DNS scripts  | `scripts/start-mirror.sh`, `scripts/setup-encrypted-dns.sh` |


---

## Tips for the week

- Do the labs even if they feel optional — running the real commands is what makes the terms stick.
- Keep a running vocab list by hand; writing beats re-reading.
- If a day runs long, it is fine to split it. Consistency beats cramming.

**Start here → [Day 1: Ports and Protocols](01-day-1-ports-and-protocols.md)**