# Master Glossary

Every term from the program, in one place. This grows each week. Terms are grouped by topic, and roughly in the order you learn them.

> How to use: after each lesson, re-read the terms you just learned here. Try to explain each one out loud in your own words. If you can teach it, you know it.

---

## Week 1 — Networking

### Core concepts

- **Network** — two or more devices connected so they can share data.
- **Host** — any device on a network that has an IP address (a computer, phone, Pi, printer).
- **Client** — a device/program that requests something (your browser).
- **Server** — a device/program that answers requests (the smart-mirror backend).
- **Protocol** — an agreed-upon set of rules for how devices communicate (like a shared language).
- **Packet** — a small chunk of data sent across a network. Big data is broken into many packets.

### Addressing

- **IP address** — the unique number that identifies a device on a network (like a house's mailing address). Example: `192.168.1.42`.
- **IPv4** — the older, most common IP format: four numbers 0-255 separated by dots (`192.168.1.42`).
- **IPv6** — the newer, much larger IP format using hex and colons (`2001:0db8::1`). Created because we ran out of IPv4 addresses.
- **Public IP** — an address reachable from the internet (assigned by your ISP to your router).
- **Private IP** — an address used only inside a local network. Reserved ranges: `10.x.x.x`, `172.16.x.x`-`172.31.x.x`, `192.168.x.x`.
- **Static IP** — an address set manually that does not change.
- **Dynamic IP** — an address handed out automatically (by DHCP) that can change.
- **APIPA (169.254.x.x)** — an address a device gives itself when it wanted DHCP but got no response. Seeing `169.254.x.x` usually means "DHCP failed."
- **Subnet mask** — tells a device which part of an IP is the "network" and which part is the "host" (e.g., `255.255.255.0`).
- **Default gateway** — the device (usually your router) that traffic goes to when it needs to leave the local network.
- **Loopback / localhost (127.0.0.1)** — a special address that means "this same device."
- **MAC address** — a hardware address burned into a network adapter (e.g., `a4:83:e7:...`). Unique per network card.
- **RFC 1918** — the standard defining the three private IPv4 ranges.
- **ARP (Address Resolution Protocol)** — maps an IP address to a MAC address on the local network.
- **Link-local (APIPA)** — the 169.254.x.x self-assigned address; local-only, cannot route out.
- **ISP (Internet Service Provider)** — assigns your router its public IP.

### Ports & protocols

- **Port** — a numbered "door" on a device that a specific service listens on. IP finds the device; the port finds the service.
- **TCP** — a connection-oriented protocol that guarantees delivery and order (reliable; used by web, email, file transfer).
- **UDP** — a connectionless protocol that is fast but does not guarantee delivery (used by streaming, DNS lookups, VoIP).
- **HTTP (port 80)** — unencrypted web traffic.
- **HTTPS (port 443)** — encrypted web traffic (secure).
- **FTP (ports 20/21)** — file transfer protocol.
- **SSH (port 22)** — secure remote command-line access to another machine.
- **Telnet (port 23)** — old, insecure remote access (plain text — avoid).
- **DNS (port 53)** — turns names (like `google.com`) into IP addresses.
- **DHCP (ports 67/68)** — automatically assigns IP addresses to devices.
- **SMTP (port 25)** — sending email.
- **POP3 (port 110) / IMAP (port 143)** — receiving/reading email.
- **SMB (port 445)** — Windows file and printer sharing.
- **RDP (port 3389)** — Remote Desktop Protocol (graphical remote access to Windows).
- **LDAP (389) / LDAPS (636)** — directory services (looking up users/resources), plain and secure.
- **MQTT (port 1883)** — a lightweight messaging protocol used by IoT devices (the ESP32 in this repo uses it). Not on CompTIA's memorize list, but a great real example.
- **NetBIOS/NetBT (ports 137-139)** — older Windows name/session sharing, largely replaced by SMB on 445.
- **Non-ephemeral (well-known) ports (0-1023)** — permanent port numbers on the server/service side.
- **Ephemeral ports (1024-65535)** — temporary port numbers a client picks per conversation.
- **Socket** — the combination of IP address + protocol + port number.
- **Multiplexing** — carrying many simultaneous conversations by using different ports.
- **Encapsulation** — nesting data: Ethernet frame → IP packet → TCP/UDP segment → application data.
- **Exam flags:** ports are for communication, not security; TCP port 80 and UDP port 80 are separate.

### Services & devices

- **DNS server** — resolves names to IPs.
- **DHCP server** — hands out IP addresses automatically.
- **Web server** — answers HTTP/HTTPS requests (the smart-mirror backend is one).
- **IoT (Internet of Things)** — everyday devices with network connectivity and embedded computing (the ESP32 console).
- **Router** — connects different networks together and directs traffic between them (e.g., your LAN to the internet).
- **Switch** — connects devices within the same local network; forwards traffic only to the right port.
- **Access point (AP)** — provides Wi-Fi so wireless devices can join a wired network.
- **Firewall** — filters network traffic to allow or block it based on rules.
- **Modem** — converts your ISP's signal (cable/DSL/fiber) into something your router can use.
- **NIC (Network Interface Card)** — the hardware that connects a device to a network (wired or wireless); each has a MAC address.
- **Authentication server (AAA)** — verifies identity: Authentication, Authorization, Accounting.
- **Database server / SQL** — stores/retrieves structured data (MySQL, MS SQL Server).
- **Syslog / SIEM** — central log collection and correlation.
- **NTP (Network Time Protocol)** — keeps device clocks accurate.
- **UTM / all-in-one appliance** — combines firewall, IPS, URL/spam filtering, VPN ("next-gen firewall").
- **Managed vs unmanaged switch** — managed adds VLANs/SNMP/port mirroring; unmanaged is plug-and-play.
- **Port mirror / SPAN** — copies a switch port's traffic to a monitoring port.
- **Cable modem / DOCSIS** — internet over coax; DOCSIS is the standard.
- **DSL** — internet over phone lines; distance-limited to the central office.
- **Demarc (demarcation point)** — boundary between your wiring and the ISP's (often the ONT).
- **PoE / PoE+ / PoE++** — power + data over Ethernet (~15 / ~25 / ~51-71 W); injector = midspan.

### Network types

- **LAN (Local Area Network)** — a network in one location (your home/office).
- **WAN (Wide Area Network)** — a network spanning large distances (the internet is the biggest WAN).
- **WLAN (Wireless LAN)** — a LAN that uses Wi-Fi.
- **PAN (Personal Area Network)** — very short range, around one person (Bluetooth earbuds).
- **SAN (Storage Area Network)** — a specialized high-speed network dedicated to storage.
- **MAN (Metropolitan Area Network)** — city-sized network (often Metro Ethernet).
- **Internet connection types** — satellite (rain fade, higher latency), fiber (fastest), cable (DOCSIS), DSL (phone lines), cellular (3G/4G/5G), WISP (wireless ISP).
- **Tethering vs hotspot** — a phone sharing data with one device vs. several.

### Security / remote access

- **VPN (Virtual Private Network)** — an encrypted tunnel that securely connects you to a remote network over the internet (this repo uses Tailscale).
- **VLAN (Virtual LAN)** — a way to logically split one physical switch/network into separate segments; each VLAN is its own broadcast domain.
- **Broadcast domain** — the set of devices that receive each other's broadcast traffic.
- **VPN concentrator** — the device (often a firewall) that encrypts/decrypts VPN traffic.
- **Client-to-site VPN** — one remote user tunnels into a network (work-from-home).
- **Site-to-site VPN** — two whole locations linked over the internet via their firewalls.

### Tools

- **ping** — tests whether another device is reachable and how long a round trip takes.
- **ip / ipconfig / ifconfig** — show a device's network configuration (its IP, etc.).
- **ss / netstat** — show which ports are open/listening on a machine.
- **Wi-Fi analyzer** — a tool that shows nearby wireless networks, channels, and signal strength.
- **Cable tester** — verifies a network cable is wired correctly and carries a signal.
- **Tone generator & probe** — used to trace/identify a specific cable in a bundle.
- **Loopback plug** — a connector that loops output back to input to test a port.
- **Punch-down tool** — pushes wires into a patch panel or keystone jack.
- **Crimper** — attaches a connector (like RJ45) onto the end of a cable.
- **Cable stripper** — removes the outer jacket to expose the wires.
- **dig / nslookup** — commands to query DNS directly (Linux/macOS / Windows).

---

## Week 2 — Hardware Part 1

_Terms added when you reach Week 2._

## Week 3 — Hardware Part 2 + Virtualization & Cloud

_Terms added when you reach Week 3._

## Week 4 — Troubleshooting + Mobile

_Terms added when you reach Week 4._
