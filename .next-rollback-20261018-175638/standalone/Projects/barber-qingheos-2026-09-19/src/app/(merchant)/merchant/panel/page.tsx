"use client";
import { toast } from '@/lib/ui-bus'
import { useState, useEffect } from 'react';

const version = 'v1.0';

interface Merchant {
  id: string;
  name: string;
  category: string;
  phone: string;
  address: string;
  desc: string;
  services: string;
  style: string;
  status: string;
}

const categoryMap: Record<string, string> = {
  meifa: '美发', canyin: '餐饮', yimei: '医美', jiaoyu: '教育', jianshen: '健身', qita: '其他'
};

const styles = [
  { id: 'warm', name: '暖色系', bg: 'bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-500', text: 'text-white' },
  { id: 'cool', name: '冷色系', bg: 'bg-gradient-to-br from-cyan-400 via-blue-400 to-indigo-500', text: 'text-white' },
  { id: 'dark', name: '深色系', bg: 'bg-gradient-to-br from-slate-700 via-gray-800 to-zinc-900', text: 'text-white' },
  { id: 'light', name: '浅色系', bg: 'bg-gradient-to-br from-slate-100 via-white to-slate-200', text: 'text-gray-800' },
];

export default function MerchantPanel() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selected, setSelected] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<Partial<Merchant>>({});
  const [phone, setPhone] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    fetchMerchants();
  }, []);

  const fetchMerchants = () => {
    fetch('/api/merchant/list')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setMerchants(data.data);
          setLoading(false);
        }
      });
  };

  const handleLogin = () => {
    const merchant = merchants.find(m => m.phone === phone);
    if (merchant) {
      setSelected(merchant);
      setEditData(merchant);
      setLoggedIn(true);
    } else {
      toast.info('未找到该手机号的商户信息');
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    
    try {
      const res = await fetch('/api/merchant/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, ...editData }),
      }).then(r => r.json());

      if (res.success) {
        toast.success('✅ 保存成功！');
        fetchMerchants();
        setSelected({ ...selected, ...editData });
      } else {
        toast.error('❌ 保存失败');
      }
    } catch (err) {
      toast.error('❌ 网络错误');
    }
    
    setSaving(false);
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setSelected(null);
    setEditData({});
    setPhone('');
  };

  // 未登录：手机号登录
  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">商户后台</h1>
            <p className="text-slate-400">输入手机号登录管理您的店铺</p>
          </div>
          
          <div className="glass-dark rounded-2xl p-6">
            <div className="mb-4">
              <label className="block text-white text-sm font-medium mb-2">手机号</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="请输入手机号"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={handleLogin}
              className="w-full py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors"
            >
              登录
            </button>
          </div>

          {loading && <div className="text-center text-slate-400 mt-8">加载中...</div>}
          
          {!loading && merchants.length > 0 && (
            <div className="mt-8">
              <p className="text-slate-500 text-sm text-center mb-4">测试账号（直接点击登录）：</p>
              <div className="space-y-2">
                {merchants.slice(0, 3).map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSelected(m); setEditData(m); setLoggedIn(true); }}
                    className="w-full p-3 rounded-xl bg-slate-800/50 text-left hover:bg-slate-800 transition-colors"
                  >
                    <p className="text-white font-medium">{m.name}</p>
                    <p className="text-slate-400 text-sm">{m.phone}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 已登录：编辑商户信息
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">商户后台</h1>
            <p className="text-slate-400">编辑您的店铺信息</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors text-sm"
          >
            退出登录
          </button>
        </div>

        {/* 基本信息 */}
        <div className="glass-dark rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">基本信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-sm mb-2">店铺名称</label>
              <input
                type="text"
                value={editData.name || ''}
                onChange={e => setEditData({...editData, name: e.target.value})}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2">联系电话</label>
              <input
                type="tel"
                value={editData.phone || ''}
                onChange={e => setEditData({...editData, phone: e.target.value})}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-slate-400 text-sm mb-2">店铺地址</label>
              <input
                type="text"
                value={editData.address || ''}
                onChange={e => setEditData({...editData, address: e.target.value})}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-slate-400 text-sm mb-2">店铺描述</label>
              <textarea
                value={editData.desc || ''}
                onChange={e => setEditData({...editData, desc: e.target.value})}
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 text-white resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* 服务项目 */}
        <div className="glass-dark rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">服务项目</h2>
          <p className="text-slate-400 text-sm mb-4">格式：服务名 ¥价格，用竖线分隔</p>
          <textarea
            value={editData.services || ''}
            onChange={e => setEditData({...editData, services: e.target.value})}
            placeholder="例如：洗剪吹 ¥38|烫发 ¥288|染发 ¥168"
            rows={4}
            className="w-full px-4 py-3 rounded-xl bg-slate-800 text-white resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* 风格选择 */}
        <div className="glass-dark rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">网站风格</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {styles.map(style => (
              <button
                key={style.id}
                onClick={() => setEditData({...editData, style: style.id})}
                className={`p-4 rounded-xl ${style.bg} ${editData.style === style.id ? 'ring-4 ring-emerald-400' : ''} transition-all hover:scale-105`}
              >
                <p className={`font-medium ${style.text}`}>{style.name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 保存按钮 */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
            saving 
              ? 'bg-slate-700 text-slate-400' 
              : 'bg-emerald-500 text-white hover:bg-emerald-600'
          }`}
        >
          {saving ? '保存中...' : '💾 保存修改'}
        </button>
      </div>
    </div>
  );
}