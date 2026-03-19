'use client'
import { useEffect, useState } from 'react'

export default function SwipeHint() {
  const [phase, setPhase] = useState<'hidden' | 'in' | 'visible' | 'out'>('hidden')

  useEffect(() => {
    try {
      if (!localStorage.getItem('altfit_hint_v3')) {
        setTimeout(() => setPhase('in'), 1200)
        setTimeout(() => setPhase('visible'), 1600)
        setTimeout(() => setPhase('out'), 5500)
        setTimeout(() => {
          setPhase('hidden')
          localStorage.setItem('altfit_hint_v3', '1')
        }, 6200)
      }
    } catch {}
  }, [])

  if (phase === 'hidden') return null

  const isVisible = phase === 'visible' || phase === 'in'

  return (
    <>
      {/* Backdrop blur hint */}
      <div style={{
        position: 'fixed',
        bottom: '88px',
        left: '50%',
        transform: `translateX(-50%) translateY(${isVisible ? '0px' : '12px'})`,
        opacity: isVisible ? 1 : 0,
        transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        zIndex: 9997,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        background: 'rgba(20,18,17,0.90)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: '0',
        borderRadius: '50px',
        overflow: 'hidden',
        boxShadow: '0 16px 48px rgba(0,0,0,0.25)'
      }}>

        {/* Skip side */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 18px 12px 20px',
          borderRight: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{
            width: '28px', height: '28px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            animation: 'hint-nudge-left 2s ease-in-out infinite'
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M10 6H2M2 6l4-4M2 6l4 4"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p style={{
              fontSize: '8px', textTransform: 'uppercase' as const,
              letterSpacing: '0.18em', color: 'rgba(255,255,255,0.4)',
              margin: 0, lineHeight: 1
            }}>Swipe left</p>
            <p style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.7)',
              margin: '3px 0 0', lineHeight: 1,
              fontWeight: 500
            }}>Skip look</p>
          </div>
        </div>

        {/* Save side */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 20px 12px 18px'
        }}>
          <div>
            <p style={{
              fontSize: '8px', textTransform: 'uppercase' as const,
              letterSpacing: '0.18em', color: 'rgba(255,255,255,0.4)',
              margin: 0, lineHeight: 1, textAlign: 'right' as const
            }}>Swipe right</p>
            <p style={{
              fontSize: '10px',
              color: '#ffffff',
              margin: '3px 0 0', lineHeight: 1,
              fontWeight: 700, textAlign: 'right' as const
            }}>Save outfit</p>
          </div>
          <div style={{
            width: '28px', height: '28px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            animation: 'hint-nudge-right 2s ease-in-out infinite'
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 6l4-4M3 6l4 4M3 6h7"
                stroke="rgba(255,255,255,0.9)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

      </div>
    </>
  )
}
