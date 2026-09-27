'use client'

interface QuickQuestionsProps {
  onSelect: (q: string) => void
}

const QUESTIONS = [
  { label: '应季水果怎么选？', icon: '🍎' },
  { label: '有机 vs 普通蔬菜', icon: '🥬' },
  { label: '宝宝辅食食材', icon: '👶' },
  { label: '门店地址', icon: '📍' },
  { label: '会员权益', icon: '🎫' },
  { label: '老人软食推荐', icon: '🌾' },
]

export default function QuickQuestions({ onSelect }: QuickQuestionsProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        padding: '4px 012px',
      }}
    >
      {QUESTIONS.map((q, i) => (
        <button
          key={i}
          onClick={() => onSelect(q.label)}
          style={{
            padding: '8px 14px',
            background: 'rgba(184, 134, 11, 0.08)',
            border: '1px solid rgba(184, 134, 11, 0.2)',
            borderRadius: '20px',
            fontSize: '13px',
            color: '#b8860b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background =
              'rgba(184, 134, 11, 0.18)'
            ;(e.currentTarget as HTMLButtonElement).style.transform =
              'translateY(-2px)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 4px 12px rgba(0,0,0,0.2)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background =
              'rgba(184, 134, 11, 0.08)'
            ;(e.currentTarget as HTMLButtonElement).style.transform =
              'translateY(0)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
          }}
        >
         <span>{q.icon}</span>
          <span>{q.label}</span>
        </button>
      ))}
    </div>
  )
}