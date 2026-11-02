# Switch highlight teams from the console

On the awake Sports screen, press **button 5**. Its label shows the destination:

- `To Auburn` while viewing GSW highlights.
- `To GSW` while viewing Auburn highlights.

The team preference is saved, the latest game is selected, and video mode is restored. If a live tracker is showing, an explicit team switch returns to highlights using the existing temporary highlights override. Automatic live-game enablement and priority are unchanged.

Buttons 1–4 retain page navigation, game navigation, and Video/Box or live/highlights control. Button 5 still opens Stats from other pages and standby, and still closes the Stats overlay. A generic Back action without the physical button identifier retains its Stats behavior.

The existing console firmware already sends the required button identifier and reads dynamic labels. No flash or device-protocol change is needed. Saved settings are broadcast to the PWA; an open Edit form follows them when clean and retains unsaved local edits when dirty. Rapid switches are serialized; a failed preference write does not claim success or reset the current game.
