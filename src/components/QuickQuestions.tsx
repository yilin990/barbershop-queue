'use client'

interface QuickQuestionsProps {
  onSelect: (q: string) => void
}

const QUESTIONS = [
  { label: '我的脸型适合什么发型？', icon: '💇' },
  { label: '染发怎么选色不踩雷？', icon: '🎨' },
  { label: '男生短发推荐', icon: '✂️' },
  { label: '门店在哪里？', icon: '📍' },
  { label: '会员卡怎么办？', icon: '🎫' },
  { label: '女士长发造型', icon: '💁‍♀️' },
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
            background: 'rgba(122, 90, 10, 0.15)',
            border: '1px solid rgba(122, 90, 10, 0.35)',
            borderRadius: '20px',
            fontSize: '13px',
            color: '#7a5a0a',
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
              'rgba(122, 90, 10, 0.32)'
            ;(e.currentTarget as HTMLButtonElement).style.transform =
              'translateY(-2px)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 4px 12px rgba(0,0,0,0.2)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background =
              'rgba(122, 90, 10, 0.15)'
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