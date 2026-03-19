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
      bottom: '36px',
      left: '50%',
      transform: `translateX(-50%) translateY(${visible ? '0px' : '20px'}) scale(${visible ? 1 : 0.92})`,
      opacity: visible ? 1 : 0,
      transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      zIndex: 9999,
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      background: type === 'save' ? '#1c1917' : '#ffffff',
      color: type === 'save' ? '#ffffff' : '#78716c',
      border: type === 'save' ? 'none' : '1px solid #e7e5e4',
      padding: '11px 22px 11px 18px',
      boxShadow: type === 'save'
        ? '0 12px 40px rgba(0,0,0,0.25)'
        : '0 8px 30px rgba(0,0,0,0.10)',
      whiteSpace: 'nowrap' as const
    }}>
      {/* Icon */}
      <div style={{
        width: '20px', height: '20px',
        borderRadius: '50%',
        background: type === 'save'
          ? 'rgba(255,255,255,0.15)'
          : 'rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        {type === 'save' ? (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M2 5.5l2.5 2.5L9 3"
              stroke="white" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M9 5.5H2M2 5.5l3-3M2 5.5l3 3"
              stroke="#78716c" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* Message */}
      <span style={{
        fontSize: '10px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.16em',
        fontWeight: 700
      }}>
        {message}
      </span>
    </div>
  )
}
