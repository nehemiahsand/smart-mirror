# Week 3 — Hardware Part 2 + Virtualization & Cloud (Domains 3.0 + 4.0, 11%)

> Status: **Scaffolded.** Full daily lessons, labs, quiz, and vocab are written when you reach this week. This README shows the plan.

This week finishes Hardware (motherboards, CPUs, power, printers) and then covers all of Virtualization & Cloud (11% of the exam) — which is where this project's Docker setup becomes a perfect teaching tool.

---

## Planned checklist

- **Day 1** — Motherboards, BIOS/UEFI, TPM (Messer 3.5: "Motherboard Form Factors", "Expansion Slots", "Connections", "Compatibility", "The BIOS", "BIOS Settings", "HSM and TPM")
- **Day 2** — CPU features, expansion cards, cooling (Messer 3.5: "CPU Features", "Expansion Cards", "Cooling")
- **Day 3** — Power + Printers overview (Messer 3.6 "Computer Power"; 3.7 "Multifunction Devices"; 3.8 printer types)
- **Day 4** — Virtualization (Messer 4.1: "Virtualization Concepts", "Virtualization Services")
- **Day 5** — Cloud Computing (Messer 4.2: "Cloud Models", "Cloud Characteristics")
- **Day 6** — LAB: explore the Docker containers as "virtualization" in this repo
- **Day 7** — Review + Week 3 Quiz

---

## Planned topics -> repo anchors


| Day | Exam topics                                  | Smart-mirror anchor                                                              |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | ATX/mATX/ITX, PCIe, BIOS/UEFI, TPM           | Pi 5 board (no BIOS in the PC sense — great compare/contrast); ARM vs x86        |
| 2   | 32/64-bit, ARM, cores, cooling               | Pi 5 CPU + thermal: `backend/src/services/console.js` reads `/sys/class/thermal` |
| 3   | Power supplies, efficiency, printer types    | Pi 5 power supply and the USB SSD/camera peripheral load                         |
| 4   | Hypervisors type 1/2, containers, sandboxing | The whole `docker-compose.yml` = 4 containers; Dockerfiles = images              |
| 5   | IaaS/PaaS/SaaS, public/private, elasticity   | External cloud APIs (weather/Spotify/calendar) in `backend/.env.example`         |


**Key teaching point for Week 4:** a **container** (Docker) is not the same as a full **virtual machine** — this repo lets you see real containers, images, ports, and volumes to make that distinction concrete.

---

## Learning goals (preview)

By the end of Week 3 you will be able to describe motherboard form factors, explain what BIOS/UEFI and TPM do, compare a virtual machine vs a container, and define the cloud service models (IaaS/PaaS/SaaS) and characteristics (elasticity, metered usage, multitenancy).

---

When you arrive, say "start Week 3" to have the daily files, quiz, answer key, and vocab written.
