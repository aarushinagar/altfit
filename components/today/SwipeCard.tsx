'use client'
import { useState, useCallback, useRef } from 'react'
import { useSpring, animated, config } from 'react-spring'
import { useDrag } from '@use-gesture/react'

interface SwipeCardProps {
  look: any
  onSwipeRight: (look: any) => Promise<void>
  onSwipeLeft: (lookType: string) => Promise<void>
  isSaved: boolean
  children: React.ReactNode
}

const THRESHOLD  = 110  // px to trigger
const MAX_TILT   = 18   // max rotation degrees
const TILT_SPEED = 0.08 // rotation per px

export default function SwipeCard({
  look, onSwipeRight, onSwipeLeft, isSaved, children
}: SwipeCardProps) {
  const [flying, setFlying]     = useState(false)
  const [direction, setDirection] = useState<'left' | 'right' | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Main card spring
  const [cardSpring, cardApi] = useSpring(() => ({
    x: 0, rotate: 0, opacity: 1, scale: 1,
    config: config.stiff
  }))

  // Save indicator spring
  const [saveSpring, saveApi] = useSpring(() => ({
    opacity: 0, scale: 0.4, y: 0,
    config: { tension: 280, friction: 18 }
  }))

  // Skip indicator spring  
  const [skipSpring, skipApi] = useSpring(() => ({
    opacity: 0, scale: 0.4, y: 0,
    config: { tension: 280, friction: 18 }
  }))

  // Overlay tint spring
  const [overlaySpring, overlayApi] = useSpring(() => ({
    opacity: 0,
    config: { tension: 200, friction: 20 }
  }))

  const updateIndicators = useCallback((mx: number) => {
    const progress = Math.min(1, Math.max(0, Math.abs(mx) / THRESHOLD))
    
    if (mx > 20) {
      // Right swipe — show save
      setDirection('right')
      saveApi.start({
        opacity: progress,
        scale: 0.4 + progress * 0.7,
        y: -(progress * 8)
      })
      skipApi.start({ opacity: 0, scale: 0.4 })
      overlayApi.start({ opacity: progress * 0.06 })
    } else if (mx < -20) {
      // Left swipe — show skip
      setDirection('left')
      skipApi.start({
        opacity: progress,
        scale: 0.4 + progress * 0.7,
        y: -(progress * 8)
      })
      saveApi.start({ opacity: 0, scale: 0.4 })
      overlayApi.start({ opacity: 0 })
    } else {
      setDirection(null)
      saveApi.start({ opacity: 0, scale: 0.4, y: 0 })
      skipApi.start({ opacity: 0, scale: 0.4, y: 0 })
      overlayApi.start({ opacity: 0 })
    }
  }, [saveApi, skipApi, overlayApi])

  const resetAll = useCallback(() => {
    saveApi.start({ opacity: 0, scale: 0.4, y: 0 })
    skipApi.start({ opacity: 0, scale: 0.4, y: 0 })
    overlayApi.start({ opacity: 0 })
    setDirection(null)
  }, [saveApi, skipApi, overlayApi])

  const flyOut = useCallback(async (dir: 'right' | 'left') => {
    setFlying(true)

    // Quick pulse before flying
    await cardApi.start({
      scale: 1.02,
      config: { tension: 400, friction: 15 }
    })

    const targetX = dir === 'right'
      ? (window.innerWidth + 400)
      : -(window.innerWidth + 400)
    const targetRotate = dir === 'right' ? MAX_TILT + 5 : -(MAX_TILT + 5)

    // Fly out
    await cardApi.start({
      x: targetX,
      rotate: targetRotate,
      opacity: 0,
      scale: 0.92,
      config: { tension: 220, friction: 18 }
    })

    resetAll()

    // Trigger callback
    if (dir === 'right') await onSwipeRight(look)
    else await onSwipeLeft(look.lookType)

    // Reset card instantly
    cardApi.set({ x: 0, rotate: 0, opacity: 1, scale: 1 })
    setFlying(false)
    setDirection(null)
  }, [cardApi, look, onSwipeRight, onSwipeLeft, resetAll])

  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], last }) => {
      if (flying) return

      if (active) {
        const rotate = Math.max(-MAX_TILT,
          Math.min(MAX_TILT, mx * TILT_SPEED))

        cardApi.start({
          x: mx,
          rotate,
          scale: 1,
          immediate: true
        })

        updateIndicators(mx)
      }

      if (last) {
        const shouldFly =
          Math.abs(mx) > THRESHOLD ||
          (Math.abs(vx) > 0.5 && Math.abs(mx) > 60)

        if (shouldFly) {
          flyOut(mx > 0 ? 'right' : 'left')
        } else {
          // Snap back with satisfying wobble
          cardApi.start({
            x: 0, rotate: 0, scale: 1,
            config: config.wobbly
          })
          resetAll()
        }
      }
    },
    {
      axis: 'x',
      pointer: { touch: true, mouse: true },
      filterTaps: true,
      rubberband: 0.15
    }
  )

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', marginBottom: '24px' }}
    >

      {/* ── SAVE INDICATOR ────────────────────── */}
      <animated.div style={{
        position: 'absolute',
        top: '50%',
        left: '20px',
        translateY: '-50%',
        opacity: saveSpring.opacity,
        scale: saveSpring.scale,
        y: saveSpring.y,
        zIndex: 30,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: '8px'
      }}>
        {/* Outer ring pulse */}
        <div style={{ position: 'relative' }}>
          <animated.div style={{
            position: 'absolute',
            inset: '-8px',
            borderRadius: '50%',
            border: '1.5px solid rgba(28,25,23,0.2)',
            opacity: saveSpring.opacity
          }} />
          <div style={{
            width: '64px', height: '64px',
            borderRadius: '50%',
            background: '#1c1917',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 40px rgba(0,0,0,0.35)'
          }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <path
                d="M5 13l6 6L21 7"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <p style={{
          fontSize: '9px',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.2em',
          color: '#1c1917',
          margin: 0,
          fontWeight: 800
        }}>
          SAVE
        </p>
      </animated.div>

      {/* ── SKIP INDICATOR ────────────────────── */}
      <animated.div style={{
        position: 'absolute',
        top: '50%',
        right: '20px',
        translateY: '-50%',
        opacity: skipSpring.opacity,
        scale: skipSpring.scale,
        y: skipSpring.y,
        zIndex: 30,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{
          width: '64px', height: '64px',
          borderRadius: '50%',
          background: '#ffffff',
          border: '1.5px solid #d6d3d1',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 12px 40px rgba(0,0,0,0.12)'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 12H4M4 12l6-6M4 12l6 6"
              stroke="#78716c"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p style={{
          fontSize: '9px',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.2em',
          color: '#78716c',
          margin: 0,
          fontWeight: 800
        }}>
          SKIP
        </p>
      </animated.div>

      {/* ── CARD ─────────────────────────────── */}
      <animated.div
        {...bind()}
        style={{
          x: cardSpring.x,
          rotate: cardSpring.rotate,
          opacity: cardSpring.opacity,
          scale: cardSpring.scale,
          cursor: flying ? 'default' : 'grab',
          userSelect: 'none' as const,
          touchAction: 'pan-y',
          willChange: 'transform',
          position: 'relative',
          zIndex: 10,
          transformOrigin: 'center 80%',
          // Dynamic shadow based on drag direction
          filter: cardSpring.x.to(v =>
            Math.abs(v) > 20
              ? `drop-shadow(0 ${8 + Math.abs(v) * 0.05}px ${20 + Math.abs(v) * 0.1}px rgba(0,0,0,${0.08 + Math.abs(v) * 0.001}))`
              : 'drop-shadow(0 4px 16px rgba(0,0,0,0.06))'
          )
        }}
      >
        {/* Subtle tint overlay */}
        <animated.div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#1c1917',
            opacity: overlaySpring.opacity,
            zIndex: 5,
            pointerEvents: 'none',
            borderRadius: '2px'
          }}
        />

        {/* Outline glow */}
        <animated.div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '2px',
          zIndex: 4,
          pointerEvents: 'none',
          boxShadow: cardSpring.x.to(v => {
            if (v > 30) return `inset 0 0 0 2px rgba(28,25,23,${Math.min(0.8, v/THRESHOLD)})`
            if (v < -30) return `inset 0 0 0 1.5px rgba(214,211,209,${Math.min(0.6, -v/THRESHOLD)})`
            return 'none'
          })
        }} />

        {children}
      </animated.div>

      {/* ── SWIPE PROGRESS BAR ───────────────── */}
      <animated.div style={{
        position: 'absolute',
        bottom: '-4px',
        left: 0,
        right: 0,
        height: '2px',
        background: '#f5f3f0',
        borderRadius: '1px',
        overflow: 'hidden',
        opacity: cardSpring.x.to(v => Math.abs(v) > 10 ? 1 : 0)
      }}>
        <animated.div style={{
          position: 'absolute',
          top: 0,
          height: '100%',
          borderRadius: '1px',
          background: cardSpring.x.to(v =>
            v > 0 ? '#1c1917' : '#d6d3d1'
          ),
          // Progress bar fills left-to-right for right swipe
          // and right-to-left for left swipe
          left: cardSpring.x.to(v => v > 0 ? '0%' : 'auto'),
          right: cardSpring.x.to(v => v < 0 ? '0%' : 'auto'),
          width: cardSpring.x.to(v =>
            `${Math.min(100, (Math.abs(v) / THRESHOLD) * 100)}%`
          )
        }} />
      </animated.div>

    </div>
  )
}
