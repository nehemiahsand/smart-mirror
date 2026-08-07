# Week 1 · Day 2 — IP Addressing

`Day 2 of 7` · [← Day 1](01-day-1-ports-and-protocols.md) · [Week overview](00-week-overview.md) · [Vocab practice](08-vocab-practice.md) · [Next: Day 3 →](03-day-3-network-services.md)

---

**Exam objectives:** 2.6 — Compare and contrast common network configuration concepts (IPv4/IPv6, static vs dynamic, APIPA, private vs public).
**Messer videos:** 2.6 **"IPv4 and IPv6" (8:45)** and **"Assigning IP Addresses" (8:26)**.

---

> ### Capture list (while you watch)
>
> Don't take full notes — your lesson files and Messer's Course Notes PDF already have those. Instead, jot **3-5 quick lines** as you watch, then bring them to the lesson/quiz:
>
> 1. Anything that **confused** you (to re-explain).
> 2. Anything **surprising** or important not already in this file.
> 3. Anything Messer says is **"on the exam"** or commonly missed.
>
> - what is a subnet mask?
> - what is a gateway?
> - what is dhcp?
> - apipa vs dhcp? how does each work with each other?



## 1. Watch (~20 min)

- Watch **IPv4 and IPv6**.
- Watch **Assigning IP Addresses**.

---



## 2. Read + Vocab (~20 min)

Yesterday: a port is a door on a device. Today: how the *device itself* gets its address.

### What an IP address looks like

An **IPv4** address is four numbers (each 0-255) separated by dots:

```
192.168.1.50
```

Each number is called an *octet* (8 bits). Four octets = 32 bits total. That gives about 4.3 billion possible addresses — which sounds like a lot, but we ran out. That is why **IPv6** exists:

```
2001:0db8:85a3:0000:0000:8a2e:0370:7334
```

IPv6 uses hexadecimal and colons, and is vastly larger (enough addresses for every grain of sand many times over). For the exam, know: **IPv4 = 32-bit, dotted decimal; IPv6 = 128-bit, colon-separated hex.**

### Public vs Private IP addresses (important!)

- **Public IP** — reachable from the internet. Your **router** gets one public IP from your Internet Service Provider (ISP).
- **Private IP** — used only *inside* your local network. Every device behind your router (laptop, phone, the smart-mirror Pi) gets a private IP.

You must memorize the **private IP ranges**:


| Range                             | Common use                |
| --------------------------------- | ------------------------- |
| `10.0.0.0` – `10.255.255.255`     | Big networks              |
| `172.16.0.0` – `172.31.255.255`   | Medium networks           |
| `192.168.0.0` – `192.168.255.255` | Home/office (most common) |


These three ranges are defined by a standard called **RFC 1918** (Messer mentions it by name — worth recognizing). If you see `192.168.x.x`, you are almost certainly looking at a device on a home LAN — like your smart mirror. The router uses **NAT (Network Address Translation)** to let many private devices share the one public IP. (You will hear "NAT" a lot; just know it = private ↔ public translation.) This is *why* private addresses exist: there are only ~4.29 billion IPv4 addresses total but 20+ billion devices, so most devices hide behind NAT.

> **Quick check:** Which of these is public: `10.5.5.5`, `192.168.0.9`, or `8.8.8.8`? (Answer: `8.8.8.8` — the other two are in private ranges.)



### Static vs Dynamic addressing

- **Static IP** — you set it by hand, and it never changes. Good for servers/printers you always want to find at the same address.
- **Dynamic IP** — handed out automatically by a **DHCP** server (usually your router). Easier; the address may change over time.

We cover DHCP in depth on Day 4, but know the term now: **DHCP = the service that automatically gives devices an IP.**

### APIPA — the "something's wrong" address

If a device is set to get its address via DHCP but **no DHCP server answers**, it assigns itself an address in the range:

```
169.254.x.x
```

This is **APIPA (Automatic Private IP Addressing)**, also called a **link-local address**. On the exam and in real life, **seeing a** `169.254.x.x` **address is a giant clue that DHCP failed** (bad cable, dead router, Wi-Fi not really connected). Remember this — it comes back in Week 4 troubleshooting.

**Go deeper (optional)** — exactly how APIPA behaves

- The full APIPA block is `169.254.0.0`–`169.254.255.255`, but the first and last 256 addresses are reserved, so a device actually assigns itself something in `169.254.1.0`–`169.254.254.255`.
- "Link-local" means the device **can talk to other devices on the same local subnet but cannot route out to the internet** (no gateway). So you may have partial local connectivity but no web access.
- Before using its random pick, the device sends an **ARP request** ("does anyone already have this address?"). If no one answers, it keeps the address. ARP is the protocol that maps an IP address to a MAC (hardware) address.



### A few more must-know pieces of an IP config

- **Subnet mask** (e.g., `255.255.255.0`) — splits the address into "network part" and "host part." With `255.255.255.0`, the first three octets are the network; the last is the specific device.
- **Default gateway** — the address of your router; where traffic goes to leave the local network.
- **Loopback / localhost** — `127.0.0.1` always means "this same machine" (you used `localhost` yesterday).



### Vocab to write down

`IPv4`, `IPv6`, `octet`, `public IP`, `private IP`, `RFC 1918`, `NAT`, `static IP`, `dynamic IP`, `APIPA / link-local (169.254.x.x)`, `ARP`, `subnet mask`, `default gateway`, `loopback (127.0.0.1)`, `ISP`.

---



## 3. Lab + Self-check (~20 min)



### Lab 2A — Ask the mirror for its own network info

The smart mirror has an endpoint that reports its current Wi-Fi and IP. Run this (replace `<pi-ip>`, or use `localhost` if you are on the Pi):

```bash
curl http://localhost/api/wifi/current
```

Look at the IP address it reports. **Is it in one of the private ranges above?** (It should be — likely `192.168.x.x` or `10.x.x.x`.)

Behind the scenes, this endpoint is powered by `backend/src/services/wifi.js`, which gathers the IP using standard Linux commands like `ip addr` and `hostname -I`. You are seeing real networking tooling wrapped in a friendly API.

### Lab 2B — Find the Pi's IP the "real technician" way (run ON THE PI)

```bash
hostname -I
```

```bash
ip addr show wlan0
```

`ip addr show wlan0` shows your Wi-Fi interface. Look for the line starting with `inet` — that is your IPv4 address and subnet (e.g., `inet 192.168.1.50/24`). The `/24` is shorthand for the subnet mask `255.255.255.0`.

### Lab 2C — Reach the Pi from your laptop (run ON YOUR LAPTOP)

Using the IP you just found, test connectivity with `ping`:

```bash
ping <pi-ip>
```

`ping` sends small test packets and reports if they come back and how fast. Replies = the device is reachable on the LAN. (Press `Ctrl + C` to stop; on macOS/Linux it runs until stopped.)

Then open a browser to `http://<pi-ip>:3000` — you should see the mirror display. You just used an **IP + port** to reach a specific service. That is Day 1 and Day 2 combined.

### Mini self-check

1. Is `192.168.4.20` a public or private address? Which range is it in?
2. A computer shows an IP of `169.254.10.5`. What almost certainly went wrong?
3. What is the difference between a static and a dynamic IP?
4. How many bits is an IPv4 address? An IPv6 address?
5. What does the default gateway do?

*(Answers in [11-quiz-answer-key.md](11-quiz-answer-key.md) under "Day 2 self-check.")*

---



## Done?

1. Write today's terms in [08-vocab-practice.md](08-vocab-practice.md)
2. Check off Day 2 in [../02-progress-tracker.md](../02-progress-tracker.md)

**Next → [Day 3: Network Services](03-day-3-network-services.md)**