"use client";
import { toast } from '@/lib/ui-bus'
import { useState, useEffect } from 'react';

const version = 'v3.0';

interface Merchant {
  id: string;
  name: string;
  category: string;
  phone: string;
  address: string;
  desc: string;
  services: string;
  submittedAt: string;
  status: string;
}

interface Service {
  name: string;
  price: string;
}

const categoryMap: Record<string, string> = {
  meifa: '美发', canyin: '餐饮', yimei: '医美', jiaoyu: '教育', jianshen: '健身', qita: '其他'
};

// 行业配图
const categoryImages: Record<string, string> = {
  meifa: '/merchant-assets/meifa_salon.png',
  canyin: '/merchant-assets/canyin_restaurant.png',
  yimei: '/merchant-assets/yimei_clinic.png',
  jiaoyu: '/merchant-assets/jiaoyu_center.png',
  jianshen: '/merchant-assets/jianshen_gym.png',
  qita: '/merchant-assets/meifa_salon.png',
};

// 行业风格配置
const categoryConfig: Record<string, {
  gradient: string;
  icon: string;
  iconBg: string;
  titleColor: string;
  descColor: string;
  cardBg: string;
  highlight: string;
  servicesTitle: string;
  cta: string;
  ctaIcon: string;
  tags: string[];
  decor: string;
}> = {
  meifa: { 
    gradient: 'from-rose-400 via-pink-400 to-fuchsia-500',
    icon: '✂️',
    iconBg: 'bg-rose-500',
    titleColor: 'text-white',
    descColor: 'text-white/80',
    cardBg: 'bg-white/15',
    highlight: 'rgba(255,255,255,0.25)',
    servicesTitle: '✂️ 服务项目',
    cta: '立即预约',
    ctaIcon: '📞',
    tags: ['💇 专业发型', '✨ 时尚造型', '💆 焕新体验'],
    decor: 'bg-rose-300/30',
  },
  canyin: { 
    gradient: 'from-orange-400 via-amber-400 to-yellow-500',
    icon: '🍜',
    iconBg: 'bg-orange-500',
    titleColor: 'text-white',
    descColor: 'text-white/80',
    cardBg: 'bg-white/15',
    highlight: 'rgba(255,255,255,0.25)',
    servicesTitle: '🍜 招牌推荐',
    cta: '查看位置',
    ctaIcon: '📍',
    tags: ['🔥 地道风味', '🥬 精选食材', '🏠 舒适环境'],
    decor: 'bg-orange-300/30',
  },
  yimei: { 
    gradient: 'from-cyan-400 via-blue-400 to-indigo-500',
    icon: '💎',
    iconBg: 'bg-cyan-500',
    titleColor: 'text-white',
    descColor: 'text-white/80',
    cardBg: 'bg-white/15',
    highlight: 'rgba(255,255,255,0.25)',
    servicesTitle: '💎 热门项目',
    cta: '咨询预约',
    ctaIcon: '💬',
    tags: ['💉 专业技术', '🛡️ 安全保障', '🌸 私享空间'],
    decor: 'bg-cyan-300/30',
  },
  jiaoyu: { 
    gradient: 'from-violet-400 via-purple-400 to-fuchsia-500',
    icon: '📚',
    iconBg: 'bg-violet-500',
    titleColor: 'text-white',
    descColor: 'text-white/80',
    cardBg: 'bg-white/15',
    highlight: 'rgba(255,255,255,0.25)',
    servicesTitle: '📚 课程设置',
    cta: '了解更多',
    ctaIcon: '📱',
    tags: ['🎓 精品小班', '📐 因材施教', '🎮 寓教于乐'],
    decor: 'bg-violet-300/30',
  },
  jianshen: { 
    gradient: 'from-emerald-400 via-teal-400 to-cyan-500',
    icon: '💪',
    iconBg: 'bg-emerald-500',
    titleColor: 'text-white',
    descColor: 'text-white/80',
    cardBg: 'bg-white/15',
    highlight: 'rgba(255,255,255,0.25)',
    servicesTitle: '🏋️ 会员课程',
    cta: '预约体验',
    ctaIcon: '🏃',
    tags: ['👨‍🏫 专业教练', '📈 科学训练', '🎯 效果可见'],
    decor: 'bg-emerald-300/30',
  },
  qita: { 
    gradient: 'from-slate-400 via-gray-500 to-zinc-600',
    icon: '🏪',
    iconBg: 'bg-slate-500',
    titleColor: 'text-white',
    descColor: 'text-white/80',
    cardBg: 'bg-white/15',
    highlight: 'rgba(255,255,255,0.25)',
    servicesTitle: '🏪 精选服务',
    cta: '联系我们',
    ctaIcon: '📞',
    tags: ['⭐ 品质保障', '💖 贴心服务', '🤝 值得信赖'],
    decor: 'bg-slate-300/30',
  },
};

const defaultServices: Record<string, Service[]> = {
  meifa: [
    { name: '洗剪吹', price: '¥38' },
    { name: '精致烫发', price: '¥288' },
    { name: '潮流染发', price: '¥168' },
    { name: '深层护理', price: '¥88' },
  ],
  canyin: [
    { name: '招牌套餐', price: '¥68' },
    { name: '特色小炒', price: '¥38' },
    { name: '主食系列', price: '¥28' },
  ],
  yimei: [
    { name: '皮肤管理', price: '¥388' },
    { name: '玻尿酸导入', price: '¥680' },
    { name: '水光针', price: '¥1280' },
  ],
  jiaoyu: [
    { name: '精品课程', price: '¥2000/期' },
    { name: '一对一辅导', price: '¥150/课时' },
  ],
  jianshen: [
    { name: '月卡会员', price: '¥399' },
    { name: '私教课', price: '¥300/节' },
  ],
  qita: [
    { name: '常规服务', price: '¥面议' },
  ],
};

export default function MerchantPreview() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selected, setSelected] = useState<Merchant | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/merchant/list')
      .then(r => r.json())
      .then(data => {
        if (data.success) setMerchants(data.data);
      });
  }, []);

  const generatePreview = (merchant: Merchant) => {
    setGenerating(true);
    setSelected(merchant);
    
    setTimeout(() => {
      setGenerating(false);
      setPreviewUrl(`/merchant/site/${merchant.id}`);
    }, 2500);
  };

  const confirmProposal = async () => {
    if (!selected) return;
    
    try {
      // 1. 更新状态为"方案已发"
      const res = await fetch('/api/merchant/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, status: 'proposal_sent' }),
      }).then(r => r.json());
      
      if (res.success) {
        // 2. 更新本地状态
        setMerchants(prev => prev.map(m => 
          m.id === selected.id ? { ...m, status: 'proposal_sent' } : m
        ));
        setSelected({ ...selected, status: 'proposal_sent' });
        
        // 3. 发送飞书通知
        await fetch('/api/merchant/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '📨 方案已发送',
            content: `商户：${selected.name}\n行业：${categoryName}\n方案预览已生成，请确认后发送给对方`
          }),
        });
        
        toast.info('✅ 方案已确认，状态已更新为"方案已发"');
      }
    } catch (err) {
      console.error(err);
      toast.error('❌ 操作失败');
    }
  };

  const config = selected ? (categoryConfig[selected.category] || categoryConfig.qita) : null;
  
  // 解析商户填写的服务项目，如果没有则用默认示例
  const parseServices = (merchant: Merchant) => {
    if (merchant.services && merchant.services.trim()) {
      // 解析商户填写的服务，格式："服务名 ¥价格|服务名 ¥价格"
      return merchant.services.split('|').map(s => {
        const [name, price] = s.split('¥').map(x => x.trim());
        return { name: name || s, price: price ? `¥${price}` : '' };
      });
    }
    // 没有填写则用默认示例
    return defaultServices[merchant.category] || defaultServices.qita;
  };
  const services = selected ? parseServices(selected) : [];
  const categoryName = selected ? (categoryMap[selected.category] || selected.category) : '';

  return (
    <div className="min-h-screen bg-slate-900">
      {/* 顶部Banner */}
      <div className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700/50 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg flex items-center gap-2">
              <span className="text-2xl">🎨</span>
              商户网站预览生成
            </h1>
            <p className="text-slate-400 text-sm">选择商户，生成专属网站预览</p>
          </div>
          <a 
            href="/merchant/status" 
            className="px-4 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-all text-sm flex items-center gap-2"
          >
            <span>←</span> 返回管理
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* 左侧：商户列表 */}
          <div className="lg:col-span-2">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="text-lg">📋</span> 选择商户
            </h2>
            <div className="space-y-3">
              {merchants.map(m => (
                <div 
                  key={m.id}
                  onClick={() => { setSelected(m); setPreviewUrl(null); }}
                  className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 group ${
                    selected?.id === m.id 
                      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-2 border-emerald-500/50 shadow-lg shadow-emerald-500/20' 
                      : 'bg-slate-800/60 border-2 border-transparent hover:border-slate-600 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl ${categoryConfig[m.category]?.iconBg || 'bg-slate-500'} flex items-center justify-center text-2xl transition-transform group-hover:scale-110`}>
                      {categoryConfig[m.category]?.icon || '🏪'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold truncate">{m.name}</h3>
                      <p className="text-slate-400 text-sm">{categoryMap[m.category] || m.category}</p>
                    </div>
                    <div className={`px-2 py-1 rounded-lg text-xs font-medium ${
                      m.status === 'online' ? 'bg-green-500/20 text-green-400' :
                      m.status === 'proposal_sent' ? 'bg-purple-500/20 text-purple-400' :
                      m.status === 'contacted' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>
                      {m.status === 'online' ? '已上线' :
                       m.status === 'proposal_sent' ? '方案已发' :
                       m.status === 'contacted' ? '已电话' : '待联系'}
                    </div>
                  </div>
                  {m.desc && (
                    <p className="text-slate-500 text-sm mt-2 line-clamp-2">{m.desc}</p>
                  )}
                </div>
              ))}

              {merchants.length === 0 && (
                <div className="text-center text-slate-400 py-12">
                  <div className="text-5xl mb-4 opacity-30">📭</div>
                  <p>暂无商户数据</p>
                </div>
              )}
            </div>
          </div>

          {/* 右侧：预览 */}
          <div className="lg:col-span-3">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="text-lg">✨</span> 网站预览
            </h2>
            
            {!selected && (
              <div className="bg-slate-800/30 rounded-2xl p-12 text-center">
                <div className="text-7xl mb-4 opacity-20 animate-pulse">👈</div>
                <p className="text-slate-400">请先在左侧选择一个商户</p>
              </div>
            )}

            {selected && !generating && !previewUrl && (
              <div className="space-y-4 animate-fadeIn">
                {/* 品牌卡片 */}
                <div className={`relative bg-gradient-to-br ${config?.gradient} rounded-3xl p-8 overflow-hidden`}>
                  {/* 装饰元素 */}
                  <div className={`absolute top-0 right-0 w-40 h-40 ${config?.decor} rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl`} />
                  <div className={`absolute bottom-0 left-0 w-32 h-32 ${config?.decor} rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl`} />
                  
                  <div className="relative">
                    <div className="flex justify-center mb-6">
                      <div className={`w-20 h-20 ${config?.iconBg} rounded-2xl flex items-center justify-center text-4xl shadow-2xl animate-bounce-subtle`}>
                        {config?.icon}
                      </div>
                    </div>
                    
                    <div className="text-center mb-6">
                      <h3 className={`${config?.titleColor} text-3xl font-bold mb-2`}>{selected.name}</h3>
                      <p className={`${config?.descColor}`}>{categoryName} · {selected.address || '门店地址'}</p>
                    </div>
                    
                    {/* 标签 */}
                    <div className="flex justify-center gap-2 flex-wrap mb-6">
                      {config?.tags.map((tag, i) => (
                        <span 
                          key={i} 
                          className={`${config?.highlight} backdrop-blur-sm px-4 py-2 rounded-full text-white/90 text-sm font-medium`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 联系卡片 */}
                <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <a 
                      href={`tel:${selected.phone}`} 
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-500/30"
                    >
                      <span className="text-lg">{config?.ctaIcon}</span>
                      {selected.phone}
                    </a>
                    <a 
                      href={`https://maps.apple.com/?q=${encodeURIComponent(selected.address || '')}`} 
                      target="_blank"
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-700/80 text-white font-semibold hover:bg-slate-600 transition-all"
                    >
                      <span>📍</span>
                      查看地图
                    </a>
                  </div>
                </div>

                {/* 服务项目 */}
                <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4">
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <span>{config?.servicesTitle}</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {services.map((s, i) => (
                      <div 
                        key={i} 
                        className="bg-slate-700/50 rounded-xl p-3 text-center hover:bg-slate-700/70 transition-colors group"
                      >
                        <p className="text-slate-300 text-sm mb-1 group-hover:text-white transition-colors">{s.name}</p>
                        <p className="text-emerald-400 font-bold text-lg">{s.price}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => generatePreview(selected)}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white font-bold text-lg hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 transition-all shadow-2xl shadow-emerald-500/30 flex items-center justify-center gap-3"
                >
                  <span className="text-2xl">✨</span>
                  生成完整网站预览
                </button>
              </div>
            )}

            {generating && (
              <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-12 text-center">
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">
                    {config?.icon}
                  </div>
                </div>
                <p className="text-white font-bold text-xl mb-2">正在生成专属网站...</p>
                <p className="text-slate-400 text-sm">根据{selected?.name}的品牌风格生成</p>
              </div>
            )}

            {previewUrl && selected && (
              <div className="space-y-4 animate-fadeIn">
                {/* 成功提示 */}
                <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/50 rounded-2xl p-4 text-center">
                  <p className="text-emerald-400 font-semibold flex items-center justify-center gap-2">
                    <span className="text-xl">🎉</span>
                    网站预览已生成
                  </p>
                </div>
                
                {/* 完整网站 */}
                <div className={`relative rounded-3xl overflow-hidden`}>
                  {/* 真实背景图 */}
                  <div className="absolute inset-0">
                    <img
                      src={categoryImages[selected.category] || categoryImages.qita}
                      alt={selected.name}
                      className="w-full h-full object-cover"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-slate-900`} />
                  </div>
                  <div className="relative z-10 p-10 text-center">
                    <div className={`w-20 h-20 ${config?.iconBg} rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-2xl`}>
                      {config?.icon}
                    </div>
                    <h1 className={`${config?.titleColor} text-4xl font-bold mb-3`}>{selected.name}</h1>
                    <p className={`${config?.descColor} text-lg mb-6`}>{categoryName} · {selected.address || '门店地址'}</p>
                    
                    {/* 标签 */}
                    <div className="flex justify-center gap-3 flex-wrap mb-8">
                      {config?.tags.map((tag, i) => (
                        <span key={i} className={`${config?.highlight} backdrop-blur-sm px-4 py-2 rounded-full text-white/90 text-sm`}>
                          {tag}
                        </span>
                      ))}
                    </div>

                    <a 
                      href={`tel:${selected.phone}`} 
                      className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white text-gray-800 font-bold text-lg hover:bg-gray-100 transition-all shadow-2xl"
                    >
                      <span className="text-2xl">{config?.ctaIcon}</span>
                      {config?.cta}
                    </a>
                  </div>

                  {/* 服务区 */}
                  <div className={`${config?.cardBg} backdrop-blur-xl p-8`}>
                    <h3 className={`${config?.titleColor} font-bold text-xl mb-6 text-center`}>{config?.servicesTitle}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {services.map((s, i) => (
                        <div key={i} className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center hover:bg-white/25 transition-all">
                          <p className="text-white/90 text-sm mb-2">{s.name}</p>
                          <p className="text-white font-bold text-xl">{s.price}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 联系区 */}
                  <div className="p-8 text-center">
                    <p className={`${config?.descColor} text-sm mb-3`}>联系方式</p>
                    <p className="text-white font-bold text-lg">{selected.phone}</p>
                    <p className="text-white/70">{selected.address || '门店地址'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPreviewUrl(null)}
                    className="py-3 rounded-xl bg-slate-800/60 text-slate-300 hover:bg-slate-700 transition-all font-medium flex items-center justify-center gap-2"
                  >
                    ← 重新生成
                  </button>
                  <button
                    onClick={confirmProposal}
                    className="py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 transition-all font-semibold shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
                  >
                    <span>✅</span> 确认方案
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 2s ease-in-out infinite;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}