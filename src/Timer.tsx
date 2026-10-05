import { useCallback, useEffect, useRef, useState } from 'react'

type Status = 'idle' | 'running' | 'paused'
type FocusTarget = 'start' | 'pause'

const TICK_MS = 250

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`
}

function describeDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${plural(minutes, 'minute')} ${plural(seconds, 'second')}`
}

export function Timer() {
  const [status, setStatus] = useState<Status>('idle')
  const [seconds, setSeconds] = useState(0)
  const [announcement, setAnnouncement] = useState('')

  // Source of truth for the time model (R11, R13). Refs are updated
  // synchronously, so two events in the same tick see the same state (R20).
  const statusRef = useRef<Status>('idle')
  const accumulatedMsRef = useRef(0)
  const runStartRef = useRef<number | null>(null)

  const startRef = useRef<HTMLButtonElement>(null)
  const pauseRef = useRef<HTMLButtonElement>(null)
  const pendingFocusRef = useRef<FocusTarget | null>(null)

  // Derive whole seconds from timestamps, never from tick counts (R11, R12).
  const readSeconds = useCallback((): number => {
    const runStart = runStartRef.current
    const elapsedMs =
      accumulatedMsRef.current +
      (runStart === null ? 0 : performance.now() - runStart)
    return Math.floor(elapsedMs / 1000)
  }, [])

  // Exactly one interval while running; cleared on leaving running and on
  // unmount. Safe under StrictMode because cleanup always clears it (R14).
  useEffect(() => {
    if (status !== 'running') return

    const id = window.setInterval(() => {
      if (statusRef.current !== 'running') return // no stale tick (R18)
      setSeconds(readSeconds())
    }, TICK_MS)

    // Repaint immediately when the tab becomes visible again (R27).
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && statusRef.current === 'running') {
        setSeconds(readSeconds())
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [status, readSeconds])

  // Move focus after the status change has rendered, once the target button is
  // enabled. Only set in response to an action, never on load (R37).
  useEffect(() => {
    const target = pendingFocusRef.current
    if (target === null) return
    pendingFocusRef.current = null
    ;(target === 'start' ? startRef : pauseRef).current?.focus()
  }, [status])

  const handleStart = () => {
    const current = statusRef.current
    if (current !== 'idle' && current !== 'paused') return // R20

    if (current === 'idle') accumulatedMsRef.current = 0
    runStartRef.current = performance.now()
    statusRef.current = 'running'
    pendingFocusRef.current = 'pause'

    setSeconds(readSeconds())
    setStatus('running')
    setAnnouncement(current === 'idle' ? 'Timer started' : 'Timer resumed')
  }

  const handlePause = () => {
    const runStart = runStartRef.current
    if (statusRef.current !== 'running' || runStart === null) return // R21

    accumulatedMsRef.current += performance.now() - runStart
    runStartRef.current = null
    statusRef.current = 'paused'
    pendingFocusRef.current = 'start'

    const frozen = readSeconds()
    setSeconds(frozen)
    setStatus('paused')
    setAnnouncement(`Timer paused at ${describeDuration(frozen)}`)
  }

  const handleReset = () => {
    if (statusRef.current === 'idle') return // R22

    accumulatedMsRef.current = 0
    runStartRef.current = null
    statusRef.current = 'idle'
    pendingFocusRef.current = 'start'

    setSeconds(0)
    setStatus('idle')
    setAnnouncement('Timer reset')
  }

  return (
    <div className="timer">
      <div className="timer__time" role="timer" aria-label="Elapsed time" aria-live="off">
        {formatTime(seconds)}
      </div>

      <div className="timer__controls">
        <button
          ref={startRef}
          type="button"
          className="timer__button"
          onClick={handleStart}
          disabled={status === 'running'}
        >
          Start
        </button>
        <button
          ref={pauseRef}
          type="button"
          className="timer__button"
          onClick={handlePause}
          disabled={status !== 'running'}
        >
          Pause
        </button>
        <button
          type="button"
          className="timer__button"
          onClick={handleReset}
          disabled={status === 'idle'}
        >
          Reset
        </button>
      </div>

      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  )
}
