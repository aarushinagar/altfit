'use client'
import { useState, useCallback } from 'react'
import { useSpring, animated, config } from 'react-spring'
import { useDrag } from '@use-gesture/react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SwipeCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  look: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSwipeRight: (look: any) => Promise<void>
  onSwipeLeft: (lookType: string) => Promise<void>
  isSaved: boolean
  children: React.ReactNode
}

const SWIPE_THRESHOLD = 120  // px to trigger action
const ROTATION_FACTOR = 0.08 // how much card tilts per px

export default function SwipeCard({
  look,
  onSwipeRight,
  onSwipeLeft,
  isSaved,
  children
}: SwipeCardProps) {
  const [isFlying, setIsFlying] = useState(false)

  const [{ x, rotate, opacity }, api] = useSpring(() => ({
    x: 0,
    rotate: 0,
    opacity: 1,
    config: config.stiff
  }))

  // Indicator opacity scales with drag distance
  const rightIndicatorOpacity = x.to(v =>
    Math.min(1, Math.max(0, v / SWIPE_THRESHOLD))
  )
  const leftIndicatorOpacity = x.to(v =>
    Math.min(1, Math.max(0, -v / SWIPE_THRESHOLD))
  )
  const rightIndicatorScale = x.to(v =>
    0.6 + Math.min(0.4, Math.max(0, v / SWIPE_THRESHOLD) * 0.4)
  )
  const leftIndicatorScale = x.to(v =>
    0.6 + Math.min(0.4, Math.max(0, -v / SWIPE_THRESHOLD) * 0.4)
  )

  const flyOut = useCallback(async (direction: 'left' | 'right') => {
    setIsFlying(true)

    const targetX = direction === 'right'
      ? window.innerWidth + 200
      : -(window.innerWidth + 200)

    await api.start({
      x: targetX,
      rotate: direction === 'right' ? 20 : -20,
      opacity: 0,
      config: { tension: 180, friction: 20 }
    })

    if (direction === 'right') {
      await onSwipeRight(look)
    } else {
      await onSwipeLeft(look.lookType)
    }

    // Reset for if the card re-renders in place
    api.start({ x: 0, rotate: 0, opacity: 1, immediate: true })
    setIsFlying(false)
  }, [api, look, onSwipeRight, onSwipeLeft])

  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], last }) => {
      if (isFlying) return

      if (active) {
        api.start({
          x: mx,
          rotate: mx * ROTATION_FACTOR,
          opacity: 1,
          immediate: true
        })
      }

      if (last) {
        const shouldTrigger =
          Math.abs(mx) > SWIPE_THRESHOLD ||
          (Math.abs(vx) > 0.5 && Math.abs(mx) > 50)

        if (shouldTrigger) {
          flyOut(mx > 0 ? 'right' : 'left')
        } else {
          api.start({
            x: 0,
            rotate: 0,
            opacity: 1,
            config: config.wobbly
          })
        }
      }
    },
    {
      axis: 'x',
      pointer: { touch: true, mouse: true },
      filterTaps: true,
      rubberband: 0.2
    }
  )

  return (
    <div style={{ position: 'relative' }}>

      {/* ── SAVE INDICATOR (right swipe) ── */}
      <animated.div
        style={{
          position: 'absolute',
          top: '50%',
          left: '28px',
          transform: 'translateY(-50%)',
          opacity: rightIndicatorOpacity,
          scale: rightIndicatorScale,
          zIndex: 20,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: '#1c1917',
          border: '2px solid #1c1917',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)'
        }}>
          <span style={{
            color: '#fff',
            fontSize: '24px',
            lineHeight: 1,
            fontWeight: 300
          }}>
            ✓
          </span>
        </div>
        <p style={{
          fontSize: '9px',
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          color: '#1c1917',
          margin: 0,
          fontWeight: 600
        }}>
          Save
        </p>
      </animated.div>

      {/* ── SKIP INDICATOR (left swipe) ── */}
      <animated.div
        style={{
          position: 'absolute',
          top: '50%',
          right: '28px',
          transform: 'translateY(-50%)',
          opacity: leftIndicatorOpacity,
          scale: leftIndicatorScale,
          zIndex: 20,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          border: '1.5px solid #d6d3d1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.10)'
        }}>
          <span style={{
            color: '#78716c',
            fontSize: '20px',
            lineHeight: 1
          }}>
            ↺
          </span>
        </div>
        <p style={{
          fontSize: '9px',
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          color: '#78716c',
          margin: 0,
          fontWeight: 600
        }}>
          Skip
        </p>
      </animated.div>

      {/* ── THE CARD ── */}
      <animated.div
        {...bind()}
        style={{
          x,
          rotate,
          opacity,
          cursor: isFlying ? 'default' : 'grab',
          userSelect: 'none',
          touchAction: 'pan-y',
          willChange: 'transform',
          position: 'relative',
          zIndex: 10,
          boxShadow: x.to(v => {
            if (v > 30) return '0 0 0 2px #1c1917, 0 24px 48px rgba(0,0,0,0.12)'
            if (v < -30) return '0 0 0 1.5px #d6d3d1, 0 24px 48px rgba(0,0,0,0.08)'
            return '0 4px 24px rgba(0,0,0,0.06)'
          }),
          borderRadius: '2px',
        }}
      >
        {children}
      </animated.div>

    </div>
  )
}
