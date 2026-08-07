# CompTIA A+ Core 1 (220-1201) Study Program

A beginner-friendly, 4-week study program. It assumes **you have little or no prior IT experience**, so every lesson starts from scratch and builds up slowly. You will learn the exam content and practice it using the real smart-mirror system in this repository.

---

## How to study (you don't need to read this file again)

**Open the week folder and go down the list in order.** Files are numbered, so the folder itself is your syllabus. Every lesson links to the next one, plus its vocab file — no index required.

Right now that means: **[week-1-networking/](week-1-networking/)** → open `01-day-1-...`, then `02-day-2-...`, and so on.

Lost your place? Open **[02-progress-tracker.md](02-progress-tracker.md)** — the first unchecked box is your next lesson, and it links straight to it.

---

## How this program works

Each **study day** is about **1 hour** and follows the same three-part rhythm:

1. **Watch (~20 min)** — the assigned Professor Messer video(s). His free 220-1201 course numbers match the official exam objectives. **You do not need to take full notes** while watching (your lesson files and Messer's Course Notes PDF already have them). Instead, each video lesson opens with a **Capture list** box — jot just 3-5 quick lines (things that confused you, surprised you, or that Messer flags as "on the exam") and bring them to the lesson and quiz.
2. **Read + Vocab (~20 min)** — read the day's lesson file here. It re-explains the topic in plain English, connects it to the smart-mirror project, and gives you a short vocab list to write down.
3. **Lab + Self-check (~20 min)** — run the hands-on lab (copy-paste commands) and answer the mini self-check at the bottom of the lesson.

Cadence: **5 study days + 2 lighter lab/review days per week.**

> New to all of this? That is completely fine. Do not worry about memorizing everything on day one. The quizzes and review days are designed to make things stick through repetition.

---

## The 4-week roadmap


| Week | Focus                                               | Exam domain(s)        | Folder                           |
| ---- | --------------------------------------------------- | --------------------- | -------------------------------- |
| 1    | Networking                                          | 2.0 (23%)             | `week-1-networking/`             |
| 2    | Hardware Part 1 (displays, cables, memory, storage) | 3.0 (part)            | `week-2-hardware-1/`             |
| 3    | Hardware Part 2 + Virtualization & Cloud            | 3.0 (part), 4.0 (11%) | `week-3-hardware-2-cloud/`       |
| 4    | Troubleshooting + Mobile review + practice exams    | 5.0 (28%), 1.0 (13%)  | `week-4-troubleshooting-review/` |


Why start with Networking? You just finished Messer video 2.1 (Introduction to IP), so you are right at the start of Networking. It is 23% of the exam, it feeds directly into Troubleshooting (the biggest domain at 28%), and it is visible everywhere in this smart-mirror project.

---

## Folder structure

Everything is numbered so that **file order = the order you do it in.**

```
study/
  00-start-here.md               you are here (read once)
  01-exam-overview.md            how the exam works (read once)
  02-progress-tracker.md         your place-keeper - open this if lost

  week-1-networking/
    00-week-overview.md          what this week covers
    01-day-1-ports-and-protocols.md      <- just start here and go down
    02-day-2-ip-addressing.md
    03-day-3-network-services.md
    04-day-4-wireless-dns-dhcp-vpn.md
    05-day-5-network-devices-types-tools.md
    06-day-6-lab-trace-a-request.md
    07-day-7-review-and-quiz.md
    08-vocab-practice.md         YOU write in this one
    09-vocab-answer-key.md       vocab answers
    10-quiz.md                   Day 7 only
    11-quiz-answer-key.md        open after the quiz

  my-notes/                      your own notes from the videos
  vocab/master-glossary.md       every term, whole month (search here)

  week-2-hardware-1/             (built when you get there)
  week-3-hardware-2-cloud/
  week-4-troubleshooting-review/
```

Why two vocab files: `08-vocab-practice.md` is **yours to write in**; `09-vocab-answer-key.md` is the **answer key** used to grade it.

---

## Before you start each lab

Some labs run on the **Raspberry Pi** (the mirror), some on your **laptop**, and some on the **ESP32**. Each lab says clearly where to run it. Labs are **read-only and safe by default**. Anything that could reboot the Pi or change Wi-Fi is clearly marked **ADVANCED / OPTIONAL** — skip those if you are unsure.

To find your Pi's IP address (used a lot in labs), you can run this **on the Pi**:

```bash
hostname -I
```

The first address it prints (often something like `192.168.x.x`) is your `<pi-ip>`. Write it down.

---

## External resources

- Professor Messer 220-1201 video index: [https://professormesser.link/1201videos](https://professormesser.link/1201videos)
- Professor Messer 220-1201 course notes (PDF): [https://professormesser.link/1201notes](https://professormesser.link/1201notes)
- Professor Messer 220-1201 practice exams: [https://professormesser.link/1201exams](https://professormesser.link/1201exams)
- Your official exam objectives PDF: `CompTIA A+ 220-1201 Exam Objectives (4.0).pdf`

---

## How to track progress

Open [02-progress-tracker.md](02-progress-tracker.md) and check a box every time you finish a day. Seeing the list fill up is motivating, and it tells you exactly where to pick up next time.

---

## Build procedure for future weeks (for the AI teacher)

> This section is the repeatable recipe used to build each week (it is how Week 1 was verified and patched). When the learner says **"start Week N,"** follow these steps so every week is grounded in the same authoritative sources and matches the agreed presentation style. The learner does not need to read this section; it is a checklist for whoever (human or AI) fills in a scaffolded week.

### Step 1 — Gather the authoritative sources (always all three)

1. **Official exam objectives (source of truth for what is testable).**
   - PDF: `CompTIA A+ 220-1201 Exam Objectives (4.0).pdf` (in the user's Downloads).
   - Plain-text extract already in this repo: `tmp/pdfs/objectives_extract.txt` (search it for the domain, e.g., `3.1`, `3.2`). Use the exact bulleted sub-terms as the coverage checklist.
   - Also mine the **Acronym List** (pages 14-17 of the extract) for terms in that domain.
2. **Professor Messer's ACTUAL video transcripts (source for teaching + emphasis).**
   - Get the video list/slugs from the index: https://professormesser.link/1201videos
   - Fetch each relevant video page directly (WebFetch) at `https://www.professormesser.com/free-a-plus-training/220-1201/220-1201-video/<slug>-220-1201/`. Messer posts the full transcript below the player.
   - **Use the real fetched transcript text — never rely on memory.** If a page fails or has no transcript, say so and try the YouTube watch-page transcript. Quote specifics that actually appear (exact numbers, ranges, mnemonics, phrasing).
3. **The smart-mirror repo (source for hands-on labs).**
   - Find concrete anchors for the week's topics (files, configs, commands, endpoints). See each scaffolded week's README "topics -> repo anchors" table for a starting map.

### Step 2 — Verify coverage (objectives x transcripts x current draft)

- Build a gap list: every objective sub-term must appear somewhere in the week's lessons; every "on the exam" emphasis Messer makes should be reflected.
- Add genuinely missing testable items; do not pad with non-testable trivia.

### Step 3 — Write the week to the agreed presentation style

- **Even ~20/20/20 split** per study day: Watch -> Read+Vocab -> Lab+Self-check.
- **Layered depth:** a concise beginner-friendly core, with deeper detail behind an optional **"Go deeper (optional)"** block the learner can skip.
- **Quick checks throughout:** short inline **Quick check** prompts inside lessons, not only at the end.
- **High-value extras only:** include Messer's best analogies and his explicit exam-emphasis flags; skip filler stories.
- **Soft time cap:** aim ~1 hr/day; 60-90 min is fine on heavy days (split a day if needed).
- Every video lesson starts with the standard **Capture list** box (see "How this program works").
- Ground each lab in a real repo file/command, mark anything risky **ADVANCED / OPTIONAL**.

### Step 4 — Produce the standard files for the week folder

Use the **same numbered naming as Week 1** so folder order equals study order:

- `00-week-overview.md` (week overview + checklist with links + learning goals + repo-anchor table)
- `01-day-1-*.md` ... `05-day-5-*.md` (study days), `06-day-6-*.md` (lab day), `07-day-7-review-and-quiz.md`
- `08-vocab-practice.md` (blank fill-in for the learner; add sections day by day, not all at once, to avoid overwhelm)
- `09-vocab-answer-key.md`
- `10-quiz.md` and a **separate** `11-quiz-answer-key.md` (answers only in the key)

Every day file must open with a nav line (`Day X of 7` + prev/overview/vocab/next links) and close with a "Done?" block linking to the vocab practice, the progress tracker, and the next day.
- Update the shared `vocab/master-glossary.md` (add the week's terms) and `02-progress-tracker.md` (link each day file) if any topic/day names changed.
- Ensure the quiz tests the newly added must-know items so it stays aligned with the lessons.

### Step 5 — Report back

- Give a short coverage note: which objective sub-terms and transcript emphases were added, and confirm all transcripts were actually fetched (flag any that could not be).