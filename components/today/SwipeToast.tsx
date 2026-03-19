'use client'

interface SwipeToastProps {
  message: string
  type: 'save' | 'skip'
  visible: boolean
}

export default function SwipeToast({ message, type, visible }: SwipeToastProps) {
  return (
    <div style={{
      position: 'fixed',
      bottom: '32px',
      left: '50%',
      transform: `translateX(-50%) translateY(${visible ? '0' : '20px'})`,
      opacity: visible ? 1 : 0,
      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      zIndex: 1000,
      pointerEvents: 'none',
      backgroundColor: type === 'save' ? '#1c1917' : '#f5f3f0',
      color: type === 'save' ? '#ffffff' : '#78716c',
      padding: '10px 20px',
      fontSize: '11px',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      fontWeight: 500,
      border: type === 'save' ? 'none' : '1px solid #e7e5e4',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      whiteSpace: 'nowrap'
    }}>
      {message}
    </div>
  )
}
