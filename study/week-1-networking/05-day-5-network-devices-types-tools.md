# Week 1 · Day 5 — Network Devices, Types, and Tools

`Day 5 of 7` · [← Day 4](04-day-4-wireless-dns-dhcp-vpn.md) · [Week overview](00-week-overview.md) · [Vocab practice](08-vocab-practice.md) · [Next: Day 6 →](06-day-6-lab-trace-a-request.md)

---

**Exam objectives:** 2.5 — Network devices (routers, switches, APs, firewalls, etc.); 2.7 — Internet connection types and network types (LAN/WAN/PAN/WLAN); 2.8 — Networking tools.
**Messer videos:** 2.5 **"Network Devices" (18:01)**, 2.7 **"Internet Connection Types" (7:33)** and **"Network Types" (4:46)**, 2.8 **"Network Tools" (11:48)**.

---

> ### Capture list (while you watch)
> Don't take full notes — your lesson files and Messer's Course Notes PDF already have those. Instead, jot **3-5 quick lines** as you watch, then bring them to the lesson/quiz:
> 1. Anything that **confused** you (to re-explain).
> 2. Anything **surprising** or important not already in this file.
> 3. Anything Messer says is **"on the exam"** or commonly missed.

## 1. Watch (~20-25 min)

- Watch **Network Devices** (the important one).
- Watch **Network Types** (short).
- Watch **Network Tools**.
- Watch **Internet Connection Types** (satellite, fiber, cable, DSL, cellular, WISP — recognize each).

---

## 2. Read + Vocab (~20 min)

### Network devices — who does what

This is a favorite exam topic. Learn what each device *does*:


| Device                           | Job                                                                                      | Simple analogy                               |
| -------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Router**                       | Connects *different* networks and directs traffic between them (your LAN ↔ the internet) | Post office that routes mail between cities  |
| **Switch**                       | Connects devices *within the same* LAN; sends traffic only to the correct port           | Office mailroom delivering to the right desk |
| **Access Point (AP)**            | Adds Wi-Fi so wireless devices can join a wired network                                  | A Wi-Fi "antenna" for the network            |
| **Firewall**                     | Allows/blocks traffic based on rules (security)                                          | Security guard checking a list               |
| **Modem**                        | Converts ISP signal (cable/DSL/fiber) to/from network data                               | Translator at the border                     |
| **Patch panel**                  | Organizes/terminates many cable runs in a rack                                           | Labeled junction box                         |
| **PoE (Power over Ethernet)**    | Sends power *and* data over one Ethernet cable                                           | Powers cameras/APs without a separate plug   |
| **NIC (Network Interface Card)** | The adapter that connects a device to the network                                        | The device's "network mouth"                 |
| **ONT**                          | Fiber terminal that converts the fiber line for home use                                 | Fiber's version of a modem                   |


At home you often have one box that is a **modem + router + switch + access point** combined. On the exam, they are separate concepts — know each job.

**A few device details the exam loves:**

- **Managed vs unmanaged switch** — an *unmanaged* switch is plug-and-play with no configuration (one big VLAN, no remote management). A *managed* switch adds VLANs, traffic prioritization, redundancy, remote management (SNMP), and **port mirroring** for monitoring. Enterprises use managed switches.
- **NIC → MAC address** — every network interface has a burned-in **MAC (Media Access Control) address**. Switches forward based on MAC; routers forward based on IP.
- **Firewall: traditional vs next-generation** — a traditional firewall allows/blocks by **port number**; a *next-generation* firewall decides by the **application** in use (e.g., allow web but block a remote-access app). Firewalls often also act as a router and VPN concentrator.
- **Cable modem / DSL / ONT** — a **cable modem** uses **DOCSIS** over coax; **DSL** runs data over phone lines (distance-limited, ~10,000 ft to the central office); an **ONT** terminates fiber at the **demarc** (demarcation point — the boundary between your wiring and the ISP's).

<details><summary><strong>Go deeper (optional)</strong> — PoE standards</summary>

- **PoE** (original): ~15.4 W — phones, small devices.
- **PoE+**: ~25.5 W — bigger devices like pan/tilt/zoom cameras.
- **PoE++**: ~51-71 W — even laptops; introduced with 10-Gig copper Ethernet.
- Power can come from the switch itself (**endspan**) or from an inline **injector** (**midspan**). Standards are downward compatible, not upward.

</details>

### Network types (memorize the sizes)


| Type                                | Scope                                            |
| ----------------------------------- | ------------------------------------------------ |
| **PAN** (Personal Area Network)     | Around one person (Bluetooth)                    |
| **LAN** (Local Area Network)        | One building/home                                |
| **WLAN** (Wireless LAN)             | A LAN using Wi-Fi                                |
| **WAN** (Wide Area Network)         | Large distances; the internet is the biggest WAN |
| **SAN** (Storage Area Network)      | Dedicated high-speed storage network             |
| **MAN** (Metropolitan Area Network) | City-sized                                       |


Your smart mirror lives on a **WLAN** (it is on your **LAN** via **Wi-Fi**). Your phone reaching it uses that LAN. When the mirror fetches weather, it reaches out over the **WAN** (internet).

### Internet connection types (objective 2.7)

How you reach the internet in the first place:

| Type | Key facts |
|------|-----------|
| **Satellite** | Works almost anywhere; higher latency and cost; affected by weather ("rain fade"). Starlink is lower-orbit, so lower latency. |
| **Fiber** | Light over glass; fastest and longest distance; a bit pricier. |
| **Cable** | Uses TV coax + a cable modem; **DOCSIS** standard; "broadband" (many frequencies at once). |
| **DSL** | Data over phone lines; slower upload than download (ADSL); speed drops with distance from the central office. |
| **Cellular** | Uses mobile 3G/4G/5G towers; **tethering** = one device, **hotspot** = several devices. |
| **WISP** (Wireless ISP) | An antenna links you to a wireless provider; good for remote areas. |

> **Quick check:** A customer in a very rural area with no cable or phone lines needs internet. Which two connection types are most likely? (Answer: **satellite** and **WISP** — or cellular where there's a tower.)

### Network tools (know the tool → job)


| Tool                       | Used for                                       |
| -------------------------- | ---------------------------------------------- |
| **Cable tester**           | Verify a cable is wired correctly and conducts (continuity, pin 1→1, etc.) |
| **Crimper**                | Attach an RJ45 connector to a cable end        |
| **Cable stripper**         | Remove the outer jacket to expose the wires    |
| **Punch-down tool**        | Seat wires into a patch panel / keystone jack  |
| **Toner probe (tone generator & probe)** | Find/trace one specific cable in a bundle |
| **Loopback plug**          | Test a network port by looping output to input |
| **Wi-Fi analyzer**         | See nearby networks, channels, signal strength |
| **Network tap**            | Copy traffic on a link for monitoring (vs. a switch **port mirror / SPAN**) |


There are also **software** tools you have already used — `ping`, `ip`, and `ss` — which are the everyday troubleshooting commands.

### Vocab to write down

`router`, `switch (managed vs unmanaged)`, `port mirror / SPAN`, `access point`, `firewall (traditional vs next-gen)`, `cable modem / DOCSIS`, `DSL`, `ONT / demarc`, `patch panel`, `PoE / PoE+ / PoE++`, `injector`, `NIC`, `MAC address`, `PAN`, `LAN`, `WLAN`, `WAN`, `MAN`, `SAN`, `satellite`, `fiber`, `cable`, `DSL`, `cellular (tethering vs hotspot)`, `WISP`, `cable tester`, `crimper`, `cable stripper`, `punch-down tool`, `toner probe`, `loopback plug`, `Wi-Fi analyzer`, `network tap`.

---

## 3. Lab + Self-check (~20 min)

### Lab 5A — Classify your own network

Sketch (on paper) the path from your phone to the smart mirror and answer:

1. Your phone → Wi-Fi → the mirror: which **network type** is this (LAN/WLAN/WAN)?
2. What single home device is likely acting as router **and** switch **and** access point for you?
3. When the mirror fetches the weather, which network type does that traffic cross to leave your house?

### Lab 5B — Use software network tools on the Pi

These are the real, everyday tools. Run on the Pi:

```bash
ip addr
```

Shows all network interfaces and their IPs (find `wlan0`).

```bash
ip route
```

The line starting with `default via ...` shows your **default gateway** — that address is your **router**.

```bash
ss -tlnp
```

Lists TCP ports currently **listening** on the Pi. See if you can spot the smart-mirror services (something on `3001` for the backend inside the container context, `3000`, `1883`, etc., depending on where you run it). This is the software equivalent of walking down the hall checking which office doors are staffed.

```bash
ping -c 4 <your-gateway-ip>
```

Ping your router (the gateway IP from `ip route`). Replies confirm the Pi can reach its router.

### Lab 5C — Connect the concept to hardware you own

The ESP32 console has a **NIC** too — its built-in Wi-Fi radio is a network interface card in miniature. When it joins your Wi-Fi and talks MQTT to the Pi, it is a wireless host on your **WLAN**, going through your **access point**. Every abstract term today maps to a real thing on your desk.

### Mini self-check

1. What is the difference between a **router** and a **switch**?
2. What does an **access point** add to a network?
3. Order by size (smallest to largest): WAN, PAN, LAN.
4. You need to find which of 24 identical cables in a bundle is the one you want. Which tool?
5. Which command shows your default gateway, and what device is that gateway?

*(Answers in [11-quiz-answer-key.md](11-quiz-answer-key.md) under "Day 5 self-check.")*

---

## Done?

1. Write today's terms in [08-vocab-practice.md](08-vocab-practice.md)
2. Check off Day 5 in [../02-progress-tracker.md](../02-progress-tracker.md)

**Next → [Day 6: LAB — Trace a Request](06-day-6-lab-trace-a-request.md)** (hands-on day)