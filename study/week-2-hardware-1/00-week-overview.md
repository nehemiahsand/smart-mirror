# Week 2 — Hardware Part 1 (Exam Domain 3.0, part of 25%)

> Status: **Scaffolded.** The full daily lessons, labs, quiz, and vocab will be written when you reach this week (paced to your progress). This README lays out exactly what is coming so the whole month is visible now.

Hardware is 25% of the exam — the second-biggest domain. We split it across Weeks 2 and 3. This week covers the things you can see and touch first: displays, cables and connectors, memory, and storage.

---

## Planned checklist

- **Day 1** — Displays (Messer 3.1: "Display Types", "Display Attributes")
- **Day 2** — Cables & Connectors: video + peripheral (Messer 3.2: "Video Cables", "Peripheral Cables")
- **Day 3** — Cables & Connectors: network + copper/fiber (Messer 3.2: "Network Cables", "568A/568B Colors", "Copper Connectors", "Fiber Connectors", "Adapters")
- **Day 4** — Memory / RAM (Messer 3.3: "An Overview of Memory", "Memory Technologies")
- **Day 5** — Storage Devices + RAID (Messer 3.4: "Storage Devices", "RAID")
- **Day 6** — LAB: HDMI/display control + USB power on the Pi
- **Day 7** — Review + Week 2 Quiz

---

## Planned topics -> repo anchors


| Day | Exam topics                                               | Smart-mirror anchor                                                                                      |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | LCD/OLED/Mini-LED, touchscreens, resolution, refresh rate | Mirror's HDMI display; OLED on the ESP32 (SSD1306); `backend/src/services/display.js` (HDMI/DRM control) |
| 2   | HDMI, DisplayPort, USB, USB-C, Thunderbolt                | HDMI to the mirror; USB camera/mic; `README.md` hardware section                                         |
| 3   | Twisted pair, T568A/B, RJ45, fiber, adapters              | Ethernet concepts vs the Pi's Wi-Fi; adapters for the display                                            |
| 4   | RAM, DIMM/SO-DIMM, DDR3/4/5, ECC, channels                | `curl /api/system/info` shows memory; Pi RAM                                                             |
| 5   | HDD/SSD, NVMe, M.2, flash, RAID 0/1/5/6/10                | Pi microSD/USB storage; `/api/system/info` disk usage                                                    |


---

## Learning goals (preview)

By the end of Week 2 you will be able to identify common cables/connectors on sight, explain the difference between HDD and SSD, read RAM specifications, and describe the common RAID levels and what each protects against.

---

When you get here, tell your teacher **"start Week 2"** and this folder gets the same numbered layout as Week 1: `01-day-1-*.md` through `07-day-7-review-and-quiz.md`, plus `08-vocab-practice.md`, `09-vocab-answer-key.md`, `10-quiz.md`, and `11-quiz-answer-key.md`.