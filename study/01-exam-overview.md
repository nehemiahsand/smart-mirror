# The CompTIA A+ Core 1 (220-1201) Exam — Overview

Read this once at the start. Come back to it whenever you want the "big picture."

---

## What is CompTIA A+?

CompTIA A+ is an entry-level IT certification. It proves you understand the fundamentals of computers, mobile devices, networking, and troubleshooting — the day-one skills of a help desk technician or IT support role.

Full A+ certification requires passing **two** exams:

- **Core 1 (220-1201)** — hardware, networking, mobile devices, virtualization/cloud, troubleshooting. **This is what we are studying.**
- **Core 2 (220-1202)** — operating systems, security, software, operational procedures. (A future study plan.)

Both were released March 25, 2025. You can take them in either order, but you must pass both for the certification.

---

## Core 1 exam facts


| Fact                | Detail                                                                                |
| ------------------- | ------------------------------------------------------------------------------------- |
| Number of questions | Up to **90**                                                                          |
| Time limit          | **90 minutes**                                                                        |
| Passing score       | **675** out of 900                                                                    |
| Question types      | Multiple-choice (single and multiple answer) + **performance-based questions (PBQs)** |
| Cost                | ~$253 USD (a voucher can lower this; Messer's study group posts discount codes)       |


### What is a performance-based question (PBQ)?

A PBQ is a hands-on simulation instead of a plain multiple-choice question. For example, you might be asked to match ports to protocols by dragging them, configure a simulated device, or identify a cable from a picture. They usually appear at the **start** of the exam. Tip: if a PBQ feels slow, **mark it and move on**, do the multiple-choice questions first, then come back. You do not want to burn 20 minutes on one PBQ.

---

## The five domains (and their weight)

The exam is divided into five domains. The percentage is roughly how much of the exam comes from that domain, so it tells you where to spend your study time.


| Domain | Name                               | Weight  | Plain-English meaning                                                 |
| ------ | ---------------------------------- | ------- | --------------------------------------------------------------------- |
| 1.0    | Mobile Devices                     | **13%** | Laptops, phones, tablets, batteries, Wi-Fi/Bluetooth, cameras         |
| 2.0    | Networking                         | **23%** | How devices talk: IP addresses, ports, Wi-Fi, routers, DNS, DHCP      |
| 3.0    | Hardware                           | **25%** | Cables, connectors, RAM, storage, motherboards, CPUs, power, printers |
| 4.0    | Virtualization & Cloud             | **11%** | Virtual machines, containers, cloud service models                    |
| 5.0    | Hardware & Network Troubleshooting | **28%** | "It's broken — find out why and fix it" (the biggest slice)           |


Notice that **Troubleshooting (28%) is the largest domain**, and it builds on everything else. That is why this program teaches the fundamentals first (networking, hardware) and finishes with troubleshooting — by then, you will actually understand what you are troubleshooting.

---

## The 6-step troubleshooting method

CompTIA loves this process. It is no longer a separately scored objective, but the exam still expects you to think this way, and it is genuinely how good technicians work. Memorize the order:

1. **Identify the problem** — gather info, ask the user, check what changed recently.
2. **Establish a theory** of probable cause (question the obvious first).
3. **Test the theory** to determine the cause. If it is wrong, form a new theory (or escalate).
4. **Establish a plan** of action to resolve the problem and implement it.
5. **Verify** full system functionality and, if applicable, apply preventive measures.
6. **Document** findings, actions, and outcomes.

A memory trick: **"I Enjoy This, Enjoying Various Doughnuts"** (Identify, Establish theory, Test, Establish plan, Verify, Document).

We will use this exact method in Week 4 to troubleshoot real issues on the smart mirror.

---

## Smart error: how this repo maps to the exam

You are lucky to have a real, running system to learn on. Here is the quick map (each week goes deeper):


| Exam area                             | Where you see it in the smart-mirror project                                   |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| Networking: ports/protocols           | `docker-compose.yml` publishes ports 80, 3000, 1883                            |
| Networking: IP / Wi-Fi                | `backend/src/services/wifi.js`, `/api/wifi/current`                            |
| Networking: web server / IoT / broker | backend = web server, ESP32 = IoT device, `mosquitto` = MQTT broker            |
| Hardware                              | Raspberry Pi 5, USB camera, HDMI display, ESP32 (`README.md` hardware section) |
| Virtualization & Cloud                | Docker containers in `docker-compose.yml`                                      |
| Troubleshooting                       | `/api/health`, `docker compose logs`, `backend/__tests__/`                     |


---

## Test-taking tips for beginners

- **Read the last line of the question first.** It tells you what is actually being asked.
- **Eliminate obviously wrong answers** to improve your odds even when unsure.
- **Watch for "BEST" / "MOST likely" / "FIRST".** Several answers may be technically true; pick the one that fits the qualifier.
- **Do not overthink.** A+ tests fundamentals, not edge cases.
- **Manage time:** ~1 minute per question average. Flag hard ones and return to them.
- **On PBQs:** do the parts you know first; partial credit is possible.

You've got this. Move on to **[week-1-networking/01-day-1-ports-and-protocols.md](week-1-networking/01-day-1-ports-and-protocols.md)** when you are ready.