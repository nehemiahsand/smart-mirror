# Week 1 — Vocab Practice (fill this in)

**How to use this file**

1. Write your own definition after each dash. Short and in plain English is perfect.
2. Don't look at [09-vocab-answer-key.md](09-vocab-answer-key.md) or the glossary while you write. Guessing is fine.
3. When you're done with a section, tell your teacher **"check my vocab"** — the answers get graded, and for anything wrong you get a *hint* first (not the answer) so you can rewrite it yourself.
4. Leave a term blank if you have no idea. Blank is honest data.

> Days 1–3 are here now. Days 4 and 5 get added as you finish them, so this file never feels overwhelming.

---



## Day 1 — Ports & Protocols

1. **Protocol** — a set of rules to tell a two devices how to talk with one another
2. **Port** — a door for one device to connect to a service on another device (0-65535)
3. **Well-known ports** — 0-1023
4. **TCP** — requires a connection like a phone call. Call and response.
5. **UDP** — one device sending data to another device without expecting a response
6. **Client** — the user side device
7. **Server** — a device answering the user's requests
8. **Non-ephemeral port** — permanent port reserved for certain protocols or services
9. **Ephemeral port** — temporary ports that a client uses for a service (usually **1024–65535**)
10. **Socket** — combination of protocol, IP address, and port
11. **Multiplexing** — using multiple ports at the same time
12. **Encapsulation** — nesting data inside of layers (app data → TCP/UDP → IP → Ethernet)
13. **NetBIOS (137-139)** — Old Windows name/session sharing. Mostly replaced by **SMB on port 445**.



### Port numbers (write the protocol next to each number)

- 20 / 21 — FTP
- 22 — SSH
- 23 — telnet
- 25 — SMTP *(filled in — sending email between mail servers)*
- 53 — DNS
- 67 / 68 — DHCP
- 80 — http
- 110 — POP3 *(filled in — old "download email to this PC")*
- 143 — IMAP *(filled in — newer email; usually keeps mail on server)*
- 389 / 636 — LDAP / LDAPS *(filled in — directory / "phone book" lookups)*
- 443 — https
- 445 — SMB
- 3389 — RDP *(filled in — remote Windows desktop)*

---



## Day 2 — IP Addressing

1. **IPv4** — an address of 4 numbers that range from 0-255 (4 billion possibilites)
2. **IPv6** — an address of hex numbers that are colon seperated (4 untellion)
3. **Octet** — 8 binary numbers that can add up to 255
4. **Public IP** — an address that is visible to the internet network
5. **Private IP** — an address that is hidden in LAN (10..., 172.16..., 192.168...)
6. **NAT** — the way that a private IP reaches the public IP
7. **Static IP** — an address that is set on the device itself and doesn't change unless manually changed
8. **Dynamic IP** — an address given automatically normally using DHCP
9. **APIPA / link-local** — an address that is given when DHCP fails (169). Link-Local allows LAN connections
10. **RFC 1918** — a document that defines the standard private IPs
11. **ARP** — this IP is on what MAC address?
12. **Subnet mask** — helps distinguish between network and device
13. **Default gateway** — the IP address given to the router that is normally the first private IP (192.168.1.1)
14. **Loopback / [localhost](http://localhost)** — special address given to the device itself (127)
15. **ISP** — internet service provider gives you an access point to the internet (public IP)



### Extra recall (write the answer)

- The three private IPv4 ranges — (10, 172.16, 192.168)
- What address range means "DHCP failed" — 169
- How many bits in IPv4? In IPv6? — 32, 128

---



## Day 3 — Network Services

1. **Network service** —
2. **DNS server** —
3. **DHCP server** —
4. **Web server** —
5. **File server** —
6. **Print server** —
7. **Mail server** —
8. **Proxy server** —
9. **Load balancer** —
10. **Authentication server (AAA)** —
11. **Database server / SQL** —
12. **Syslog / SIEM** —
13. **NTP** —
14. **Spam gateway** —
15. **UTM** —
16. **IoT** —
17. **Embedded system** —
18. **Legacy system** —
19. **SCADA / ICS** —
20. **Message broker** —


### Extra recall (write the answer)

- What do the three A's in AAA stand for? —
- In this repo, which service is the message broker? (hint: port 1883) —
- Client vs server in one sentence — —

---



## Day 4 — Wireless, DNS, DHCP, VPN

*Added when you finish Day 4.*

## Day 5 — Devices, Types, Tools

*Added when you finish Day 5.*

---



## Grading log

Track how you did so you know what to revisit.


| Date       | Section           | Score                                  | Terms to redo                                                                     |
| ---------- | ----------------- | -------------------------------------- | --------------------------------------------------------------------------------- |
| 2026-07-24 | Day 1 (attempt 1) | ~9/13 terms, 4/13 ports                | protocol, port, well-known, server, ephemeral, encapsulation, NetBIOS, most ports |
| 2026-07-24 | Day 1 (attempt 2) | ~10/13 terms, 7/13 ports               | well-known, ephemeral, encapsulation, NetBIOS, 6 ports                            |
| 2026-07-24 | Day 1 (final)     | terms solid; remaining ports filled in | drill: 25 SMTP, 110 POP3, 143 IMAP, 389/636 LDAP, 3389 RDP                        |
| 2026-07-24 | Day 2 (attempt 1) | ~9/15 terms, 2/3 extras                | private, APIPA, RFC 1918, ARP, gateway, loopback, ISP, private ranges             |
| 2026-07-24 | Day 2 (final)     | ~15/15 — pass                          | optional polish: 172.16–31 (not all of 172.x)                                      |


