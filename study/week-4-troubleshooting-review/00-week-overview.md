# Week 4 — Troubleshooting + Mobile Review + Practice Exams (Domains 5.0 + 1.0)

> Status: **Scaffolded.** Full daily lessons, labs, quiz, and practice-exam guidance are written when you reach this week. This README shows the plan.

The final week ties everything together. Troubleshooting is the **biggest domain (28%)** and it builds on Weeks 1-3. We also circle back to Mobile Devices (13%) for a refresher, then finish with full practice exams so you walk into the test confident.

---

## Planned checklist

- **Day 1** — Troubleshooting Hardware + the 6-step method (Messer 5.1)
- **Day 2** — Troubleshooting Storage & Displays (Messer 5.2, 5.3)
- **Day 3** — Troubleshooting Networks (Messer 5.5)
- **Day 4** — Mobile Devices review + Troubleshooting Mobile (Messer 1.1-1.3 recap, 5.4)
- **Day 5** — Full Core 1 review (all five domains)
- **Day 6** — LAB: break/diagnose/fix the smart mirror + Practice Exam #1
- **Day 7** — Practice Exam #2 + weak-area cleanup + readiness check

---

## Planned topics -> repo anchors


| Day | Exam topics                                          | Smart-mirror anchor                                                     |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | POST, BSoD, no power, overheating; the 6-step method | Applying the method to the mirror; `01-exam-overview.md`                |
| 2   | Drive failures, S.M.A.R.T., display issues           | `/api/system/info` (disk), display standby logic                        |
| 3   | No connectivity, latency, DNS/DHCP failures, APIPA   | `/api/health`, `/api/wifi/status`, `ping`, `docker compose logs`        |
| 4   | Battery, charging, screen, connectivity on mobile    | Mobile Devices domain recap (Week 1's starting videos)                  |
| 5   | Everything                                           | The whole `study/` folder + master glossary                             |
| 6   | Real diagnosis                                       | `docker compose logs <service>`, health endpoints, `backend/__tests__/` |


---

## The centerpiece lab (Day 6): safe break-fix

Using the **6-step troubleshooting method**, you will practice diagnosing realistic mirror problems (e.g., "the display shows nothing," "the ESP32 buttons do nothing," "the PWA won't load") by reading logs and health endpoints — then reasoning about the cause. All exercises are safe/reversible and clearly scripted.

Diagnostic tools you will use:

```bash
docker compose ps
docker compose logs --tail=100 backend
curl http://localhost/api/health
curl http://localhost/api/camera/status
curl http://localhost/api/wifi/status
```

---

## Practice exams

- Use Professor Messer's free 220-1201 practice exams: [https://professormesser.link/1201exams](https://professormesser.link/1201exams)
- Consider his practice exam PDFs / the study group recordings for extra PBQ practice.
- Target: consistently **85%+** before booking the real exam.

---

## Learning goals (preview)

By the end of Week 4 you will be able to apply the 6-step troubleshooting method to real problems, diagnose common hardware/network/mobile failures, read logs and health checks to find root causes, and score 85%+ on practice exams.

---

When you arrive, say "start Week 4" to have the daily files, quiz, answer key, and vocab written.