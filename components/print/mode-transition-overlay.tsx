"use client"

import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"

type Mode = "b2b" | "b2c"
type Phase = "enter" | "draw" | "morph" | "exit"

const TIMINGS = {
  enter: 400,
  draw: 2000,
  morph: 600,
  exit: 1000,
  pop: 400,
  shimmer: 900,
} as const

type TimingSet = { [K in keyof typeof TIMINGS]: number }

export function ModeTransitionOverlay({
  mode,
  title,
  onDone,
}: {
  mode: Mode
  title?: string
  onDone: () => void
}) {
  const reduceMotion = useReducedMotion()
  const timings = React.useMemo<TimingSet>(() => {
    if (!reduceMotion) return TIMINGS
    return { ...TIMINGS, enter: 0, draw: 0, morph: 0, exit: 0, pop: 0, shimmer: 0 }
  }, [reduceMotion])
  const [phase, setPhase] = React.useState<Phase>("enter")

  React.useEffect(() => {
    let alive = true

    ;(async () => {
      setPhase("enter")
      await sleep(timings.enter)
      if (!alive) return
      setPhase("draw")
      await sleep(timings.draw)
      if (!alive) return
      setPhase("morph")
      await sleep(timings.morph)
      if (!alive) return
      setPhase("exit")
      await sleep(timings.exit)
      if (!alive) return
      onDone()
    })()

    return () => {
      alive = false
    }
  }, [onDone, timings.enter, timings.draw, timings.morph, timings.exit])

  // Scroll to top while overlay is active
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const caption = title ?? "Pripravujeme ponuku pre vás..."
  const bgColor = `var(--${mode}-primary)`
  const fgColor = `var(--${mode}-primary-foreground)`

  return (
    <motion.div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
        pointerEvents: "auto" as const,
        background: bgColor,
        ["--fg" as string]: fgColor,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === "exit" ? 0 : 1 }}
      transition={{
        duration: (phase === "exit" ? timings.exit : timings.enter) / 1000,
        ease: phase === "exit" ? [0.4, 0, 0.2, 1] : "easeOut",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <LogoBeamScene phase={phase} timings={timings} reducedMotion={!!reduceMotion} />

        <motion.div
          style={{
            marginTop: 80,
            color: fgColor,
            fontSize: "1.5rem",
            fontWeight: 700,
            letterSpacing: "0.02em",
            textAlign: "center",
            textShadow: "0 10px 26px rgba(0, 0, 0, 0.25)",
            userSelect: "none",
            padding: "0 24px",
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{
            opacity: phase === "enter" ? 0 : phase === "exit" ? 0 : 1,
            y: phase === "enter" ? 10 : 0,
          }}
          transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeOut" }}
        >
          <motion.div
            animate={
              phase === "exit" || reduceMotion
                ? { opacity: 1 }
                : { opacity: [0.55, 1, 0.55] }
            }
            transition={
              phase === "exit" || reduceMotion
                ? { duration: 0 }
                : {
                    duration: Math.max(timings.shimmer / 1000, 0.6),
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
            }
          >
            {caption}
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  )
}

function LogoBeamScene({
  phase,
  timings,
  reducedMotion,
}: {
  phase: Phase
  timings: TimingSet
  reducedMotion: boolean
}) {
  const drawing = phase === "draw" || phase === "morph"
  const showFilled = phase === "morph" || phase === "exit"

  const beamRef = React.useRef<SVGPathElement | null>(null)
  const particleRef = React.useRef<SVGCircleElement | null>(null)
  const rafRef = React.useRef<number>(0)
  const [len, setLen] = React.useState<number>(1000)
  const gradientId = React.useId()
  const glowId = React.useId()
  const particleGlowId = React.useId()

  React.useEffect(() => {
    if (!beamRef.current) return
    try {
      const l = beamRef.current.getTotalLength()
      if (Number.isFinite(l) && l > 10) setLen(l)
    } catch {
      // fallback: keep default length
    }
  }, [])

  // Motion path + line drawing (anime.js-style)
  React.useEffect(() => {
    if (!drawing || reducedMotion) return
    const path = beamRef.current
    const particle = particleRef.current
    if (!path) return

    const duration = timings.draw

    // initial stroke state — fully hidden
    path.style.strokeDasharray = `${len}`
    path.style.strokeDashoffset = `${len}`

    let start = 0

    const tick = (ts: number) => {
      if (!start) start = ts
      const t = Math.min((ts - start) / duration, 1)

      // ease-out cubic for natural deceleration
      const eased = 1 - Math.pow(1 - t, 3)

      // line drawing — stroke reveals behind the particle
      path.style.strokeDashoffset = `${len * (1 - eased)}`

      // motion path — particle travels along the contour
      if (particle) {
        try {
          const pt = path.getPointAtLength(eased * len)
          particle.setAttribute("cx", `${pt.x}`)
          particle.setAttribute("cy", `${pt.y}`)
          particle.style.opacity = t < 0.01 ? "0" : "1"
        } catch {
          /* noop */
        }
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else if (particle) {
        particle.style.opacity = "0"
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [drawing, reducedMotion, len, timings.draw])

  return (
    <div
      className={`logoWrap ${drawing ? "isDrawing" : ""} ${
        showFilled ? "showFill" : ""
      } ${reducedMotion ? "noMotion" : ""}`}
      style={
        {
          "--draw-ms": `${timings.draw}ms`,
          "--pop-ms": `${timings.pop}ms`,
          "--morph-ms": `${timings.morph}ms`,
          "--shimmer-ms": `${timings.shimmer}ms`,
        } as React.CSSProperties
      }
    >
      <svg
        width="220"
        height="256"
        viewBox="0 0 120.75 140.29"
        xmlns="http://www.w3.org/2000/svg"
        className="svg"
        role="img"
        aria-label="Printexpert"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--fg)" stopOpacity="0.25" />
            <stop offset="40%" stopColor="var(--fg)" stopOpacity="0.6" />
            <stop offset="60%" stopColor="var(--fg)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--fg)" stopOpacity="0.25" />
          </linearGradient>

          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id={particleGlowId} x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="4.5" result="b1" />
            <feGaussianBlur stdDeviation="1.5" in="SourceGraphic" result="b2" />
            <feMerge>
              <feMergeNode in="b1" />
              <feMergeNode in="b1" />
              <feMergeNode in="b2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          className="outlineBase"
          d="M60.42,140.29c-1.82,0-3.67-.1-5.51-.3-5.76-.62-11.22-2.2-16.21-4.71-7.06-3.54-12.73-8.46-16.85-14.63-2.09-3.12-3.63-6.24-4.67-9.44-.96-.16-1.9-.4-2.82-.71-6.71-2.25-11.35-6.96-13.41-13.62-1.71-5.5-1.12-11.04,1.7-16.08v-7.91c0-6.92,0-13.83,0-20.75,0-4.05.74-8.07,2.18-11.96,2.35-6.35,6.32-11.82,11.79-16.28,2.64-2.15,5.56-3.97,8.69-5.43,3.61-5.43,8.45-9.82,14.4-13.06C46.34,1.82,53.54,0,61.15,0c1.11,0,2.24.04,3.37.12,8.21.56,15.72,3.17,22.31,7.75,4.84,3.36,8.73,7.56,11.59,12.49,4.8,2.68,8.87,6.16,12.12,10.34,4.19,5.4,6.7,11.55,7.44,18.28.21,1.89.2,3.68.19,5.41,0,.49,0,.99,0,1.48.02,2.44.01,4.87,0,7.31v6.34c0,3.66,0,7.32,0,10.99,4.36,7.86,3.1,17.79-3.15,24.36-3.19,3.35-7.06,5.41-11.53,6.13-2.47,7.68-7.15,14.24-13.92,19.53-5.21,4.06-11.24,6.92-17.94,8.48-3.67.86-7.44,1.29-11.22,1.29Z"
        />

        <path
          ref={beamRef}
          className="outlineBeam"
          strokeDasharray={len}
          strokeDashoffset={len}
          stroke={`url(#${gradientId})`}
          filter={`url(#${glowId})`}
          d="M60.42,140.29c-1.82,0-3.67-.1-5.51-.3-5.76-.62-11.22-2.2-16.21-4.71-7.06-3.54-12.73-8.46-16.85-14.63-2.09-3.12-3.63-6.24-4.67-9.44-.96-.16-1.9-.4-2.82-.71-6.71-2.25-11.35-6.96-13.41-13.62-1.71-5.5-1.12-11.04,1.7-16.08v-7.91c0-6.92,0-13.83,0-20.75,0-4.05.74-8.07,2.18-11.96,2.35-6.35,6.32-11.82,11.79-16.28,2.64-2.15,5.56-3.97,8.69-5.43,3.61-5.43,8.45-9.82,14.4-13.06C46.34,1.82,53.54,0,61.15,0c1.11,0,2.24.04,3.37.12,8.21.56,15.72,3.17,22.31,7.75,4.84,3.36,8.73,7.56,11.59,12.49,4.8,2.68,8.87,6.16,12.12,10.34,4.19,5.4,6.7,11.55,7.44,18.28.21,1.89.2,3.68.19,5.41,0,.49,0,.99,0,1.48.02,2.44.01,4.87,0,7.31v6.34c0,3.66,0,7.32,0,10.99,4.36,7.86,3.1,17.79-3.15,24.36-3.19,3.35-7.06,5.41-11.53,6.13-2.47,7.68-7.15,14.24-13.92,19.53-5.21,4.06-11.24,6.92-17.94,8.48-3.67.86-7.44,1.29-11.22,1.29Z"
        />

        {/* Particle that travels along the contour */}
        <circle
          ref={particleRef}
          className="beamParticle"
          r="3"
          fill="var(--fg)"
          filter={`url(#${particleGlowId})`}
          style={{ opacity: 0 }}
        />

        <g className="filled">
          <path
            d="M60.42,140.29c-1.82,0-3.67-.1-5.51-.3-5.76-.62-11.22-2.2-16.21-4.71-7.06-3.54-12.73-8.46-16.85-14.63-2.09-3.12-3.63-6.24-4.67-9.44-.96-.16-1.9-.4-2.82-.71-6.71-2.25-11.35-6.96-13.41-13.62-1.71-5.5-1.12-11.04,1.7-16.08v-7.91c0-6.92,0-13.83,0-20.75,0-4.05.74-8.07,2.18-11.96,2.35-6.35,6.32-11.82,11.79-16.28,2.64-2.15,5.56-3.97,8.69-5.43,3.61-5.43,8.45-9.82,14.4-13.06C46.34,1.82,53.54,0,61.15,0c1.11,0,2.24.04,3.37.12,8.21.56,15.72,3.17,22.31,7.75,4.84,3.36,8.73,7.56,11.59,12.49,4.8,2.68,8.87,6.16,12.12,10.34,4.19,5.4,6.7,11.55,7.44,18.28.21,1.89.2,3.68.19,5.41,0,.49,0,.99,0,1.48.02,2.44.01,4.87,0,7.31v6.34c0,3.66,0,7.32,0,10.99,4.36,7.86,3.1,17.79-3.15,24.36-3.19,3.35-7.06,5.41-11.53,6.13-2.47,7.68-7.15,14.24-13.92,19.53-5.21,4.06-11.24,6.92-17.94,8.48-3.67.86-7.44,1.29-11.22,1.29Z"
            fill="#fff"
          />
          <g>
            <path
              d="M113.63,66.26c0,4.95,0,9.91,0,14.86,0,.42.1.78.32,1.15,3.68,6.18,2.77,14.21-2.22,19.45-3.06,3.22-6.85,4.84-11.27,5-.39.01-.53.14-.62.5-2.02,8.12-6.52,14.6-13.07,19.71-4.81,3.75-10.24,6.25-16.17,7.64-5.01,1.17-10.08,1.45-15.2.9-5.14-.55-10.04-1.93-14.66-4.25-6.14-3.08-11.27-7.35-15.1-13.09-2.21-3.3-3.9-6.86-4.8-10.75-.09-.4-.32-.44-.61-.45-1.51-.02-2.99-.26-4.42-.74-5.3-1.78-8.86-5.33-10.51-10.65-1.43-4.63-.82-9.08,1.74-13.22.17-.27.16-.55.16-.84,0-9.77-.01-19.55,0-29.32,0-3.57.66-7.04,1.9-10.39,2.13-5.74,5.66-10.47,10.4-14.33,2.61-2.13,5.46-3.85,8.54-5.2.24-.11.42-.24.57-.47,3.32-5.3,7.81-9.37,13.28-12.35,6.96-3.78,14.42-5.29,22.3-4.76,7.3.5,14.01,2.77,20.03,6.95,4.47,3.1,8.07,7.02,10.68,11.81.13.24.29.38.52.51,4.5,2.39,8.38,5.54,11.5,9.57,3.66,4.72,5.85,10.04,6.52,15.99.24,2.14.15,4.28.17,6.42.02,3.45,0,6.91,0,10.36ZM93.16,52.57c.12-1.38.04-2.76.02-4.15-.02-1.2-.52-2.19-1.39-2.98-1.17-1.07-2.63-1.39-4.16-1.4-2.81-.02-5.62,0-8.43-.01-.35,0-.65.07-.94.24-1.13.7-2.31,1.28-3.52,1.82-6.08,2.72-12.42,3.54-19,2.53-4.26-.65-8.23-2.13-11.92-4.35-.25-.15-.51-.25-.82-.25-3.39,0-6.79,0-10.18,0-1.29,0-2.52.32-3.58,1.04-1.39.94-1.88,2.31-1.87,3.98.03,12.52.02,25.04.02,37.57-.25.44-.09.91-.11,1.36-.04.72-.51,1.4-1.19,1.64-.69.25-1.44-.01-1.93-.6-.47-.56-.4-1.21-.37-1.84.03-.45-.12-.57-.56-.54-.91.05-1.83,0-2.75.07-3.78.27-6.15,4.65-4.29,7.96,1.14,2.03,2.94,2.91,5.22,2.92,1.99,0,3.98.01,5.97,0,.37,0,.5.11.56.47.6,3.52,1.83,6.83,3.56,9.94,4.1,7.34,10.13,12.45,18.05,15.24,5.72,2.02,11.61,2.35,17.56,1.1,7.96-1.68,14.42-5.78,19.38-12.19,3.21-4.14,5.29-8.82,6.22-13.99.08-.43.25-.58.72-.57,1.79.04,3.59.02,5.38.01,1.83,0,3.38-.6,4.58-2.04,2.01-2.43,1.38-6.31-1.29-7.98-1.29-.81-2.69-.94-4.15-.93-1.26.02-1.26,0-1.27,1.27,0,1.05-.73,1.78-1.75,1.78-.99,0-1.74-.76-1.75-1.79,0-.78-.01-1.56-.01-2.34,0-10.77,0-21.54.01-32.3,0-.23-.01-.47-.02-.7ZM84.84,39.54c.29,0,.58,0,.87,0,1.48.02,2.98-.14,4.44.07,4,.58,6.84,4.06,6.82,8.02-.05,8.37-.02,16.74-.02,25.11,0,.75,0,.74.77.75,1.34.02,2.69-.11,4.03.1.55.09.68-.02.68-.59-.02-8.19-.03-16.39,0-24.58,0-2.48-.43-4.84-1.48-7.07-1.79-3.79-4.63-6.49-8.49-8.11-1.84-.77-3.76-1.1-5.74-1.15-.38,0-.45-.15-.45-.48-.05-2.3-.78-4.4-1.94-6.35-1.86-3.13-4.56-5.38-7.71-7.11-4.53-2.48-9.43-3.58-14.56-3.7-2.91-.07-5.78.2-8.63.86-4.47,1.04-8.55,2.86-11.97,5.97-3.08,2.79-5.11,6.15-5.29,10.42-.01.32-.14.39-.42.38-.95,0-1.91,0-2.86.09-4.12.38-7.55,2.14-10.32,5.19-2.49,2.73-3.98,5.97-4.03,9.64-.11,8.64-.03,17.28-.05,25.92,0,.41.14.47.5.46,1.45-.02,2.9-.03,4.35,0,.52.01.67-.12.67-.66-.02-8.37-.01-16.74-.02-25.11,0-.71.06-1.41.25-2.08.94-3.25,3.05-5.28,6.39-5.9,1.81-.33,3.66-.07,5.49-.13.42-.01.84,0,1.43,0-.39-.36-.64-.62-.91-.85-.52-.45-.9-.97-.94-1.68-.05-.87.48-1.71,1.27-2.06.85-.37,1.78-.13,2.54.66,2.17,2.27,4.66,4.14,7.41,5.62,4.65,2.51,9.6,3.85,14.94,3.64,2.05-.08,4.07-.34,6.06-.82,2.93-.71,5.7-1.85,8.28-3.4,2.47-1.49,4.82-3.15,6.77-5.31.85-.94,2.29-1.01,3.13-.19.89.86.84,2.15-.1,3.12-.39.4-.75.83-1.15,1.27Z"
              fill="#0b1932"
            />
            <path
              d="M93.16,52.57c0,.23.02.47.02.7,0,10.77,0,21.54-.01,32.3,0,.78,0,1.56.01,2.34.01,1.03.76,1.79,1.75,1.79,1.02,0,1.74-.73,1.75-1.78.01-1.27.01-1.25,1.27-1.27,1.46-.02,2.86.12,4.15.93,2.67,1.67,3.3,5.55,1.29,7.98-1.2,1.44-2.75,2.04-4.58,2.04-1.79,0-3.59.02-5.38-.01-.47-.01-.64.14-.72.57-.93,5.17-3.02,9.85-6.22,13.99-4.97,6.42-11.42,10.52-19.38,12.19-5.95,1.25-11.84.92-17.56-1.1-7.92-2.79-13.95-7.9-18.05-15.24-1.74-3.11-2.96-6.42-3.56-9.94-.06-.35-.19-.47-.56-.47-1.99.02-3.98.01-5.97,0-2.28,0-4.08-.88-5.22-2.92-1.86-3.31.51-7.69,4.29-7.96.92-.07,1.83-.02,2.75-.07.43-.02.58.09.56.54-.04.63-.1,1.28.37,1.84.49.59,1.24.85,1.93.6.69-.24,1.16-.92,1.19-1.64.02-.45-.13-.93.11-1.36.21-.21.11-.48.11-.72,0-10.88,0-21.76,0-32.65,0-.49.06-.71.65-.71,5.66.02,11.31.02,16.97.01.24,0,.46.03.68.13,3.88,1.79,7.94,2.91,12.19,3.25,2.47.19,4.94.12,7.41-.19,3.18-.41,6.21-1.29,9.2-2.41.72-.27,1.36-.77,2.18-.77,5.46,0,10.92,0,16.38,0ZM58.79,96.93c1.85,0,3.71-.04,5.56.01,1.39.04,2.64-1.64,1.92-2.9-.15-.27-.25-.57-.37-.85-1.14-2.62-2.27-5.24-3.41-7.86-.51-1.16-1.01-2.32-1.55-3.46-.37-.77-.98-1.3-1.86-1.29-.77,0-1.46.33-1.82,1.07-1.97,4.09-3.9,8.19-5.89,12.27-.83,1.7.56,3.07,1.92,3.03,1.83-.05,3.67-.01,5.5-.01ZM69.51,69.39c0,1.45.82,2.45,2.27,2.64,5.03.64,10.07,1.25,15.11,1.86,1.48.18,2.41-.36,2.92-1.64.63-1.58-.27-3.43-1.84-3.63-2.66-.35-5.33-.64-7.99-.96-2.45-.29-4.91-.55-7.36-.88-1.8-.25-3.12.81-3.12,2.61ZM32.42,71.15c-.07,1.54,1.25,3.05,3.04,2.77,2.56-.4,5.14-.65,7.71-.96,2.55-.31,5.1-.62,7.65-.95,1.37-.18,2.27-1.51,2.09-3.03-.16-1.36-1.35-2.39-2.66-2.25-1.74.19-3.48.41-5.22.62-3.42.41-6.84.84-10.26,1.24-1.4.16-2.34,1.15-2.34,2.57ZM61.64,111.41c.25-.02.5-.04.76-.05,3.07-.09,5.96-.82,8.61-2.4,2.65-1.57,4.51-3.84,5.86-6.57.45-.91.08-1.93-.77-2.27-.93-.37-1.87.11-2.21,1.12-.05.15-.08.3-.16.44-1.41,2.61-3.43,4.59-6.23,5.62-3.44,1.27-6.96,1.35-10.49.35-.79-.22-1.51.04-1.9.73-.38.68-.25,1.43.34,1.95.3.26.66.41,1.04.49,1.7.38,3.42.57,5.15.59ZM43.27,86.31c2.07-.01,3.65-1.61,3.63-3.68-.02-1.94-1.64-3.59-3.56-3.59-2.11,0-3.73,1.62-3.71,3.73.02,1.98,1.64,3.56,3.64,3.54ZM77.1,86.31c2.05-.02,3.59-1.62,3.57-3.72-.01-1.95-1.65-3.57-3.58-3.55-2.06.02-3.71,1.65-3.69,3.65.02,2.04,1.65,3.64,3.7,3.62Z"
              fill="#eed7d0"
            />
            <path
              d="M84.84,39.54c.4-.44.76-.87,1.15-1.27.94-.97.99-2.25.1-3.12-.84-.82-2.28-.74-3.13.19-1.96,2.15-4.31,3.82-6.77,5.31-2.58,1.55-5.34,2.7-8.28,3.4-1.99.48-4.01.74-6.06.82-5.33.2-10.28-1.14-14.94-3.64-2.75-1.48-5.24-3.35-7.41-5.62-.75-.79-1.69-1.03-2.54-.66-.79.34-1.32,1.19-1.27,2.06.04.71.42,1.23.94,1.68.27.24.52.49.91.85-.59,0-1.01-.01-1.43,0-1.83.06-3.68-.21-5.49.13-3.34.62-5.45,2.65-6.39,5.9-.19.67-.26,1.37-.25,2.08,0,8.37,0,16.74.02,25.11,0,.54-.14.67-.67.66-1.45-.04-2.9-.03-4.35,0-.36,0-.5-.05-.5-.46.01-8.64-.07-17.28.05-25.92.05-3.68,1.55-6.91,4.03-9.64,2.77-3.05,6.2-4.81,10.32-5.19.95-.09,1.91-.1,2.86-.09.29,0,.41-.06.42-.38.18-4.28,2.21-7.63,5.29-10.42,3.42-3.11,7.51-4.92,11.97-5.97,2.84-.66,5.72-.94,8.63-.86,5.13.12,10.03,1.22,14.56,3.7,3.15,1.73,5.85,3.98,7.71,7.11,1.16,1.95,1.89,4.05,1.94,6.35,0,.33.08.47.45.48,1.98.04,3.91.38,5.74,1.15,3.86,1.62,6.7,4.32,8.49,8.11,1.06,2.24,1.49,4.6,1.48,7.07-.03,8.19-.02,16.39,0,24.58,0,.56-.13.67-.68.59-1.33-.21-2.68-.08-4.03-.1-.77-.01-.77,0-.77-.75,0-8.37-.04-16.74.02-25.11.02-3.96-2.82-7.44-6.82-8.02-1.46-.21-2.96-.05-4.44-.07-.29,0-.58,0-.87,0Z"
              fill="#e13d21"
            />
            <path
              d="M93.16,52.57c-5.46,0-10.92,0-16.38,0-.82,0-1.46.5-2.18.77-2.98,1.13-6.02,2.01-9.2,2.41-2.47.32-4.94.39-7.41.19-4.25-.33-8.32-1.46-12.19-3.25-.22-.1-.44-.13-.68-.13-5.66,0-11.31.01-16.97-.01-.59,0-.65.22-.65.71.01,10.88,0,21.76,0,32.65,0,.24.1.51-.11.72,0-12.52.01-25.04-.02-37.57,0-1.67.48-3.03,1.87-3.98,1.07-.73,2.29-1.04,3.58-1.04,3.39,0,6.79,0,10.18,0,.31,0,.57.1.82.25,3.69,2.22,7.66,3.7,11.92,4.35,6.57,1.01,12.92.18,19-2.53,1.21-.54,2.4-1.12,3.52-1.82.29-.18.59-.25.94-.24,2.81.01,5.62,0,8.43.01,1.53.01,2.99.32,4.16,1.4.87.79,1.37,1.78,1.39,2.98.02,1.38.1,2.76-.02,4.15Z"
              fill="#d8b9ae"
            />
            <path
              d="M58.79,96.93c-1.83,0-3.67-.04-5.5.01-1.36.04-2.75-1.33-1.92-3.03,1.99-4.08,3.92-8.18,5.89-12.27.35-.74,1.04-1.07,1.82-1.07.88,0,1.49.53,1.86,1.29.54,1.14,1.05,2.3,1.55,3.46,1.14,2.62,2.28,5.24,3.41,7.86.12.29.22.59.37.85.72,1.26-.53,2.94-1.92,2.9-1.85-.06-3.71-.01-5.56-.01Z"
              fill="#de978d"
            />
            <path
              d="M69.51,69.39c0-1.8,1.32-2.86,3.12-2.61,2.45.34,4.9.59,7.36.88,2.66.32,5.33.61,7.99.96,1.57.21,2.47,2.05,1.84,3.63-.51,1.27-1.45,1.82-2.92,1.64-5.04-.61-10.08-1.22-15.11-1.86-1.45-.18-2.26-1.19-2.27-2.64Z"
              fill="#e13d21"
            />
            <path
              d="M32.42,71.15c0-1.42.95-2.41,2.34-2.57,3.42-.39,6.84-.82,10.26-1.24,1.74-.21,3.48-.44,5.22-.62,1.31-.14,2.51.9,2.66,2.25.18,1.52-.72,2.86-2.09,3.03-2.55.33-5.1.63-7.65.95-2.57.31-5.15.56-7.71.96-1.79.28-3.11-1.23-3.04-2.77Z"
              fill="#e13d21"
            />
            <path
              d="M61.64,111.41c-1.74-.02-3.46-.21-5.15-.59-.38-.09-.74-.23-1.04-.49-.59-.52-.72-1.27-.34-1.95.39-.69,1.11-.96,1.9-.73,3.53,1,7.05.92,10.49-.35,2.8-1.04,4.82-3.01,6.23-5.62.07-.13.11-.29.16-.44.34-1.02,1.28-1.5,2.21-1.12.85.34,1.22,1.36.77,2.27-1.34,2.73-3.21,5-5.86,6.57-2.66,1.58-5.54,2.32-8.61,2.4-.25,0-.5.03-.76.05Z"
              fill="#0b1932"
            />
            <path
              d="M43.27,86.31c-2,.01-3.62-1.56-3.64-3.54-.02-2.11,1.6-3.74,3.71-3.73,1.92,0,3.54,1.65,3.56,3.59.02,2.07-1.56,3.67-3.63,3.68Z"
              fill="#0b1932"
            />
            <path
              d="M77.1,86.31c-2.05.02-3.69-1.58-3.7-3.62-.02-2,1.64-3.63,3.69-3.65,1.93-.02,3.57,1.6,3.58,3.55.01,2.1-1.52,3.7-3.57,3.72Z"
              fill="#0b1932"
            />
          </g>
        </g>
      </svg>

      <style jsx>{`
        .logoWrap {
          width: 220px;
          height: 256px;
          transform-origin: 50% 50%;
          animation: popIn var(--pop-ms) cubic-bezier(0.2, 0.8, 0.2, 1)
            forwards;
        }

        .svg {
          overflow: visible;
        }

        .outlineBase {
          fill: none;
          stroke: rgba(255, 255, 255, 0.35);
          stroke-width: 2.2;
          opacity: 0;
          transition: opacity 160ms ease-out;
        }

        .outlineBeam {
          fill: none;
          stroke-width: 3.2;
          stroke-linecap: round;
          stroke-linejoin: round;
          opacity: 0;
          transition: opacity 160ms ease-out;
        }

        .isDrawing .outlineBase,
        .isDrawing .outlineBeam {
          opacity: 1;
        }

        .isDrawing .outlineBeam {
          animation: pulse var(--shimmer-ms) ease-in-out infinite;
        }

        .beamParticle {
          transition: opacity 150ms ease-out;
        }

        .showFill .beamParticle {
          opacity: 0 !important;
          transition: opacity 220ms ease-out;
        }

        .filled {
          opacity: 0;
          transform: scale(0.99);
          transform-origin: 50% 50%;
          transition: opacity var(--morph-ms) ease-out,
            transform var(--morph-ms) ease-out;
        }

        .showFill .filled {
          opacity: 1;
          transform: scale(1);
        }

        .showFill .outlineBase,
        .showFill .outlineBeam {
          opacity: 0;
          transition: opacity 220ms ease-out;
        }

        .noMotion,
        .noMotion .outlineBeam,
        .noMotion .outlineBase {
          animation: none;
          transition: none;
        }

        @keyframes popIn {
          from {
            opacity: 0;
            transform: scale(0.97) translateY(6px);
            filter: blur(4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
            filter: blur(0);
          }
        }

        @keyframes draw {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes shimmer {
          0% {
            opacity: 0.85;
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0.85;
          }
        }

        @keyframes pulse {
          0% {
            opacity: 0.6;
            filter: drop-shadow(0 0 3px var(--fg));
          }
          50% {
            opacity: 1;
            filter: drop-shadow(0 0 8px var(--fg));
          }
          100% {
            opacity: 0.6;
            filter: drop-shadow(0 0 3px var(--fg));
          }
        }
      `}</style>
    </div>
  )
}

function sleep(ms: number) {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}
