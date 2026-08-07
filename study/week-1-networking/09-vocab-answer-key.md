# Week 1 Vocab — Networking

The terms for this week, grouped by day. Try the "cover and recall" method: read the term, cover the definition, say it in your own words, then check.

> These also live in `../vocab/master-glossary.md` (the running list for the whole month).

---

## Day 1 — Ports & Protocols


| Term               | Definition                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| Protocol           | Agreed-upon rules for how devices communicate.                                                 |
| Port               | A numbered "door" (0-65535) a service listens on; IP finds the device, port finds the service. |
| Well-known ports   | Ports 0-1023 reserved for common services (the memorize list).                                 |
| TCP                | Connection-oriented, reliable, ordered delivery (web, email, SSH).                             |
| UDP                | Connectionless, fast, no delivery guarantee (streaming, VoIP, DNS).                            |
| Client             | The device/program making a request.                                                           |
| Server             | The device/program answering requests.                                                         |
| Non-ephemeral port | Permanent/well-known port 0-1023, on the server/service side.                                  |
| Ephemeral port     | Temporary port 1024-65535 the client picks per conversation.                                   |
| Socket             | IP address + protocol + port together (defines one endpoint).                                  |
| Multiplexing       | Running many conversations at once via different ports.                                        |
| Encapsulation      | Nesting data: Ethernet holds IP holds TCP/UDP holds application data.                          |
| NetBIOS (137-139)  | Old Windows name/session sharing, replaced by SMB (445).                                       |


**Ports to memorize:** 20/21 FTP, 22 SSH, 23 Telnet, 25 SMTP, 53 DNS, 67/68 DHCP, 80 HTTP, 110 POP3, 137-139 NetBIOS, 143 IMAP, 389/636 LDAP/LDAPS, 443 HTTPS, 445 SMB/CIFS, 3389 RDP.

**Two exam flags:** ports are for communication, *not* security; and TCP port 80 ≠ UDP port 80 (separate sets).

---

## Day 2 — IP Addressing


| Term                 | Definition                                                                      |
| -------------------- | ------------------------------------------------------------------------------- |
| IPv4                 | 32-bit address, dotted decimal (e.g., 192.168.1.50).                            |
| IPv6                 | 128-bit address, colon-separated hex.                                           |
| Octet                | One of the four numbers (0-255) in an IPv4 address.                             |
| Public IP            | Reachable from the internet; assigned by ISP to your router.                    |
| Private IP           | Used only inside a LAN; ranges 10.x, 172.16-31.x, 192.168.x.                    |
| NAT                  | Network Address Translation; lets private devices share one public IP.          |
| Static IP            | Manually set, does not change.                                                  |
| Dynamic IP           | Assigned by DHCP, may change.                                                   |
| APIPA / link-local   | Self-assigned 169.254.x.x address when DHCP fails; local-only, can't route out. |
| RFC 1918             | The standard that defines the three private IPv4 ranges.                        |
| ARP                  | Maps an IP address to a MAC (hardware) address on the local network.            |
| Subnet mask          | Splits an IP into network vs host parts (e.g., 255.255.255.0).                  |
| Default gateway      | The router; where traffic goes to leave the local network.                      |
| Loopback / localhost | 127.0.0.1, meaning "this same machine."                                         |
| ISP                  | Internet Service Provider; gives your router its public IP.                     |


---

## Day 3 — Network Services


| Term                        | Definition                                                                       |
| --------------------------- | -------------------------------------------------------------------------------- |
| Network service             | A program that provides a function to other devices.                             |
| DNS server                  | Resolves names to IP addresses.                                                  |
| DHCP server                 | Automatically assigns IP addresses.                                              |
| Web server                  | Answers HTTP/HTTPS requests (the mirror backend).                                |
| File / Print / Mail server  | Share files / manage printers / handle email.                                    |
| Proxy server                | Forwards/filters requests between clients and the internet.                      |
| Load balancer               | Spreads traffic across multiple servers.                                         |
| Authentication server (AAA) | Verifies identity (Authentication, Authorization, Accounting).                   |
| Database server / SQL       | Stores/retrieves structured data (MySQL, MS SQL Server).                         |
| Syslog / SIEM               | Central log collection / correlation and analysis.                               |
| NTP                         | Network Time Protocol; keeps device clocks accurate.                             |
| Spam gateway                | Filters junk/unsolicited email.                                                  |
| UTM                         | Unified Threat Management; all-in-one security appliance / next-gen firewall.    |
| IoT                         | Internet of Things; networked everyday devices (the ESP32).                      |
| Embedded system             | A computer built into a device for one dedicated job.                            |
| Legacy system               | Old hardware/software still in use.                                              |
| SCADA / ICS                 | Industrial control systems (utilities, factories); usually isolated networks.    |
| Message broker              | A service that relays messages between senders and subscribers (mosquitto/MQTT). |


---

## Day 4 — Wireless, DNS, DHCP, VPN


| Term                          | Definition                                                   |
| ----------------------------- | ------------------------------------------------------------ |
| 802.11                        | The Wi-Fi standard family.                                   |
| Wi-Fi 5/6/6E/7                | Friendly names for 802.11ac / ax / ax-6GHz / be.             |
| 2.4 GHz                       | Wi-Fi band: longer range, slower, more interference.         |
| 5 GHz                         | Wi-Fi band: shorter range, faster, less interference.        |
| 6 GHz                         | Newest Wi-Fi band (Wi-Fi 6E/7); most spectrum.               |
| Channel / width               | A band subdivision; width 20/40/80/160 MHz (wider=faster).   |
| ISM band                      | Unlicensed 2.4 GHz band used by Bluetooth/Wi-Fi.             |
| Bluetooth                     | Short-range (~10 m) device-to-device wireless (a PAN).       |
| NFC                           | Very short range, two-way (tap to pay); builds on RFID.      |
| RFID                          | Tag/reader tech; passive (no battery) vs active.             |
| DORA                          | DHCP steps: Discover, Offer, Request, Acknowledge.           |
| Scope                         | All addresses + settings a DHCP server manages.              |
| Pool                          | The assignable addresses within a scope.                     |
| Reservation                   | A fixed address tied to a device's MAC via DHCP.             |
| Exclusion                     | Addresses in the scope the server must NOT hand out.         |
| Lease                         | How long a DHCP address is valid.                            |
| A / AAAA record               | DNS name → IPv4 / IPv6.                                      |
| CNAME / MX / TXT              | Alias / mail server / text (verification) records.           |
| SPF / DKIM / DMARC            | TXT-based email-security records (anti-spoofing).            |
| dig / nslookup                | Commands to query DNS directly (Linux-mac / Windows).        |
| VPN                           | Encrypted tunnel to securely reach a remote network.         |
| Concentrator                  | Device that encrypts/decrypts VPN traffic.                   |
| Client-to-site / site-to-site | One remote user / two whole sites linked by VPN.             |
| VLAN                          | Logical segmentation; each VLAN is its own broadcast domain. |
| Broadcast domain              | The set of devices that receive each other's broadcasts.     |
| wlan0                         | The Pi's wireless network interface name.                    |


---

## Day 5 — Devices, Types, Tools


| Term                                              | Definition                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| Router                                            | Connects/routes traffic between different networks (by IP).        |
| Switch                                            | Connects devices within one LAN, forwarding by MAC address.        |
| Managed vs unmanaged switch                       | Managed = VLANs/SNMP/port mirroring; unmanaged = plug-and-play.    |
| Port mirror / SPAN                                | Copies a switch port's traffic to a monitoring port.               |
| Access point (AP)                                 | Adds Wi-Fi to a network.                                           |
| Firewall                                          | Allows/blocks traffic by port (traditional) or app (next-gen).     |
| Cable modem / DOCSIS                              | Internet over coax cable; DOCSIS is the standard.                  |
| DSL                                               | Internet over phone lines; distance-limited.                       |
| ONT / demarc                                      | Fiber terminal; demarc = boundary between your wiring and ISP.     |
| Patch panel                                       | Organizes/terminates cable runs.                                   |
| PoE / PoE+ / PoE++                                | Power + data over Ethernet; ~15 / ~25 / ~51-71 W.                  |
| Injector                                          | Adds PoE inline (midspan) when the switch can't.                   |
| NIC                                               | Network Interface Card; connects a device to a network.            |
| MAC address                                       | Burned-in hardware address of a NIC.                               |
| PAN / LAN / WLAN / WAN / MAN / SAN                | Personal / Local / Wireless LAN / Wide / Metro / Storage networks. |
| Satellite / fiber / cable / DSL / cellular / WISP | Internet connection types (2.7).                                   |
| Tethering vs hotspot                              | Phone shares data with one device vs. several.                     |
| Cable tester                                      | Verifies a cable is wired correctly (continuity).                  |
| Crimper                                           | Attaches a connector (RJ45) to a cable.                            |
| Cable stripper                                    | Removes the outer jacket to expose wires.                          |
| Punch-down tool                                   | Seats wires into a patch panel/jack.                               |
| Toner probe                                       | Tone generator + probe; traces a cable in a bundle.                |
| Loopback plug                                     | Tests a port by looping output to input.                           |
| Wi-Fi analyzer                                    | Shows nearby networks, channels, signal.                           |
| Network tap                                       | Copies traffic on a link for monitoring.                           |


