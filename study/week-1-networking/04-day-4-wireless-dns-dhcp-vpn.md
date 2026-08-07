# Week 1 · Day 4 — Wireless, DNS, DHCP, and VPN

`Day 4 of 7` · [← Day 3](03-day-3-network-services.md) · [Week overview](00-week-overview.md) · [Vocab practice](08-vocab-practice.md) · [Next: Day 5 →](05-day-5-network-devices-types-tools.md)

---

**Exam objectives:** 2.2 — Wireless networking (802.11, frequencies, Bluetooth, NFC, RFID); 2.4 — Network configuration concepts (DNS records, DHCP, VLANs, VPNs).
**Messer videos:** 2.2 **"Wireless Network Technologies" (7:16)**, 2.4 **"DNS Configuration" (18:18)**, **"DHCP" (10:46)**, **"VLANs and VPNs" (7:32)**.

> This is a heavier reading day (four short videos). If you are short on time, split it: wireless + DHCP today, DNS + VPN tomorrow morning. The lab is quick.

---

> ### Capture list (while you watch)
> Don't take full notes — your lesson files and Messer's Course Notes PDF already have those. Instead, jot **3-5 quick lines** as you watch, then bring them to the lesson/quiz:
> 1. Anything that **confused** you (to re-explain).
> 2. Anything **surprising** or important not already in this file.
> 3. Anything Messer says is **"on the exam"** or commonly missed.

## 1. Watch (~20-25 min)

- Watch **Wireless Network Technologies**.
- Watch **DHCP**.
- Watch **VLANs and VPNs**.
- Watch **DNS Configuration** (the longest — you can skim the record-type details; know what DNS *is* and the A/AAAA/CNAME/MX basics).

---

## 2. Read + Vocab (~20 min)

### Wireless basics (802.11 = Wi-Fi)

Wi-Fi standards are named **802.11** followed by letters, but CompTIA now also uses friendlier names. Worth memorizing the mapping (Messer highlights it):

- **802.11ac = Wi-Fi 5**, **802.11ax = Wi-Fi 6 / 6E**, **802.11be = Wi-Fi 7**.

Wi-Fi uses three **frequency bands**:

- **2.4 GHz** — longer range, slower, more interference; only ~3 non-overlapping channels.
- **5 GHz** — shorter range, faster, many more channels.
- **6 GHz** — newest (Wi-Fi 6E/7), the most available spectrum.

More wireless terms:

- **Channels** — sub-divisions of a band (easier to reference than exact frequencies). **Channel width/bandwidth** can be 20/40/80/160 MHz — wider = faster but uses more spectrum.
- **Bluetooth** — device-to-device, ~10 meter range, uses the 2.4 GHz **ISM** band; forms a **PAN**.
- **RFID** — tags/readers (badges, inventory, pet chips). Passive tags have **no battery** (powered by the reader's radio energy); active tags have a battery for longer range.
- **NFC** — very short range, two-way; builds on RFID (tap to pay, quick device pairing).

The smart-mirror Pi connects over Wi-Fi (interface `wlan0`). Your labs today read its wireless status.

> **Quick check:** Your apartment has 20 neighbors all on Wi-Fi and your 2.4 GHz connection is flaky. Which band should you try, and why? (Answer: **5 GHz** (or 6 GHz) — far more non-overlapping channels, so less interference.)

### DHCP — the automatic address giver (deeper)

When a device joins a network, it does the **DORA** handshake to get an IP from the DHCP server:

1. **D**iscover — "Is there a DHCP server out there?"
2. **O**ffer — server: "Here's an address you can use."
3. **R**equest — device: "I'll take it."
4. **A**cknowledge — server: "It's yours (for a set lease time)."

Terms (all in objective 2.4):

- **Scope** — the full set of addresses and settings a DHCP server manages for a subnet.
- **Pool** — the addresses within the scope that are actually available to hand out.
- **Reservation** — ties a specific device (by its **MAC address**) to always get the same IP.
- **Exclusions** — addresses inside the scope the server must *not* hand out (e.g., a router/printer that has a static IP).
- **Lease** — how long an assigned address is valid before it must be renewed.

Remember from Day 2: if DORA fails, the device falls back to **APIPA (169.254.x.x)**.

### DNS — the internet's phone book (deeper)

DNS turns names into IPs. A few **record types** to recognize:

| Record | Purpose |
|--------|---------|
| **A** | Name → IPv4 address |
| **AAAA** | Name → IPv6 address |
| **CNAME** | An alias (one name points to another name) |
| **MX** | Mail exchange (where email for a domain goes) |
| **TXT** | Free-form text; used for verification and email security (SPF/DKIM/DMARC) |

You do not need to master email-security records for now — just know **A/AAAA/CNAME/MX** at a glance. One flag for later: the three **TXT**-based email-security records are **SPF, DKIM, and DMARC** (they help prove an email really came from a domain and fight spam). You can look these up with the `dig` (Linux/macOS) or `nslookup` (Windows) commands.

### VPN and VLAN (segmentation & secure remote access)

- **VLAN (Virtual LAN)** — logically splitting one physical switch into separate segments. Key idea: **each VLAN is its own broadcast domain**, so devices on VLAN 1 cannot directly reach VLAN 2 without a router.
- **VPN (Virtual Private Network)** — an **encrypted tunnel** over the internet that makes a remote device act like it is on the local network. The device that encrypts/decrypts is called a **concentrator** (often built into a firewall). Two common types:
  - **Client-to-site** — one remote user (e.g., you working from home) tunnels into the office.
  - **Site-to-site** — two whole locations (two firewalls) are permanently linked over the internet.

This repo uses a real VPN: **Tailscale**. It lets the owner reach the mirror securely from anywhere without exposing it to the open internet.

> **Quick check:** You want everything a work-from-home laptop sends to the office to be encrypted automatically. Which VPN type is that? (Answer: **client-to-site**.)

### Vocab to write down

`802.11`, `Wi-Fi 5/6/6E/7`, `2.4/5/6 GHz`, `channel / channel width`, `ISM band`, `Bluetooth`, `NFC`, `RFID (passive vs active)`, `DHCP`, `DORA`, `scope`, `pool`, `reservation`, `exclusion`, `lease`, `DNS record (A, AAAA, CNAME, MX, TXT)`, `SPF/DKIM/DMARC`, `dig / nslookup`, `VPN`, `concentrator`, `client-to-site vs site-to-site`, `VLAN`, `broadcast domain`, `wlan0`.

---

## 3. Lab + Self-check (~20 min)

### Lab 4A — Read the mirror's real Wi-Fi tooling

Open `backend/src/services/wifi.js`. Skim it (you do not need to understand the code). Search (Ctrl+F) for these command names and notice them being used:

- `nmcli` — the **NetworkManager** command-line tool (connect/scan Wi-Fi).
- `iwconfig` / `iw` — classic wireless tools (show SSID, signal).
- `wpa_supplicant` — the component that handles Wi-Fi authentication.

These are exactly the "wireless tools" the exam references, used here for real. Then check the live status:

```bash
curl http://localhost/api/wifi/status
```

Look for the SSID (network name) and signal info.

### Lab 4B — Find the DHCP fingerprint

On the Pi, look at your Wi-Fi address again:

```bash
ip addr show wlan0
```

Your Pi almost certainly received this address via **DHCP** from your router (that is the default). If instead you ever see a `169.254.x.x` here, you now know DHCP failed.

### Lab 4C — Find the VPN and DNS features in the repo

- Open `scripts/start-mirror.sh` and find the line with `tailscale up`. That is the **VPN** being started for secure remote access.
- Open `scripts/setup-encrypted-dns.sh` and skim the top comments. This optional script sets up **encrypted DNS** (DNS-over-HTTPS). Notice references to `/etc/resolv.conf` (the file that lists which DNS server the system uses).

You do not run these — just locate and recognize them. Being able to say "this line is the VPN, this file is DNS config" is exactly the skill the exam tests.

### Lab 4D — Do a real DNS lookup (run ON THE PI)

Use the same tool Messer demonstrates to query DNS directly:

```bash
dig professormesser.com
```

Look at the `ANSWER SECTION` — those are the **A records** (name → IPv4). Try a mail lookup too:

```bash
dig professormesser.com MX
```

That returns the **MX record** (the mail server for the domain). This is DNS resolution happening live, by hand.

### Mini self-check

1. What are the two main Wi-Fi frequency bands, and what is the trade-off between them?
2. Put the DHCP steps in order (there are four). What is the memory word?
3. Which DNS record maps a name to an IPv4 address? Which maps to IPv6?
4. In one sentence, what does a VPN do?
5. Which real VPN tool does this repo use, and in which script is it started?

*(Answers in [11-quiz-answer-key.md](11-quiz-answer-key.md) under "Day 4 self-check.")*

---

## Done?

1. Write today's terms in [08-vocab-practice.md](08-vocab-practice.md)
2. Check off Day 4 in [../02-progress-tracker.md](../02-progress-tracker.md)

**Next → [Day 5: Network Devices, Types & Tools](05-day-5-network-devices-types-tools.md)**
