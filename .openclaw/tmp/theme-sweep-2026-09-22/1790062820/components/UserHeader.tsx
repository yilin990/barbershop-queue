'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUserStore } from '@/stores/userStore'
import LoginModal from './LoginModal'
import Link from 'next/link'

export default function UserHeader() {
  const [showLogin, setShowLogin] = useState(false)
  const { user, isLoggedIn, logout } = useUserStore()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push('/merchant')
  }

  return (
    <>
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />

      {isLoggedIn && user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link href="/me" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(127, 220, 148, 0.3) 0%, rgba(127, 220, 148, 0.1) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              border: '2px solid rgba(127, 220, 148, 0.3)',
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.3)',
            }}>
              {user.avatar}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', letterSpacing: '0.5px' }}>
                {user.nickname}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(127, 220, 148, 0.6)' }}>点击进入我的</div>
            </div>
          </Link>
        </div>
      ) : (
        <button
          onClick={() => setShowLogin(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '20px',
            border: '1px solid rgba(127, 220, 148, 0.25)',
            background: 'linear-gradient(135deg, rgba(127, 220, 148, 0.15) 0%, rgba(127, 220, 148, 0.06) 100%)',
            color: '#fbbf24',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.5px',
            transition: 'all 0.3s ease',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.2)',
          }}
        >
          <span style={{ fontSize: '16px' }}>👤</span> 登录
        </button>
      )}
    </>
  )
}