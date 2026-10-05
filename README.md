# Timer

A single-screen web timer: a large `mm:ss` display with **Start / Pause / Reset**. Vite + React + TypeScript, plain CSS, no extra dependencies.

- Spec: [SPEC.md](SPEC.md) (requirements R1–R41, written first, then implemented and reviewed against it)
- States: `idle` (00:00) → `running` → `paused`; Start after Pause resumes, Reset returns to `00:00`
- Time is derived from timestamps, so it stays correct in a background tab; minutes do not wrap at 59 (`59:59` → `60:00`)
- Accessible: native buttons, `role="timer"` (not announced every second), polite status messages on actions only, visible focus, responsive down to 320px

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
```

Built by an agent team (spec → builder → reviewer → shipper) defined in the parent workspace's `.claude/agents/`.
