# Week 1 Quiz — Answer Key

Do not open this until you have finished [10-quiz.md](10-quiz.md). Grade honestly — the goal is to find weak spots, not a perfect score on the first try.

**Scoring:** 37 questions. 30+ = ready for Week 2. Below 30 = reread the missed topics and retake tomorrow.

---

## Quiz answers (with short explanations)

**1. B) 443** — HTTPS is secure web traffic on 443. (HTTP is 80.)

**2. B) TCP** — TCP is connection-oriented and reliable; UDP is not.

**3. B) 22** — SSH = secure shell = port 22.

**4. C) A live voice/VoIP call** — Real-time audio favors UDP's speed; a few dropped packets beat delay. FTP, HTTPS, and SSH all use TCP.

**5. C) 67/68** — DHCP uses UDP ports 67 (server) and 68 (client).

**6. B) The outside port clients connect to** — In `"80:3001"`, 80 is the host/outside port; 3001 is inside the container.

**7. B) 53** — DNS uses port 53 (mostly UDP, TCP for larger transfers).

**8. C) RDP (3389)** — Remote Desktop Protocol gives graphical remote access; port 3389.

**9. B) 192.168.1.20** — In the `192.168.x.x` private range. (8.8.8.8 and 200.1.1.1 are public; 172.32.x.x is just *outside* the 172.16-172.31 private range.)

**10. C) DHCP failed and it self-assigned an APIPA address** — `169.254.x.x` = APIPA.

**11. B) 32** — IPv4 is 32-bit; IPv6 is 128-bit.

**12. C) It is the device traffic uses to leave the local network** — Usually your router.

**13. B) Manually set and does not change** — Static = fixed by hand.

**14.** The three private ranges:
- `10.0.0.0 – 10.255.255.255`
- `172.16.0.0 – 172.31.255.255`
- `192.168.0.0 – 192.168.255.255`

**15. B) DHCP** — Automatic IP assignment.

**16. B) Discover, Offer, Request, Acknowledge** — DORA.

**17. C) A** — A record → IPv4. (AAAA → IPv6, MX → mail, CNAME → alias.)

**18. B) Authentication (credentials required)** — No anonymous connections allowed.

**19. A) An encrypted tunnel to securely reach a remote network.**

**20. B) 5 GHz** — Faster, shorter range, less interference than 2.4 GHz.

**21. C) The ESP32 console** — Small networked embedded device = IoT.

**22. B) Router** — Routers connect/route between networks; switches connect devices within one LAN.

**23. C) WLAN** — A wireless LAN. (It is also a LAN; WLAN is the most precise answer.)

**24. C) Tone generator and probe** — Traces a specific cable in a bundle.

**25. B) `ip route`** — The `default via ...` line shows the gateway (router).

---

## Part E answers (verification additions)

**26. B) 1024-65535** — Ephemeral (temporary) ports are picked by the client per conversation. Non-ephemeral/well-known ports are 0-1023.

**27. A) 137-139** — NetBIOS/NetBT name and session service; largely replaced by SMB on 445.

**28.** (a) **No** — port numbers are used for communication/reference only, not as a security mechanism (a changed port is easy to find). (b) **No** — TCP and UDP each have their own separate set of ports 0-65535, so TCP 80 ≠ UDP 80.

**29. B) NTP** — Network Time Protocol keeps clocks accurate; matching time is needed to correlate logs and for many encryption systems.

**30. B) Authentication, Authorization, Accounting** — the three A's of an AAA server.

**31. C) UTM (all-in-one security appliance)** — Unified Threat Management combines many security functions in one edge device (aka next-gen firewall).

**32. B) To keep certain addresses in the scope from being handed out** — Exclusions protect statically-assigned devices. (A reservation, by contrast, ties a MAC to a fixed address.)

**33. B) Client-to-site** — One remote user tunnels into the network. Site-to-site links two whole locations (firewall to firewall).

**34. B) Managed switch** — Managed switches add VLANs, SNMP management, prioritization, redundancy, and port mirroring; unmanaged switches are plug-and-play with no configuration.

**35. B) Wi-Fi 6; 6 GHz** — 802.11ax = Wi-Fi 6 (and 6E); Wi-Fi 6E/7 added the 6 GHz band. (802.11ac = Wi-Fi 5, 802.11be = Wi-Fi 7.)

**36. C) WISP (Wireless Internet Service Provider)** — An antenna links a remote site to a wireless provider; ideal where cable/DSL/fiber are unavailable.

**37. B) Cable stripper** — Removes the outer jacket to expose the wires. (A crimper attaches the connector; a punch-down tool seats wires in a panel.)

---

## Daily mini self-check answers

### Day 1 self-check
1. IP = `192.168.1.50` (the device); port = `3000` (the service/door); protocol = `http`.
2. Port **80** — it is HTTP's default port, used automatically when you do not specify one.
3. **UDP** — live streams prefer speed over guaranteed delivery; a dropped frame is better than a delay.
4. HTTP → 80, HTTPS → 443, SSH → 22, DNS → 53.
5. **80** is the outside port people connect to (`80:3001`).

### Day 2 self-check
1. **Private**, in the `192.168.x.x` range.
2. **DHCP failed** — no DHCP server responded, so it self-assigned an APIPA `169.254.x.x` address.
3. Static = set manually and fixed; dynamic = assigned automatically by DHCP and can change.
4. IPv4 = **32 bits**; IPv6 = **128 bits**.
5. The default gateway is the device (router) that traffic goes to in order to leave the local network.

### Day 3 self-check
1. DNS translates names to IP addresses; DHCP automatically assigns IP addresses to devices.
2. Web server = the backend (answers `/api/health` etc.); IoT device = the ESP32 console. (Broker = mosquitto.)
3. It requires a username/password to connect (no anonymous access) — the **authentication** concept.
4. A proxy server sits between clients and the internet, forwarding and often filtering/caching requests.
5. A legacy system is old hardware/software still in use; the exam cares because they need special handling and often have security limitations.

### Day 4 self-check
1. **2.4 GHz** = longer range, slower, more interference; **5 GHz** = shorter range, faster, less interference.
2. Discover → Offer → Request → Acknowledge; memory word **DORA**.
3. **A** record → IPv4; **AAAA** record → IPv6.
4. A VPN creates an encrypted tunnel so a remote device can securely act as if it is on the local network.
5. **Tailscale**, started in `scripts/start-mirror.sh` (the `tailscale up ...` line).

### Day 5 self-check
1. A router connects and routes traffic between different networks; a switch connects devices within the same LAN.
2. An access point adds Wi-Fi, letting wireless devices join a (usually wired) network.
3. Smallest to largest: PAN → LAN → WAN.
4. A **tone generator and probe**.
5. `ip route` (look at `default via ...`); that gateway is your **router**.

---

## After grading

- Record your score in [../02-progress-tracker.md](../02-progress-tracker.md).
- List the question numbers you missed and reread those specific lessons.
- Add any terms you missed to a "revisit" list for Week 4's full review.
