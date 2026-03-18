## Utility Assessment

AI assistance was valuable for getting a broad, integrated codebase working quickly across backend, frontend, Python sidecars, Docker, and ESP32 firmware. The current repo shows that speed clearly: one project now spans a secured backend, a display app, a served PWA, camera and sensor sidecars, and an MQTT-driven ESP32 console.

The main downside was consistency. The hardest problems were not the initial implementations, but the follow-through:

- aligning behavior across services
- keeping security fixes intact while features changed
- validating hardware behavior instead of assuming software was at fault
- keeping documentation current as the architecture evolved

## Learning Outcomes

The most instructive technical issue was the ESP32 button-5 failure. The software path for the stats overlay worked, but the original hardware choice of `GPIO34` was wrong for a reliable button because it has no internal pull-up. That made a hardware fault look like an application bug. Moving button 5 to `GPIO23` fixed the real issue.

The most valuable lesson from AI-assisted development in this project is that precise intent and end-to-end verification matter more than raw generation speed. AI can get a large system into existence quickly, but correctness still depends on clear constraints, real hardware tests, and disciplined cleanup of stale assumptions in both code and docs.
