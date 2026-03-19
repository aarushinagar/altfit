'use client'
import { useState, useCallback, useEffect } from 'react'
import { useSpring, animated } from 'react-spring'
import { useDrag } from '@use-gesture/react'

interface SwipeCardProps {
  look: any
  positionInStack: number  // 0=top, 1=second, 2=third
  isTopCard: boolean
  onSwipeRight: (look: any) => Promise<void> | void
  onSwipeLeft: (lookType: string) => Promise<void> | void
  children: React.ReactNode
}

// Visual config for each stack position
const STACK = [
  { scale: 1.00, y: 0,  opacity: 1.00, zIndex: 30 },
  { scale: 0.95, y: 12, opacity: 0.90, zIndex: 20 },
  { scale: 0.90, y: 24, opacity: 0.75, zIndex: 10 },
]

const SWIPE_THRESHOLD = 100
const MAX_ROTATION    = 15

export default function SwipeCard({
  look, positionInStack, isTopCard,
  onSwipeRight, onSwipeLeft, children
}: SwipeCardProps) {
  
  const cfg = STACK[positionInStack] ?? STACK[2]
  const [gone, setGone] = useState(false)

  // ── Position spring (used by background cards too)
  const [pos, posApi] = useSpring(() => ({
    scale:   cfg.scale,
    y:       cfg.y,
    opacity: cfg.opacity,
    config: { tension: 220, friction: 24 }
  }))

  // ── Drag spring (only used by top card)
  const [drag, dragApi] = useSpring(() => ({
    x: 0, rotate: 0,
    config: { tension: 280, friction: 18 }
  }))

  // ── Indicators
  const [saveIndicator, saveApi] = useSpring(() => ({
    opacity: 0, scale: 0.4,
    config: { tension: 300, friction: 20 }
  }))
  const [skipIndicator, skipApi] = useSpring(() => ({
    opacity: 0, scale: 0.4,
    config: { tension: 300, friction: 20 }
  }))

  // When positionInStack changes, animate to new position
  // This is what makes the "next card slides up" effect
  useEffect(() => {
    const newCfg = STACK[positionInStack] ?? STACK[2]
    posApi.start({
      scale:   newCfg.scale,
      y:       newCfg.y,
      opacity: newCfg.opacity
    })
  }, [positionInStack, posApi])

  const flyOut = useCallback(async (direction: 'right' | 'left') => {
    if (gone) return
    setGone(true)

    const W = window.innerWidth

    // Reset indicators
    saveApi.start({ opacity: 0, scale: 0.4 })
    skipApi.start({ opacity: 0, scale: 0.4 })

    // Quick pulse
    await dragApi.start({
      x: direction === 'right' ? 20 : -20,
      config: { tension: 600, friction: 15 }
    })

    // Fly out
    await dragApi.start({
      x: direction === 'right' ? W + 300 : -(W + 300),
      rotate: direction === 'right' ? 20 : -20,
      config: { tension: 180, friction: 20 }
    })

    // Also fade position spring
    posApi.start({ opacity: 0 })

    // Notify parent — this triggers setTopIndex(+1)
    if (direction === 'right') onSwipeRight(look)
    else onSwipeLeft(look.lookType)

  }, [gone, look, dragApi, posApi, saveApi, skipApi,
      onSwipeRight, onSwipeLeft])

  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], last }) => {
      if (!isTopCard || gone) return

      if (active) {
        const rotate = Math.max(-MAX_ROTATION,
          Math.min(MAX_ROTATION, mx * 0.07))
        dragApi.start({ x: mx, rotate, immediate: true })

        // Update indicators
        const progress = Math.min(1, Math.abs(mx) / SWIPE_THRESHOLD)
        if (mx > 15) {
          saveApi.start({ opacity: progress, scale: 0.3 + progress * 0.8 })
          skipApi.start({ opacity: 0, scale: 0.3 })
        } else if (mx < -15) {
          skipApi.start({ opacity: progress, scale: 0.3 + progress * 0.8 })
          saveApi.start({ opacity: 0, scale: 0.3 })
        } else {
          saveApi.start({ opacity: 0, scale: 0.3 })
          skipApi.start({ opacity: 0, scale: 0.3 })
        }
      }

      if (last) {
        const shouldFly =
          Math.abs(mx) > SWIPE_THRESHOLD ||
          (Math.abs(vx) > 0.4 && Math.abs(mx) > 50)

        if (shouldFly) {
          flyOut(mx > 0 ? 'right' : 'left')
        } else {
          // Snap back
          dragApi.start({
            x: 0, rotate: 0,
            config: { tension: 280, friction: 18 }
          })
          saveApi.start({ opacity: 0, scale: 0.3 })
          skipApi.start({ opacity: 0, scale: 0.3 })
        }
      }
    },
    {
      axis: 'x',
      pointer: { touch: true, mouse: true },
      filterTaps: true,
      enabled: isTopCard && !gone
    }
  )

  return (
    <animated.div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0,
      scale:   pos.scale,
      y:       pos.y,
      opacity: pos.opacity,
      zIndex:  cfg.zIndex,
      transformOrigin: '50% 100%'
    }}>

      {/* SAVE indicator — only shown on top card */}
      {isTopCard && (
        <animated.div style={{
          position: 'absolute',
          top: '50%', left: '20px',
          translateY: '-50%',
          opacity: saveIndicator.opacity,
          scale: saveIndicator.scale,
          zIndex: 100,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          gap: '6px'
        }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: '#1c1917',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <path d="M5 13l5.5 5.5L21 7" stroke="white"
                strokeWidth="2.5" strokeLinecap="round"
                strokeLinejoin="round"/>
            </svg>
          </div>
          <p style={{
            fontSize: '9px', textTransform: 'uppercase' as const,
            letterSpacing: '0.2em', color: '#1c1917',
            margin: 0, fontWeight: 800
          }}>SAVE</p>
        </animated.div>
      )}

      {/* SKIP indicator — only shown on top card */}
      {isTopCard && (
        <animated.div style={{
          position: 'absolute',
          top: '50%', right: '20px',
          translateY: '-50%',
          opacity: skipIndicator.opacity,
          scale: skipIndicator.scale,
          zIndex: 100,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          gap: '6px'
        }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: '#fff', border: '1.5px solid #d6d3d1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M17 11H5M5 11l5-5M5 11l5 5"
                stroke="#78716c" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p style={{
            fontSize: '9px', textTransform: 'uppercase' as const,
            letterSpacing: '0.2em', color: '#78716c',
            margin: 0, fontWeight: 800
          }}>NEXT</p>
        </animated.div>
      )}

      {/* THE CARD — only top card is draggable */}
      <animated.div
        {...(isTopCard ? bind() : {})}
        style={{
          x:      isTopCard ? drag.x : 0,
          rotate: isTopCard ? drag.rotate : 0,
          cursor: isTopCard && !gone ? 'grab' : 'default',
          userSelect: 'none' as const,
          touchAction: 'pan-y',
          willChange: 'transform',
          transformOrigin: '50% 85%',
          // Shadow depth for top card
          filter: isTopCard
            ? drag.x.to(v =>
                `drop-shadow(0 ${6 + Math.abs(v)*0.03}px ${
                  20 + Math.abs(v)*0.08}px rgba(0,0,0,${
                  0.08 + Math.abs(v)*0.0006}))`
              )
            : 'none'
        }}
      >
        {/* Border glow */}
        {isTopCard && (
          <animated.div style={{
            position: 'absolute', inset: 0,
            borderRadius: '2px', zIndex: 5,
            pointerEvents: 'none',
            outline: drag.x.to(v => {
              if (v > 25) return `2px solid rgba(28,25,23,${Math.min(0.7, v/100)})`
              if (v < -25) return `1.5px solid rgba(200,196,193,${Math.min(0.5, -v/100)})`
              return '2px solid transparent'
            })
          }} />
        )}

        {children}
      </animated.div>

      {/* Progress bar at bottom of top card */}
      {isTopCard && (
        <animated.div style={{
          position: 'absolute', bottom: '-3px',
          left: 0, right: 0, height: '2px',
          background: '#f0ede8', overflow: 'hidden',
          opacity: drag.x.to(v => Math.abs(v) > 10 ? 1 : 0)
        }}>
          <animated.div style={{
            position: 'absolute', top: 0, bottom: 0,
            background: drag.x.to(v => v > 0 ? '#1c1917' : '#c4bfbb'),
            left: drag.x.to(v => v > 0 ? '0' : 'auto'),
            right: drag.x.to(v => v < 0 ? '0' : 'auto'),
            width: drag.x.to(v =>
              `${Math.min(100, Math.abs(v) / 100 * 100)}%`
            )
          }} />
        </animated.div>
      )}

    </animated.div>
  )
}
