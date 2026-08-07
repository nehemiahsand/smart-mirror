# Week 1 Quiz — Networking

**Instructions:** Answer all 37 questions without looking at your notes. Write your answers (A/B/C/D or short text) on paper or in a scratch file. When finished, grade yourself with [11-quiz-answer-key.md](11-quiz-answer-key.md). Aim for 80%+ (30/37).

---

## Part A — Ports & Protocols

**1.** Which port does HTTPS use?
- A) 80
- B) 443
- C) 22
- D) 53

**2.** Which protocol provides reliable, ordered, connection-based delivery?
- A) UDP
- B) TCP
- C) DNS
- D) ICMP

**3.** SSH uses which port?
- A) 21
- B) 22
- C) 23
- D) 25

**4.** Which of these is most likely to use **UDP**?
- A) Downloading a file over FTP
- B) Loading a secure web page
- C) A live voice/VoIP call
- D) Logging in over SSH

**5.** Which port pair is used by DHCP?
- A) 53
- B) 80/443
- C) 67/68
- D) 110/143

**6.** In the smart mirror's `docker-compose.yml`, the backend is published as `"80:3001"`. What does the **80** represent?
- A) The port inside the container
- B) The outside port clients connect to
- C) The number of connections allowed
- D) The IP address

**7.** DNS primarily uses which port?
- A) 25
- B) 53
- C) 143
- D) 389

**8.** Which protocol is used for secure remote **graphical** desktop access to Windows?
- A) SSH (22)
- B) Telnet (23)
- C) RDP (3389)
- D) SMB (445)

---

## Part B — IP Addressing

**9.** Which of the following is a **private** IP address?
- A) 8.8.8.8
- B) 192.168.1.20
- C) 172.32.0.5
- D) 200.1.1.1

**10.** A device reports an IP of `169.254.15.7`. What does this most likely indicate?
- A) It has a public IP
- B) It is using IPv6
- C) DHCP failed and it self-assigned an APIPA address
- D) It is the default gateway

**11.** How many bits is an IPv4 address?
- A) 16
- B) 32
- C) 64
- D) 128

**12.** What does the **default gateway** do?
- A) Assigns IP addresses automatically
- B) Resolves names to IP addresses
- C) Is the device traffic uses to leave the local network
- D) Encrypts wireless traffic

**13.** Which describes a **static** IP address?
- A) Automatically assigned and may change
- B) Manually set and does not change
- C) Only used by IPv6
- D) Always starts with 169.254

**14.** Which are the three private IPv4 ranges? (short answer)

---

## Part C — Services, Wireless, DNS/DHCP, VPN

**15.** Which service automatically assigns IP addresses to devices?
- A) DNS
- B) DHCP
- C) SMTP
- D) LDAP

**16.** Put the DHCP process in order:
- A) Offer, Discover, Acknowledge, Request
- B) Discover, Offer, Request, Acknowledge
- C) Request, Discover, Offer, Acknowledge
- D) Discover, Request, Offer, Acknowledge

**17.** Which DNS record maps a name to an **IPv4** address?
- A) AAAA
- B) MX
- C) A
- D) CNAME

**18.** In `mosquitto/mosquitto.conf`, `allow_anonymous false` enforces which concept?
- A) Encryption
- B) Authentication (credentials required)
- C) Load balancing
- D) DNS resolution

**19.** What does a **VPN** provide?
- A) An encrypted tunnel to securely reach a remote network
- B) Automatic IP assignment
- C) Name resolution
- D) A faster Wi-Fi channel

**20.** Which Wi-Fi band generally offers **faster speeds but shorter range**?
- A) 2.4 GHz
- B) 5 GHz
- C) They are identical
- D) Neither; Wi-Fi has one band

**21.** In this repo, which device is best described as an **IoT device**?
- A) The Raspberry Pi backend
- B) The mosquitto broker
- C) The ESP32 console
- D) Your laptop

---

## Part D — Devices, Types, Tools

**22.** Which device connects **different** networks and routes traffic between them?
- A) Switch
- B) Router
- C) Access point
- D) Patch panel

**23.** Your home network with Wi-Fi is best classified as a:
- A) WAN
- B) SAN
- C) WLAN
- D) PAN

**24.** You need to identify one specific cable within a large bundle. Which tool?
- A) Crimper
- B) Loopback plug
- C) Tone generator and probe
- D) Wi-Fi analyzer

**25.** Which command shows the Pi's default gateway (your router's address)?
- A) `ping`
- B) `ip route`
- C) `curl`
- D) `hostname`

---

## Part E — Verification additions (transcript/objective coverage)

**26.** Which range describes **ephemeral** (temporary, client-side) ports?
- A) 0-1023
- B) 1024-65535
- C) 0-255
- D) 1-1000

**27.** Which ports are associated with the older Windows **NetBIOS** name/session service?
- A) 137-139
- B) 20/21
- C) 443
- D) 3389

**28.** Short answer, two parts: (a) Are port numbers a security mechanism? (b) Is TCP port 80 the same thing as UDP port 80?

**29.** Which service keeps device clocks accurate (important for log correlation and encryption)?
- A) DNS
- B) NTP
- C) DHCP
- D) SMTP

**30.** In an AAA authentication server, what does "AAA" stand for?
- A) Access, Auditing, Authorization
- B) Authentication, Authorization, Accounting
- C) Address, Allocation, Assignment
- D) Authentication, Access, Auditing

**31.** A single edge device that combines firewall, IPS, URL filtering, spam filtering, and VPN is a:
- A) Load balancer
- B) Proxy server
- C) UTM (all-in-one security appliance)
- D) Unmanaged switch

**32.** On a DHCP server, what is the purpose of an **exclusion**?
- A) To permanently assign an address to a device by its MAC
- B) To keep certain addresses in the scope from being handed out (e.g., a router/printer with a static IP)
- C) To encrypt DHCP traffic
- D) To extend the lease duration

**33.** A remote employee's laptop tunnels into the corporate network from home. Which VPN type is this?
- A) Site-to-site
- B) Client-to-site
- C) VLAN
- D) Proxy

**34.** Which switch supports VLANs, SNMP management, and port mirroring?
- A) Unmanaged switch
- B) Managed switch
- C) Access point
- D) Patch panel

**35.** The **802.11ax** standard is also known by which friendly name, and which band did 6E/7 add?
- A) Wi-Fi 5; 2.4 GHz
- B) Wi-Fi 6; 6 GHz
- C) Wi-Fi 4; 5 GHz
- D) Wi-Fi 7; 900 MHz

**36.** A customer in a rural area with no cable or phone lines gets internet via an antenna to a local wireless provider. This connection type is a:
- A) DSL connection
- B) Cable/DOCSIS connection
- C) WISP (Wireless Internet Service Provider)
- D) Fiber/ONT connection

**37.** Which tool removes the outer jacket of a cable to expose the wires inside?
- A) Crimper
- B) Cable stripper
- C) Punch-down tool
- D) Loopback plug

---

## Mini self-check recall (from the daily lessons)

Also answer these short ones (not graded as part of the 25, but good practice):

- Day 1: In `http://192.168.1.50:3000`, name the IP, port, and protocol.
- Day 2: Static vs dynamic IP — one-line difference.
- Day 3: Name a web server and an IoT device in this repo.
- Day 4: The four DHCP steps and their memory word.
- Day 5: Router vs switch — one-line difference.

When done, open [11-quiz-answer-key.md](11-quiz-answer-key.md).
