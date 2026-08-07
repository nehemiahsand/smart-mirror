# My Notes — Section 1: Mobile Devices (CompTIA A+ 220-1201)

> My own notes from Professor Messer's videos. Exam Domain 1.0 (13%). Formally reviewed in Week 4, Day 4.

---

## 1.1 — Laptop Hardware

### Battery

- Two different types of batteries:
  - Lithium-Ion (Li-ion)
  - Lithium-Ion polymer (LiPo)
- Modular batteries — easily replaceable

### Keyboard (most used component)

- Can be easy to replace
- Connected using a ribbon cable
- Test using external USB keyboard

### Memory (RAM, etc.)

- Small Outline Dual In-Line Memory Module (SO-DIMM)
  - Replaceable memory modules
  - Used in laptops and mobile devices
- Some laptop memory is soldered to the system board (Mac)

### Storage

- **HDD (Magnetic disk)**
  - Spinning drive platters
  - 2.5 inch form factor (3.5 for desktops)
- **SSD (Solid State Drive)**
  - No moving parts
  - Silent, fast access time, less latency
  - 2.5 inch form factor
- **SSD 2.5 vs SSD M.2**
  - 2.5 is bigger
  - M.2 is more attractive for space conservation

### Storage Migration

- Moving from HDD to SSD
- Can manually reinstall everything on the new memory but it's very time consuming
- Better to use imaging/cloning software
- Partition everything onto external storage, or some tools let you do both at the same time

### 802.11 Wireless and Bluetooth

- Mini PCI or Mini PCI Express
  - Connect to computer antennas
- Wireless network connectivity often integrated into motherboard
- **802.11**
  - Local Area Network (LAN)
  - High speed
  - Internet access
- **Bluetooth**
  - Personal Area Network (PAN)
  - Short range
  - Nearby devices

### Wi-Fi Antennas

- Types of antennas: Wi-Fi main and aux, Bluetooth
- Antennas wrap around laptop screen

### Biometrics

- Fingerprint or Face ID
- Must have a compatible OS to use the hardware
- Relatively secure

### Near Field Communication (NFC)

- Apple Pay and Google Pay
- Short distance networking
- Uses: data transfer, authentication, hospitals, warehouses, manufacturing

### Camera/Webcam

- Video capture
- Usually includes both mics and video

---

## 1.2 — Connecting Mobile Devices

Phones and tablets — many different ways to connect.

### Universal Serial Bus (USB)

- Types:
  - Micro B plug
  - Mini B plug
  - Type A plug
  - USB-C plug
- **USB-C**
  - 24-pin double-sided USB connector
  - Different signals on same connector: DisplayPort, HDMI, Thunderbolt, USB 2.0/3.0/3.1/4.0

### Lightning (Apple)

- iPhone and iPad devices
- Double sided like USB-C
- Higher power output than Micro B plug

### NFC

- Send small amounts of data
- Payment, transportation

### Bluetooth

- Personal Area Network (PAN)
- High speed over short distances
- Connectivity: smartphones, tethering, headsets/headphones, health monitors, smartwatches, external speakers

### Hotspot / Tethering

- Phone turns into a Wi-Fi router
- **Hotspot** if multiple connections
- **Tethering** if singular connection

---

## Mobile Device Accessories

### Stylus

- Pencil or pen for your mobile device
- Often has programmable buttons

### Headsets

- Microphone and earphones
- Wired: USB, analog audio jack (3.5mm, Tip-Ring-Ring-Sleeve / TRRS connector), iPhone Lightning port
- Wireless: Bluetooth

### Speakers

- Wireless audio using Bluetooth

### Camera / Webcam

- Internal or external webcams
- Often 3rd party, connected using USB

### Docking Station

- Components all connected together: keyboard and mouse, monitors, WLAN, speakers, etc.

### Port Replicator

- Similar to a docking station
- Expanded connectivity
- More portable

### Trackpad

- Built into a laptop to replace a mouse
- Can be used with a desktop as a standalone
- Supports gestures

### Drawing Pad

- Input for a stylus
- 3rd party; connects to computer using wired or wireless connection

---

## 1.3 — Mobile Device Networks

### Cellular Networks

- Antennas are separated into "cells" that cover an area
- Cellular can be talk and data, or just talk

### 3G Technology

- Introduced in 1998
- New functionality: GPS, mobile television, video on demand

### 4G and LTE

- Long Term Evolution (LTE) — a "4G" technology
- Based on GSM (Global System for Mobile Communications) and EDGE (Enhanced Data Rates for GSM Evolution)
- Download rates of 150 Mbit/s

### 5G

- Launched in 2020
- Download rates of 10 GB per second

### Wi-Fi

- Connect to a local 802.11 network
- Data access for email and internet

### Hotspot

- Turn phone into a Wi-Fi hotspot

### Subscriber Identity Module (SIM)

- A unique identifier for cellular devices
- Contains information for the carrier and user: SIM ID and phone number, cellular network info, storage space for contacts, messages, etc.
- Most phones now use **eSIM** (embedded SIM)

### Bluetooth Pairing

- Built-in security
- Use or verify a PIN

### GPS (Global Positioning System)

- Created by the U.S. Department of Defense
- Precise navigation (needs at least 4 satellites)
- Device location is based off of: GPS, Wi-Fi, cellular towers

---

## Mobile Device Management (MDM)

### MDM

- Manage company-owned and user-owned mobile devices
- BYOD (bring your own device)
- Centralized management of the devices:
  - Set policies on apps, data, camera, etc.
  - Control the device remotely
  - Partition part of a user-owned phone to house company data
  - Manage access control with passwords

### BYOD

- Bring your own device
- Employee owns the device
- Must meet company requirements
- Difficult to secure

### COPE

- Corporate Owned, Personally Enabled
- Company buys the device
- Company has full control of the device
- Information is protected by company policy

### MDM Policy Enforcement

- Corporate configurations that get pushed to all attached devices
- Two-factor authentication

### Mobile Device Synchronization

- Synchronizing what type of email is used, to make sure the whole company uses the same one
- Data to synchronize: calendar, contacts

### Business Application

- Mail, cloud storage, etc.
- Authenticate: username, password