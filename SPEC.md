# SPEC — Timer

Source: the brief "ТЗ · Timer" (no Figma link). Brief sentences are quoted as `[Brief: "..."]`. Anything not quoted is a proposed default and is listed in **Open questions**.

## Overview

A single-screen stopwatch-style timer, built as an **app/page** (Vite + React + TypeScript), not a Storybook component. It shows elapsed time as `mm:ss` and has three buttons: Start, Pause, Reset. `[Brief: "one screen: a large time mm:ss in the centre"]`, `[Brief: "responsive (looks fine on a phone), clean, no extra functionality"]`.

The timer counts **up** from 00:00. The brief says "Start / Pause / Reset" and "idle (00:00)", and it never mentions a target time. Count-down is therefore out of scope.

## Screen layout

- **R1** One screen, no routing, no other pages. `[Brief: "one screen"]`
- **R2** The time (`mm:ss`) is the largest element and is centred horizontally and vertically in the viewport. `[Brief: "a large time mm:ss in the centre"]`
- **R3** The three buttons sit in one row directly below the time, in the order **Start, Pause, Reset**. They are always rendered (never removed from the DOM) so the layout never shifts between states. `[Brief: "buttons Start / Pause / Reset"]`
- **R4** The page is `min-height: 100dvh`, not a fixed height, so content is never clipped in landscape or at large zoom. It has 16px side padding and no horizontal scroll at any width ≥ 320px.
- **R5** The time uses tabular (monospaced) digits so the text does not jitter every second. Its font size is fluid (`clamp(...)`), around 3rem at 320px up to about 8rem on desktop.
- **R6** Each button has a touch target of at least 44×44 px. At 320px the three buttons share the row equally (about 90px wide each). Fallback: if a larger text size forces it, they may wrap to a second row instead of overflowing.
- **R7** Document: `<html lang="en">`, `<title>Timer</title>` (static; not updated per second), and `<meta name="viewport" content="width=device-width, initial-scale=1">`.

## States

State machine, with exactly three states `[Brief: "states: idle (00:00) -> running -> paused"]`:

```
idle --Start--> running --Pause--> paused
  ^                |                 |
  |                +-------Reset-----+ (Reset from running or paused -> idle)
  +---------------------------------+
paused --Start--> running   (resume; elapsed time is kept)
```

**R8** Display and button availability per state:

| State | Time shown | Start | Pause | Reset |
|---|---|---|---|---|
| idle | `00:00` | enabled | disabled | disabled |
| running | live elapsed | disabled | enabled | enabled |
| paused | frozen elapsed (stays on screen) | enabled (resumes) | disabled | enabled |

No button is ever hidden; unavailable buttons are disabled instead (R3). `[Brief: "no extra functionality"]`

**R9** Interaction states for every button. Each is marked "specified" or "not applicable":

| State | Start / Pause / Reset |
|---|---|
| default | specified. A clearly visible filled or outlined button with a text label |
| hover | specified, enabled buttons only, inside `@media (hover: hover)`. A slight tone change |
| focus-visible | specified. 2px+ outline, offset 2px, at least 3:1 contrast against the adjacent colours (R39). Never `outline: none` without a replacement |
| active / pressed | specified, enabled buttons only. A slightly darker tone. No scale or bounce animation |
| disabled | specified (R8). Native `disabled` attribute, muted style, no hover or active effect, `cursor: not-allowed` |
| loading | not applicable (no async work) |
| empty | not applicable. The `00:00` idle state is the "empty" state |
| error | not applicable (no input, no network, nothing can fail) |

**R10** The time element has no interaction states (it is not interactive). It has only three content states, per R8.

## Behaviour

Timekeeping model, which the builder must follow:

- **R11** Elapsed time is derived from timestamps, **never from counting ticks**. State holds `accumulatedMs` (time banked from earlier running periods) and `runStart` (a timestamp, set only while running). While running, `elapsedMs = accumulatedMs + (now - runStart)`. `[Brief: "idle (00:00) -> running -> paused"]`; the drift requirement comes from the lead's instruction.
- **R12** The visible time is `floor(elapsedMs / 1000)` formatted as `mm:ss`. The UI refreshes via a repeating timer of at most 250 ms (or `requestAnimationFrame`) that only **re-renders** the derived value. A late, skipped or throttled tick must never change the result, only delay the repaint.
- **R13** `accumulatedMs` is kept in **milliseconds**, never rounded to whole seconds on Pause. Otherwise repeated Pause/Start cycles would lose or gain time.
- **R14** At most one repeating timer exists at any moment. It is created on entering running and cleared on leaving running (pause or reset) and on unmount. This includes React StrictMode's double mount in dev.

Actions, in order:

- **R15 Start from idle**: `accumulatedMs = 0`, `runStart = now`, state becomes running. The time goes `00:00` → `00:01` after about one second. Focus moves to Pause (R37).
- **R16 Pause (while running)**: `accumulatedMs += now - runStart`, `runStart` is cleared, the repeating timer is stopped, state becomes paused. The time freezes at the paused value. Focus moves to Start.
- **R17 Start from paused (resume, not restart)**: `runStart = now`, state becomes running. `accumulatedMs` is kept, so counting continues from the frozen value, including its sub-second remainder. Focus moves to Pause.
- **R18 Reset (while running or paused)**: the repeating timer is cleared, `accumulatedMs = 0`, `runStart` is cleared, state becomes idle, the time shows `00:00`. Focus moves to Start. After Reset, no late tick may write a non-zero time.
- **R19 Format**: `mm` is at least two digits, zero-padded. `ss` is always two digits, 00–59. Examples: `00:00`, `00:09`, `01:05`, `59:59`.

## Edge cases

- **R20 Double Start** (two quick presses, or Start while already running). The second press is a **no-op**: it does not reset `runStart`, does not create a second repeating timer, and does not double the speed. Two layers are required. (a) The Start button is `disabled` in running (R8). (b) The handler also ignores the action when the current state is not idle/paused. For two events in the same tick, before React re-renders, the guard must read the current state from a ref or use a functional update. It must not rely on a stale closure.
- **R21 Pause while idle.** The Pause button is disabled, so it cannot be activated by mouse, touch or keyboard. The handler is also a no-op if called in idle. State and time are unchanged.
- **R22 Reset while idle.** Disabled, no-op (the time is already `00:00`).
- **R23 Reset while running.** The time goes to `00:00` immediately, counting stops, state becomes idle. A following Start begins from `00:00`. See R18.
- **R24 Reset while paused.** The frozen time goes to `00:00`, state becomes idle. A following Start begins from `00:00`.
- **R25 Start after Pause is a resume.** See R17. Acceptance example: Start, wait 5s, Pause (`00:05`), wait 10s (still `00:05`), Start, wait 3s: shows `00:08`, not `00:03`.
- **R26 Minutes do not wrap at 59.** After `59:59` the next second shows `60:00`, then `60:01`, and so on. The minute field grows to 3 digits (`100:00`) as needed. Reason: the brief asks for `mm:ss` and has no hours field. Wrapping to `00:00` would silently destroy the user's measurement and look like a Reset. Showing hours (`h:mm:ss`) would add a format the brief did not ask for. The layout must fit `999:59` at 320px without overflow (R5, R32). No upper cap is implemented (see Open questions).
- **R27 Tab hidden / backgrounded / device locked.** The timer keeps running (it is not auto-paused). Browsers throttle timers in background tabs (to 1 s or even 1 min), so tick counting would lose time. The derived elapsed time (R11) stays correct. When the tab becomes visible again (`visibilitychange`), the display is recomputed and repainted immediately, without waiting for the next tick. Acceptance example: Start, hide the tab for 65s, return: the display shows `01:05` (±1s), within one repaint.
- **R28 Rapid Pause/Start/Pause toggling.** Time is never lost or gained other than the real paused intervals (R13). The state matches the last accepted action. There are no duplicate repeating timers (R14).
- **R29 Very narrow viewport (320px).** The time and all three buttons are fully visible. There is no horizontal scroll and no clipped text, up to `999:59`. Button labels stay on one line. The same holds at 200% browser zoom and at landscape phone height (the page may scroll vertically).
- **R30 Keyboard-only use.** Everything works without a pointer. See Accessibility R35–R38.
- **R31 Reload / navigation.** State is not persisted: reload returns to idle `00:00`. This is deliberate (see Out of scope).
- **R32 Large minute counts.** The font-size clamp (R5) is chosen so that 6 characters (`999:59`) fit within `100vw - 32px` at 320px.

## Accessibility

- **R33 Time exposure without per-second announcements.** The time element is `role="timer"` with `aria-live="off"` and an accessible name via `aria-label="Elapsed time"`. `role="timer"` has implicit `aria-live="off"`, so screen readers do **not** announce each tick. The text can still be read on demand, with the virtual cursor or by focusing and re-reading it. Do not put `aria-live="polite"` or `"assertive"` on the ticking element, and do not use `aria-atomic` there.
- **R34 Discrete announcements.** A separate visually hidden `role="status"` (`aria-live="polite"`) region is updated **only on user actions, never on ticks**:
  - Start from idle: "Timer started".
  - Pause: "Timer paused at {m} minutes {s} seconds".
  - Start from paused: "Timer resumed".
  - Reset: "Timer reset".

  Use plain-language durations (not `05:07`, which screen readers read ambiguously). The region is always in the DOM (empty at load) so that updates are announced reliably.
- **R35 Button labels.** Visible text is exactly "Start", "Pause", "Reset" (`<button type="button">`). The accessible name equals the visible text. Do not add an `aria-label` that differs from it (WCAG 2.5.3 Label in Name). Do not use icon-only buttons.
- **R36 Disabled semantics.** Use the native `disabled` attribute (not just a CSS class), so disabled buttons are skipped in tab order, not clickable, and exposed as disabled to assistive tech.
- **R37 Keyboard path and focus order.** Tab order follows DOM and visual order: Start → Pause → Reset. Enter and Space activate the focused button (native button behaviour, no custom key handlers). **Focus continuity:** the focused button becomes disabled after being pressed (for example Start in idle), and a disabled element drops focus to `<body>`. To prevent this, after each action focus is moved programmatically to the button that is the natural next action: after Start, focus Pause; after Pause, focus Start; after Reset, focus Start. Focus is moved only in response to a keyboard or pointer action, never on initial load. There are no global shortcuts (see Out of scope).
- **R38 Focus-visible.** See R9. The ring must not be clipped by `overflow: hidden` on any ancestor.
- **R39 Contrast.** The time text has at least 4.5:1 against the background (aim for 7:1 given it is the primary content). Enabled button label vs its fill is at least 4.5:1. Focus ring vs adjacent colours is at least 3:1. Disabled buttons are exempt from WCAG contrast, but their label must remain legible and recognisably "disabled". State is never conveyed by colour alone (enabled/disabled also differ in text colour and cursor, plus the semantics in R36).
- **R40 Motion.** There are no animations. Colour transitions, if any, are at most 150 ms and are removed under `prefers-reduced-motion: reduce`.
- **R41 Zoom and text size.** The layout works at 200% zoom and with the browser's larger default font size. Use `rem`/`clamp`, not fixed `px` heights on text containers.

## Out of scope

Nothing below is built. `[Brief: "no extra functionality"]`

- Laps / splits / history list
- Countdown mode, target time, presets, input fields for setting a time
- Sound, vibration or notifications at any moment
- Persistence (localStorage, URL params, cookies); no restoring a running timer after reload
- Settings, themes, dark-mode toggle, language switcher
- Hours display (`h:mm:ss`) and milliseconds / centiseconds display
- Global keyboard shortcuts (for example Space to start)
- Updating `document.title` or favicon with the time
- Auto-pause on tab hidden; Wake Lock; Web Workers
- Routing, multiple timers, backend, analytics

## Open questions

Proposed defaults are what the builder will implement unless the user answers otherwise.

| # | Question | Proposed default |
|---|---|---|
| Q1 | Start button label after Pause: keep "Start" or change to "Resume"? | Keep "Start" in all states. The brief names three buttons Start / Pause / Reset, and "resume" only describes the behaviour (R17). The R34 announcement still says "resumed" |
| Q2 | Should unavailable buttons be disabled (visible) or hidden? The brief says only "states: idle -> running -> paused" | Visible but disabled (R3, R8), so there is no layout shift |
| Q3 | Focus handling when a pressed button becomes disabled | Move focus programmatically to the next natural action (R37). Alternative: use `aria-disabled` and keep buttons focusable, at the cost of non-standard semantics |
| Q4 | Minutes after 59:59 | Continue `60:00`, `100:00`, ... (R26). Alternatives: wrap to `00:00` (loses data), switch to `h:mm:ss` (new format), or stop at `99:59` |
| Q5 | Upper limit of the display | No cap. The layout is guaranteed up to `999:59` (about 16.6 h), and beyond that it is best effort |
| Q6 | Which clock: `performance.now()` (monotonic, immune to system clock changes, but may not advance during OS sleep in some browsers) or `Date.now()` (wall clock, advances through sleep, but jumps if the user or NTP changes the clock) | `performance.now()`. For a stopwatch, an unaffected monotonic value is the safer default |
| Q7 | Visual cue for the paused state (the brief names three states but no visual design) | No extra cue beyond button states (R8). Otherwise the time would get a muted colour, which risks R39 |
| Q8 | Theme and visual style, since there is no Figma | One light theme, neutral palette, system font stack, tokens as CSS variables. `prefers-color-scheme` dark support is out of scope |
| Q9 | Screen-reader announcements on actions (R34): wanted at all? | Yes, in the polite hidden status region, on user actions only. This is not extra functionality, it is the access-equivalent of the visual change |
| Q10 | Refresh interval | 250 ms re-render interval (or `requestAnimationFrame`), values derived per R11–R12. The user never sees more than a one-second lag at a second boundary |

## Acceptance checklist

- [ ] **R1** Single screen, no routing
- [ ] **R2** Large `mm:ss` time centred horizontally and vertically
- [ ] **R3** Start / Pause / Reset in one row under the time, always rendered, in that order
- [ ] **R4** `min-height: 100dvh`, 16px side padding, no horizontal scroll at 320px
- [ ] **R5** Tabular digits, fluid font size
- [ ] **R6** Buttons at least 44×44 px; 3 fit in one row at 320px
- [ ] **R7** `lang`, `<title>Timer</title>`, viewport meta
- [ ] **R8** Button enabled/disabled matrix matches the table for idle, running, paused
- [ ] **R9** All interaction states specified and implemented (hover, focus-visible, active, disabled); loading, empty and error not applicable
- [ ] **R10** Time element is non-interactive; only content states
- [ ] **R11** Elapsed time derived from timestamps, not tick counts
- [ ] **R12** Display is `floor(elapsedMs / 1000)`; repaint interval at most 250 ms; late ticks do not change results
- [ ] **R13** `accumulatedMs` kept in ms, not rounded on Pause
- [ ] **R14** At most one repeating timer; cleared on pause, reset, unmount; StrictMode-safe
- [ ] **R15** Start from idle begins at `00:00` and runs
- [ ] **R16** Pause freezes the time and stops the repeating timer
- [ ] **R17** Start after Pause resumes from the frozen value
- [ ] **R18** Reset (running or paused) returns to idle `00:00`; no stale tick overwrites it
- [ ] **R19** Format: `mm` at least 2 digits, `ss` 00–59
- [ ] **R20** Double Start is a no-op; one repeating timer; guarded against same-tick double events
- [ ] **R21** Pause while idle impossible and a no-op if called
- [ ] **R22** Reset while idle disabled and a no-op
- [ ] **R23** Reset while running verified
- [ ] **R24** Reset while paused verified
- [ ] **R25** Resume example 00:05 → pause 10s → resume 3s = 00:08
- [ ] **R26** `59:59` → `60:00` → `100:00`; no wrap; layout holds
- [ ] **R27** Hidden tab: time stays correct (65s hidden = `01:05` ±1s) and repaints immediately on return
- [ ] **R28** Rapid Pause/Start toggling gives no drift and no duplicate repeating timers
- [ ] **R29** 320px, 200% zoom and landscape phone: nothing clipped
- [ ] **R30** Whole flow works with keyboard only
- [ ] **R31** No persistence; reload returns to idle
- [ ] **R32** `999:59` fits at 320px
- [ ] **R33** Time is `role="timer"`, `aria-live="off"`, named; no per-second announcements
- [ ] **R34** Hidden polite status region announces actions only, in plain language
- [ ] **R35** Visible labels equal accessible names; real `<button type="button">`
- [ ] **R36** Native `disabled` used for unavailable buttons
- [ ] **R37** Tab order Start → Pause → Reset; Enter/Space work; focus moves to the next action and is never lost to `<body>`
- [ ] **R38** Visible, unclipped focus ring
- [ ] **R39** Contrast: time ≥ 4.5:1, labels ≥ 4.5:1, focus ring ≥ 3:1; state not by colour alone
- [ ] **R40** No animation; reduced-motion respected
- [ ] **R41** Works at 200% zoom and larger text
- [ ] **Out of scope** respected: none of the excluded features exist in the build
