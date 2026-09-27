'use client';

import { useState } from 'react';

export default function LandingPage() {
  const [step, setStep] = useState(0);
  
  const demoSteps = [
    {
      role: '用户',
      avatar: '👤',
      text: '我是圆脸，头发细软少，想换个显脸小的发型，能给点建议吗？',
    },
    {
      role: '造型师 AI',
      avatar: '🌿',
      text: '家里有老人吗？有忌口的吗（糖尿病/孕期）？平时偏好酸的还是甜的？',
    },
    {
      role: '用户',
      avatar: '👤',
      text: '没有老人，没忌口，酸甜都行。',
    },
    {
      role: '造型师 AI',
      avatar: '🌿',
      text: '推荐：侧分短发（视觉拉长脸型）+ 微卷刘海（修饰额头）+ 亚麻棕染发（提亮气色）。⚠️ 上次你染的是深栗色，这次建议先用 1 次去黄洗发水过渡，避免色差断层。',
    },
  ];

  return (
    <main style={{
      minHeight: '100dvh',
      background: 'linear-gradient(180deg, #2c1810 0%, #2c1810 100%)',
      color: 'var(--text)',
    }}>
      {/* Hero */}
      <section style={{
        padding: '80px 20px 60px',
        textAlign: 'center',
        maxWidth: '900px',
        margin: '0 auto',
      }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 14px',
          background: 'rgba(184, 134, 11, 0.1)',
          border: '1px solid var(--glass-border)',
          borderRadius: '20px',
          fontSize: '13px',
          color: 'var(--gold)',
          marginBottom: '24px',
        }}>
          💇 造型师 AI · 铜仁美发私域 SaaS
        </div>
        
        <h1 style={{
          fontSize: '48px',
          fontWeight: 800,
          lineHeight: 1.2,
          marginBottom: '20px',
          background: 'linear-gradient(135deg, #fffaf0 0%, #b8860b 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          让每位顾客<br/>都有自己的 造型师
        </h1>
        
        <p style={{
          fontSize: '18px',
          color: 'var(--text-secondary)',
          marginBottom: '40px',
          lineHeight: 1.7,
        }}>
          顾客扫码 → AI 问诊 → 自动开方 → 复购提醒<br/>
          一套系统，把"美团"和"骑手"留在你自己的店里。
        </p>
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#demo" style={{
            padding: '14px 32px',
            background: 'linear-gradient(135deg, #b8860b 0%, #8b6508 100%)',
            color: '#2c1810',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '16px',
          }}>
            👀 看 30 秒演示
          </a>
          <a href="#merchant" style={{
            padding: '14px 32px',
            background: 'rgba(184, 134, 11, 0.1)',
            border: '1px solid var(--glass-border)',
            color: 'var(--gold)',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '16px',
          }}>
            💼 我是商户
          </a>
        </div>
      </section>

      {/* Demo */}
      <section id="demo" style={{
        padding: '60px 20px',
        maxWidth: '700px',
        margin: '0 auto',
      }}>
        <h2 style={{
          fontSize: '32px',
          fontWeight: 700,
          textAlign: 'center',
          marginBottom: '12px',
        }}>
          📱 30 秒看 造型师怎么用
        </h2>
        <p style={{
          textAlign: 'center',
          color: 'var(--text-muted)',
          marginBottom: '40px',
        }}>
          真实对话场景 · 不是录屏，是真跑通的 demo
        </p>

        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--glass-border)',
          borderRadius: '20px',
          padding: '24px',
          minHeight: '300px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {demoSteps.slice(0, step + 1).map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '16px',
              flexDirection: msg.role === '用户' ? 'row-reverse' : 'row',
              animation: 'slideIn 0.4s ease',
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: msg.role === '用户' ? 'rgba(244, 114, 182, 0.15)' : 'rgba(184, 134, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0,
              }}>
                {msg.avatar}
              </div>
              <div style={{
                maxWidth: '70%',
                padding: '12px 16px',
                background: msg.role === '用户' ? 'rgba(244, 114, 182, 0.1)' : 'rgba(184, 134, 11, 0.08)',
                borderRadius: '12px',
                fontSize: '15px',
                lineHeight: 1.6,
              }}>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                }}>
                  {msg.role}
                </div>
                {msg.text}
              </div>
            </div>
          ))}
          
          {step < demoSteps.length - 1 && (
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
            }}>
              <button
                onClick={() => setStep(step + 1)}
                style={{
                  padding: '10px 24px',
                  background: 'rgba(184, 134, 11, 0.15)',
                  border: '1px solid var(--gold)',
                  color: 'var(--gold)',
                  borderRadius: '20px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                下一步 →
              </button>
            </div>
          )}
        </div>
        
        {step >= demoSteps.length - 1 && (
          <div style={{
            textAlign: 'center',
            marginTop: '24px',
            padding: '16px',
            background: 'rgba(184, 134, 11, 0.1)',
            borderRadius: '12px',
            color: 'var(--green)',
            fontSize: '14px',
          }}>
            ✅ 真跑通的 demo · 可以扫码亲自试
          </div>
        )}
      </section>

      {/* 商户价值 */}
      <section id="merchant" style={{
        padding: '80px 20px',
        maxWidth: '1000px',
        margin: '0 auto',
      }}>
        <h2 style={{
          fontSize: '36px',
          fontWeight: 700,
          textAlign: 'center',
          marginBottom: '12px',
        }}>
          💼 商户版 · 每天省 3 小时人工
        </h2>
        <p style={{
          textAlign: 'center',
          color: 'var(--text-muted)',
          marginBottom: '48px',
        }}>
          一个理发店老板一天的真实时间账
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
        }}>
          {[
            { emoji: '💇', title: '发型推荐', desc: 'AI 7×24 自动推荐发型，脸型匹配/染发配色/护理方案/预约提醒 什么需求配什么造型' },
            { emoji: '🛒', title: '复购提醒', desc: '顾客上次买了草莓，3 天后自动发"吃完了吗？要不要再来一盒？"' },
            { emoji: '📊', title: '顾客画像', desc: '每个顾客的购买记录、口味偏好、家庭结构（几口人/有小孩/老人），全在 AI 脑子里' },
            { emoji: '🚚', title: '本地配送', desc: '美团抽成 15-25%，你只用给骑手 5 元，剩下都是你的' },
            { emoji: '📱', title: '私域流量', desc: '顾客从"路过买一次"变成"绑定在你这"，不再被美团抢走' },
            { emoji: '⚡', title: '5 分钟接入', desc: '扫码即用，不需要换系统、不需要培训员工' },
          ].map((f, i) => (
            <div key={i} style={{
              padding: '20px',
              background: 'var(--bg-card)',
              border: '1px solid var(--glass-border)',
              borderRadius: '16px',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>{f.emoji}</div>
              <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '16px' }}>{f.title}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* 价格 */}
        <div style={{
          marginTop: '60px',
          padding: '40px',
          background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.08) 0%, rgba(184, 134, 11, 0.04) 100%)',
          border: '1px solid var(--glass-border)',
          borderRadius: '24px',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '14px',
            color: 'var(--gold)',
            marginBottom: '12px',
            letterSpacing: '1px',
          }}>
            首月体验价
          </div>
          <div style={{
            fontSize: '64px',
            fontWeight: 800,
            color: 'var(--gold)',
            marginBottom: '8px',
          }}>
            ¥99<span style={{ fontSize: '24px', color: 'var(--text-secondary)' }}>/月</span>
          </div>
          <div style={{
            fontSize: '15px',
            color: 'var(--text-secondary)',
            marginBottom: '24px',
          }}>
            不到一个店员一天工资 · 对赌协议：30 天没效果全额退
          </div>
          <a href="https://example.com/contact" style={{
            display: 'inline-block',
            padding: '14px 32px',
            background: 'linear-gradient(135deg, #b8860b 0%, #8b6508 100%)',
            color: '#2c1810',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '16px',
          }}>
            📞 联系奕霖：185-3856-7187
          </a>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginTop: '12px',
          }}>
            贵州铜仁 · 奕霖（创始人本人对接）
          </div>
        </div>
      </section>

      {/* 对比美团 */}
      <section style={{
        padding: '80px 20px',
        maxWidth: '900px',
        margin: '0 auto',
      }}>
        <h2 style={{
          fontSize: '36px',
          fontWeight: 700,
          textAlign: 'center',
          marginBottom: '48px',
        }}>
          🆚 跟美团对比
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
        }}>
          <div style={{
            padding: '24px',
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid rgba(244, 114, 182, 0.2)',
          }}>
            <div style={{
              fontSize: '14px',
              color: 'var(--accent)',
              marginBottom: '12px',
            }}>
              ❌ 美团 / 京东到家
            </div>
            <ul style={{ listStyle: 'none', padding: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 2 }}>
              <li>· 每单抽成 15-25%</li>
              <li>· 顾客是平台的，不是你的</li>
              <li>· 骑手被困在算法里</li>
              <li>· 你帮平台打工</li>
              <li>· 一停活动量就归零</li>
            </ul>
          </div>

          <div style={{
            padding: '24px',
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--glass-border)',
          }}>
            <div style={{
              fontSize: '14px',
              color: 'var(--gold)',
              marginBottom: '12px',
            }}>
              ✅ 造型师 AI 私域
            </div>
            <ul style={{ listStyle: 'none', padding: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 2 }}>
              <li>· 月租 ¥99，没有抽成</li>
              <li>· 顾客是你的，加微信永久绑定</li>
              <li>· 骑手自己接单，活得有人样</li>
              <li>· 数据在你手里</li>
              <li>· 越用越值钱，复购率会涨</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '13px',
        borderTop: '1px solid var(--glass-border)',
        marginTop: '60px',
      }}>
        <div style={{ marginBottom: '8px' }}>
          💇 造型师 AI · 让每位顾客都有自己的造型师
        </div>
        <div>
          奕霖 185-3856-7187 · 贵州铜仁 · 创始人对接
        </div>
      </footer>

      <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}