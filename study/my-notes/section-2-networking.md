# My Notes — Section 2: Networking (CompTIA A+ 220-1201)

> My own notes from Professor Messer's videos. Exam Domain 2.0 (23%). Matches the Week 1 lessons.

---

## 2.1 — Introduction to IP

### A series of moving vans (the analogy)
- Efficiently move large amounts of data
- The network topology is the road: Ethernet, DSL, cable system
- The truck is the Internet Protocol (IP)
- The boxes hold your data: boxes of TCP and UDP
- Inside the boxes are more things: application info

### IP
- CLIENT -> Ethernet Header -> Ethernet Payload -> Ethernet Footer -> SERVER

### TCP and UDP
- Transported inside of IP (encapsulated)
- Two ways to move data from place to place
- OSI Layer 4 — Transport layer
- **Multiplexing**: use many different applications at the same time (TCP and UDP)

### TCP — Transmission Control Protocol
- CLIENT <–> SERVER
- Connection-oriented: setup and teardown for connection
- "Reliable" delivery: both sides acknowledge receipt of data; allows error recovery
- Flow control: receiver can manage how much data is sent

### UDP — User Datagram Protocol
- CLIENT –> SERVER (and –> SERVER)
- Connectionless: no formal setup and teardown
- "Unreliable" delivery: no error recovery
- No flow control: sender decides amount of data transferred

### Why UDP?
- Real-time communication
- Very little overhead
- No way to stop
- Connectionless protocols:
  - DHCP (Dynamic Host Configuration Protocol)
  - TFTP (Trivial File Transfer Protocol)
- The data might not get through — the application keeps track and decides whether to send again or not (it might decide to do nothing)

### Communicating using TCP
- Connection-oriented protocols prefer a "return receipt":
  - HTTPS (Hypertext Transfer Protocol Secure)
  - SSH (Secure Shell)
- The application doesn't worry about out-of-order frames or missing data
- TCP does all of the error handling, so the application is free to do one job

### Speedy Delivery (ports)
- The IP delivery truck delivers from one IP address to another IP address
- Boxes arrive at the IP address
- Each box has a room name (files, etc.) — each room is a port
- Each box has the port number written on it

### Lots of ports
- IPv4 sockets:
  - Server: IP address, protocol, server application port number
  - Client: IP address, protocol, client port number
- **Non-ephemeral ports** — permanent port numbers
  - Ports 0 – 1,023
  - Usually on a server or service
- **Ephemeral ports** — temporary port numbers
  - Ports 1,024 – 65,535
  - Determined (allocated) in real time by the client

### Port Numbers
- TCP and UDP ports can be any number between 0 – 65,535
- Most servers (services) use non-ephemeral (non-temporary) port numbers — but not always
- Port numbers are used for communication NOT security
- Service port numbers need to be "well known"
- TCP port numbers aren't the same as UDP port numbers — each has its own set from 0 – 65,535

### Example
- Web server — tcp/80
- VoIP (Voice Over IP) server — udp/5004
- Email server — tcp/143
- Client IP address — 10.0.0.1
- Server IP address — 10.0.0.2

---

## Coming next in my notes
Add 2.6 (IPv4/IPv6, Assigning IP Addresses), 2.3 (Network Services), 2.2/2.4 (Wireless, DNS, DHCP, VPN), and 2.5/2.7/2.8 (Devices, Types, Tools) here as I watch them.
