"use client"

import { useEffect, useRef, useState } from "react"

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/**
 * Animates a number towards `target` (ease-out), starting from 0 on first
 * show and from the previous value afterwards. Jumps straight to the target
 * when the user prefers reduced motion.
 */
export function useCountUp(target: number, duration = 700): number {
  // With reduced motion the first render already shows the final figure
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0))
  const from = useRef(value)

  useEffect(() => {
    if (!Number.isFinite(target)) return
    const span = reducedMotion() ? 0 : duration
    const start = performance.now()
    const origin = from.current
    let frame = requestAnimationFrame(function tick(now) {
      const progress = span ? Math.min(1, (now - start) / span) : 1
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = origin + (target - origin) * eased
      from.current = next
      setValue(next)
      if (progress < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return Number.isFinite(target) ? value : target
}
