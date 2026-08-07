# Week 1 · Day 7 — Review Day

`Day 7 of 7` · [← Day 6](06-day-6-lab-trace-a-request.md) · [Week overview](00-week-overview.md) · [Quiz](10-quiz.md) · [Answer key](11-quiz-answer-key.md)

---

No new material today. You will (1) drill the common ports, (2) run a quick recall check, and (3) take the Week 1 quiz. This is where the week's learning locks in.

---

## Part 1 — Common ports drill (~10 min)

Cover the right column and try to fill it in from memory. Then check yourself.

| Port | Protocol |
|------|----------|
| 20 / 21 | FTP |
| 22 | SSH |
| 23 | Telnet |
| 25 | SMTP |
| 53 | DNS |
| 67 / 68 | DHCP |
| 80 | HTTP |
| 110 | POP3 |
| 143 | IMAP |
| 443 | HTTPS |
| 445 | SMB |
| 389 / 636 | LDAP / LDAPS |
| 3389 | RDP |

Now reverse it — cover the **left** column and recall the port from the protocol name. Do this twice. A few memory hooks:

- **22 SSH** — "SSH is 22, two little s's."
- **80 HTTP / 443 HTTPS** — the web pair; 443 adds the "S" for Secure.
- **53 DNS** — "DNS phones home at 53."
- **3389 RDP** — Remote Desktop, the biggest number here.

---

## Part 2 — Rapid recall (say the answers out loud, ~5 min)

1. IP address vs port — what does each one identify?
2. TCP vs UDP — one reliable, one fast: which is which?
3. Private IP ranges — name all three.
4. `169.254.x.x` means what?
5. DHCP steps — the four-letter word?
6. Router vs switch — the one-line difference?
7. LAN vs WAN — which is your home, which is the internet?
8. VPN — what does it create?

If any of these are shaky, reread that day's lesson before the quiz.

---

## Part 3 — Repo recall (connect concepts to the project, ~5 min)

Without looking, answer:

1. Which file shows the smart mirror's published ports?
2. Which port is the MQTT broker on, and what config line blocks anonymous connections?
3. Which endpoint tells you the Pi's current IP/Wi-Fi?
4. Which device in this repo is the "IoT device," and what protocol does it use to talk to the broker?
5. In `"80:3001"`, which number do phones/browsers connect to?

---

## Part 4 — Take the quiz (~20 min)

Open [10-quiz.md](10-quiz.md). Answer all questions **without** looking at your notes (test conditions). When finished, and only then, open [11-quiz-answer-key.md](11-quiz-answer-key.md) to grade yourself.

- Record your score in [../02-progress-tracker.md](../02-progress-tracker.md).
- **Below 80%?** Reread the lessons for the topics you missed, then retake the quiz tomorrow. That is not falling behind — that is exactly how you pass.
- **80% or above?** You are ready for Week 2. Nice work.

---

## Part 5 — Update your glossary

Open [09-vocab-answer-key.md](09-vocab-answer-key.md) and re-read the Week 1 terms one more time. Star any that still feel unclear so you can revisit them during Week 4's full review.

---

## Done?

Check off Day 7 and record your quiz score in [../02-progress-tracker.md](../02-progress-tracker.md).

**Week 1 complete.** Tell your teacher **"start Week 2"** and the next week gets built out → [../week-2-hardware-1/](../week-2-hardware-1/)
