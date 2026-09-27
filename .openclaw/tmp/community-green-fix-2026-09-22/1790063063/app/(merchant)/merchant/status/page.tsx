"use client";
import { useState, useEffect } from 'react';

const version = 'v5.0';

interface Merchant {
  id: string;
  name: string;
  category: string;
  phone: string;
  address: string;
  desc: string;
  services: string;
  submittedAt: string;
  status: 'pending' | 'contacted' | 'proposal_sent' | 'confirmed' | 'online';
}

interface Booking {
  id: string;
  merchantId: string;
  merchantName: string;
  date: string;
  timeSlot: string;
  customerName: string;
  customerPhone: string;
  note: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

const statusConfig = {
  pending: { label: '待联系', step: 1, color: 'amber', bg: 'bg-amber-500', text: 'text-white', icon: '📞' },
  contacted: { label: '已电话', step: 2, color: 'blue', bg: 'bg-blue-500', text: 'text-white', icon: '☎️' },
  proposal_sent: { label: '方案已发', step: 3, color: 'purple', bg: 'bg-purple-500', text: 'text-white', icon: '📨' },
  confirmed: { label: '待确认', step: 4, color: 'orange', bg: 'bg-orange-500', text: 'text-white', icon: '✅' },
  online: { label: '已上线', step: 5, color: 'green', bg: 'bg-green-500', text: 'text-white', icon: '🎉' },
};

const bookingStatusConfig = {
  pending: { label: '待确认', color: 'amber', bg: 'bg-amber-500', text: 'text-white' },
  confirmed: { label: '已确认', color: 'blue', bg: 'bg-blue-500', text: 'text-white' },
  completed: { label: '已完成', color: 'green', bg: 'bg-green-500', text: 'text-white' },
  cancelled: { label: '已取消', color: 'red', bg: 'bg-red-500', text: 'text-white' },
};

const nextStatus = {
  pending: 'contacted',
  contacted: 'proposal_sent',
  proposal_sent: 'confirmed',
  confirmed: 'online',
  online: 'online',
};

const categoryMap: Record<string, string> = {
  meifa: '美发', canyin: '餐饮', yimei: '医美', jiaoyu: '教育', jianshen: '健身', qita: '其他'
};

export default function MerchantStatus() {
  const [view, setView] = useState<'merchant' | 'admin' | 'bookings'>('merchant');
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [found, setFound] = useState<Merchant | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchMerchants = () => {
    fetch('/api/merchant/list')
      .then(r => r.json())
      .then(data => {
        if (data.success) setMerchants(data.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const fetchBookings = () => {
    fetch('/api/booking/list')
      .then(r => r.json())
      .then(data => {
        if (data.success) setBookings(data.data);
      })
      .catch(() => {});
  };

  useEffect(() => { 
    fetchMerchants(); 
    fetchBookings();
  }, []);

  const updateStatus = (id: string, newStatus: string) => {
    setUpdating(id);
    fetch('/api/merchant/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setMerchants(prev => prev.map(m => m.id === id ? { ...m, status: newStatus as Merchant['status'] } : m));
        }
        setUpdating(null);
      })
      .catch(() => setUpdating(null));
  };

  const updateBookingStatus = (id: string, newStatus: string) => {
    fetch('/api/booking', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus as Booking['status'] } : b));
        }
      })
      .catch(() => {});
  };

  const prevStatus = {
    online: 'confirmed',
    confirmed: 'proposal_sent',
    proposal_sent: 'contacted',
    contacted: 'pending',
    pending: 'pending',
  };

  const quickAdvance = (m: Merchant) => {
    const next = nextStatus[m.status];
    if (next !== m.status) {
      updateStatus(m.id, next);
    }
  };

  const quickBack = (m: Merchant) => {
    const prev = prevStatus[m.status];
    if (prev !== m.status) {
      updateStatus(m.id, prev);
    }
  };

  const searchByPhone = () => {
    if (!phone.trim()) return;
    const merchant = merchants.find(m => m.phone === phone);
    if (merchant) { setFound(merchant); setNotFound(false); }
    else { setFound(null); setNotFound(true); }
  };

  const filteredMerchants = merchants.filter(m => filter === 'all' || m.status === filter);
  
  // 过滤预约：只看pending和confirmed状态
  const activeBookings = bookings.filter(b => b.status === 'pending' || b.status === 'confirmed');

  const stats = {
    total: merchants.length,
    pending: merchants.filter(m => m.status === 'pending').length,
    contacted: merchants.filter(m => m.status === 'contacted').length,
    proposal_sent: merchants.filter(m => m.status === 'proposal_sent').length,
    confirmed: merchants.filter(m => m.status === 'confirmed').length,
    online: merchants.filter(m => m.status === 'online').length,
    bookingCount: activeBookings.length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8" style={{ paddingTop: 'max(16px, env(safe-area-inset-top, 16px))', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">商户进度查询</h1>
          <p className="text-sm md:text-base text-slate-400">查询入驻申请进度</p>
        </div>

        <div className="flex justify-center gap-2 mb-6 md:mb-8 flex-wrap">
          <button onClick={() => setView('merchant')} className={`px-4 md:px-6 py-2.5 md:py-3 text-sm md:text-base rounded-xl font-medium transition-all ${view === 'merchant' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
            👤 商户查询
          </button>
          <button onClick={() => setView('admin')} className={`px-4 md:px-6 py-2.5 md:py-3 text-sm md:text-base rounded-xl font-medium transition-all ${view === 'admin' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
            ⚙️ 管理后台
          </button>
          <button onClick={() => setView('bookings')} className={`px-4 md:px-6 py-2.5 md:py-3 text-sm md:text-base rounded-xl font-medium transition-all ${view === 'bookings' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
            📅 预约 {stats.bookingCount > 0 && <span className="ml-1 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{stats.bookingCount}</span>}
          </button>
        </div>

        {/* 商户查询视图 */}
        {view === 'merchant' && (
          <div>
            <div className="glass-dark rounded-2xl p-4 md:p-6 mb-6">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} className="md:[flex-direction:row] md:gap-4">
                <input type="tel" inputMode="numeric" pattern="[0-9]*" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchByPhone()} placeholder="输入手机号查询" style={{ flex: 1, padding: '14px 16px', fontSize: 16, borderRadius: 12, background: '#1e293b', color: '#fff', border: '1px solid rgba(184, 134, 11,0.3)', outline: 'none', minHeight: 48, boxSizing: 'border-box' }} />
                <button onClick={searchByPhone} style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: '#10b981', color: '#fff', fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer', minHeight: 48 }} className="md:w-auto md:px-8 hover:bg-emerald-600 transition-colors">
                  查询
                </button>
              </div>
            </div>

            {found && (
              <div className="glass-dark rounded-2xl p-6">
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400 text-sm">申请进度</span>
                    <span className="text-emerald-400 text-sm font-medium">{statusConfig[found.status].step}/5</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" style={{ width: `${(statusConfig[found.status].step / 5) * 100}%` }} />
                  </div>
                </div>
                <div className="flex justify-between mb-6 px-2">
                  {[1,2,3,4,5].map(step => {
                    const isActive = statusConfig[found.status].step >= step;
                    return (
                      <div key={step} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${isActive ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'}`}>{step}</div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{statusConfig[found.status].icon}</span>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white">{found.name}</h2>
                    <p className="text-slate-400 text-sm">{categoryMap[found.category] || found.category}</p>
                  </div>
                  <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusConfig[found.status].bg} ${statusConfig[found.status].text}`}>
                    {statusConfig[found.status].label}
                  </span>
                </div>
                <div className="space-y-2 text-slate-300 mb-4">
                  <p>📱 {found.phone}</p>
                  <p>📍 {found.address || '未填写'}</p>
                  <p>⏰ 提交时间：{new Date(found.submittedAt).toLocaleDateString('zh-CN')}</p>
                </div>
                <div className={`p-4 rounded-xl ${statusConfig[found.status].bg}`}>
                  <p className={statusConfig[found.status].text}>
                    {statusConfig[found.status].label === '待联系' ? '我们已收到您的申请，预计1-2个工作日内联系您，请保持电话畅通' : 
                     statusConfig[found.status].label === '已电话' ? '我们已联系过您，正在了解您的需求，为您准备专属方案' :
                     statusConfig[found.status].label === '方案已发' ? '专属网站方案已发送给您，请查收' :
                     statusConfig[found.status].label === '待确认' ? '方案已确认，正在进行最后调整，准备上线' :
                     '恭喜！您的网站已正式上线！可以分享给客户了'}
                  </p>
                </div>
              </div>
            )}

            {notFound && (
              <div className="glass-dark rounded-2xl p-8 text-center">
                <p className="text-slate-400 mb-2">未找到该手机号的申请记录</p>
                <p className="text-slate-500 text-sm">请确认手机号是否正确</p>
              </div>
            )}
          </div>
        )}

        {/* 管理后台视图 */}
        {view === 'admin' && (
          <div>
            <div className="glass-dark rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between overflow-x-auto">
                <div className="text-center px-3">
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                  <p className="text-slate-400 text-xs">全部</p>
                </div>
                <div className="text-slate-600">→</div>
                <div className="text-center px-3">
                  <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
                  <p className="text-slate-400 text-xs">待联系</p>
                </div>
                <div className="text-slate-600">→</div>
                <div className="text-center px-3">
                  <p className="text-2xl font-bold text-blue-400">{stats.contacted}</p>
                  <p className="text-slate-400 text-xs">已电话</p>
                </div>
                <div className="text-slate-600">→</div>
                <div className="text-center px-3">
                  <p className="text-2xl font-bold text-purple-400">{stats.proposal_sent}</p>
                  <p className="text-slate-400 text-xs">方案已发</p>
                </div>
                <div className="text-slate-600">→</div>
                <div className="text-center px-3">
                  <p className="text-2xl font-bold text-orange-400">{stats.confirmed}</p>
                  <p className="text-slate-400 text-xs">待确认</p>
                </div>
                <div className="text-slate-600">→</div>
                <div className="text-center px-3">
                  <p className="text-2xl font-bold text-green-400">{stats.online}</p>
                  <p className="text-slate-400 text-xs">已上线</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mb-4 flex-wrap">
              {[{ key: 'all', label: '全部' }, { key: 'pending', label: '📞 待联系' }, { key: 'contacted', label: '☎️ 已电话' }, { key: 'proposal_sent', label: '📨 方案已发' }, { key: 'confirmed', label: '✅ 待确认' }, { key: 'online', label: '🎉 已上线' }].map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} className={`px-4 py-2 rounded-lg text-sm transition-all ${filter === f.key ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                  {f.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredMerchants.map(m => (
                <div key={m.id} className="glass-dark rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{statusConfig[m.status].icon}</span>
                      <div>
                        <h3 className="text-white font-medium">{m.name}</h3>
                        <p className="text-slate-400 text-sm">{categoryMap[m.category] || m.category} · {m.phone}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => quickBack(m)}
                        disabled={updating === m.id || m.status === 'pending'}
                        className={`px-3 py-2 rounded-lg text-sm transition-all ${
                          m.status === 'pending'
                            ? 'bg-slate-700 text-slate-600 cursor-not-allowed'
                            : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                        } ${updating === m.id ? 'opacity-50' : ''}`}
                      >
                        ← 回退
                      </button>
                      <button
                        onClick={() => quickAdvance(m)}
                        disabled={updating === m.id || m.status === 'online'}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          m.status === 'online' 
                            ? 'bg-green-500 text-white cursor-default' 
                            : 'bg-emerald-500 text-white hover:bg-emerald-600'
                        } ${updating === m.id ? 'opacity-50' : ''}`}
                      >
                        {updating === m.id ? '更新中...' : m.status === 'online' ? '已上线' : `推进 →`}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-slate-400 text-sm">
                    <span>📍 {m.address || '-'}</span>
                    <span>⏰ {new Date(m.submittedAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                  {m.desc && <p className="text-slate-500 text-sm mt-2">📝 {m.desc}</p>}
                </div>
              ))}
              {filteredMerchants.length === 0 && (
                <div className="glass-dark rounded-xl p-8 text-center text-slate-400">暂无商户数据</div>
              )}
            </div>
          </div>
        )}

        {/* 预约视图 */}
        {view === 'bookings' && (
          <div>
            <div className="glass-dark rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="text-center px-3">
                  <p className="text-2xl font-bold text-amber-400">{bookings.filter(b => b.status === 'pending').length}</p>
                  <p className="text-slate-400 text-xs">待确认</p>
                </div>
                <div className="text-center px-3">
                  <p className="text-2xl font-bold text-blue-400">{bookings.filter(b => b.status === 'confirmed').length}</p>
                  <p className="text-slate-400 text-xs">已确认</p>
                </div>
                <div className="text-center px-3">
                  <p className="text-2xl font-bold text-green-400">{bookings.filter(b => b.status === 'completed').length}</p>
                  <p className="text-slate-400 text-xs">已完成</p>
                </div>
                <div className="text-center px-3">
                  <p className="text-2xl font-bold text-slate-400">{bookings.length}</p>
                  <p className="text-slate-400 text-xs">全部</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {activeBookings.map(b => (
                <div key={b.id} className="glass-dark rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📅</span>
                      <div>
                        <h3 className="text-white font-medium">{b.merchantName}</h3>
                        <p className="text-slate-400 text-sm">{b.date} {b.timeSlot}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${bookingStatusConfig[b.status].bg} ${bookingStatusConfig[b.status].text}`}>
                      {bookingStatusConfig[b.status].label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-slate-400 text-sm">
                      <p>👤 {b.customerName || '匿名'} {b.customerPhone}</p>
                    </div>
                    <div className="flex gap-2">
                      {b.status === 'pending' && (
                        <>
                          <button
                            onClick={() => updateBookingStatus(b.id, 'cancelled')}
                            className="px-3 py-1 rounded-lg text-sm bg-slate-700 text-slate-300 hover:bg-slate-600"
                          >
                            拒绝
                          </button>
                          <button
                            onClick={() => updateBookingStatus(b.id, 'confirmed')}
                            className="px-3 py-1 rounded-lg text-sm bg-emerald-500 text-white hover:bg-emerald-600"
                          >
                            确认
                          </button>
                        </>
                      )}
                      {b.status === 'confirmed' && (
                        <button
                          onClick={() => updateBookingStatus(b.id, 'completed')}
                          className="px-3 py-1 rounded-lg text-sm bg-green-500 text-white hover:bg-green-600"
                        >
                          完成
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {activeBookings.length === 0 && (
                <div className="glass-dark rounded-xl p-8 text-center text-slate-400">
                  暂无待处理预约
                </div>
              )}
            </div>
          </div>
        )}

        {loading && <div className="text-center py-8 text-slate-400">加载中...</div>}
      </div>
    </div>
  );
}