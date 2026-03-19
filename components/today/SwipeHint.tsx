'use client'
import { useEffect, useState } from 'react'

export default function SwipeHint() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem('altfit_swipe_hint_v1')
    if (!seen) {
      const showTimer = setTimeout(() => setVisible(true), 1000)
      const hideTimer = setTimeout(() => {
        setVisible(false)
        localStorage.setItem('altfit_swipe_hint_v1', 'true')
      }, 5000)
      return () => {
        clearTimeout(showTimer)
        clearTimeout(hideTimer)
      }
    }
  }, [])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 999,
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      backgroundColor: 'rgba(28, 25, 23, 0.85)',
      backdropFilter: 'blur(8px)',
      padding: '12px 24px',
      borderRadius: '40px',
      animation: 'altfit-fadein 0.5s ease',
      pointerEvents: 'none'
    }}>
      {/* Left arrow animation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        animation: 'altfit-slide-left 1.5s ease-in-out infinite'
      }}>
        <span style={{ color: '#a8a29e', fontSize: '14px' }}>←</span>
        <span style={{
          fontSize: '10px', textTransform: 'uppercase',
          letterSpacing: '0.12em', color: '#a8a29e'
        }}>Skip</span>
      </div>

      <div style={{
        width: '1px', height: '16px',
        backgroundColor: 'rgba(255,255,255,0.15)'
      }} />

      {/* Right arrow animation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        animation: 'altfit-slide-right 1.5s ease-in-out infinite'
      }}>
        <span style={{
          fontSize: '10px', textTransform: 'uppercase',
          letterSpacing: '0.12em', color: '#ffffff',
          fontWeight: 600
        }}>Save</span>
        <span style={{ color: '#ffffff', fontSize: '14px' }}>→</span>
      </div>
    </div>
  )
}
