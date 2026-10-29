"use client";
import { toast } from '@/lib/ui-bus'
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { BUSINESS_CONFIG } from '@/config/business.config';
import MapLauncher from '@/components/MapLauncher';

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

const categoryMap: Record<string, string> = {
  meifa: '美发', canyin: '餐饮', yimei: '医美', jiaoyu: '教育', jianshen: '健身', qita: '其他'
};

const categoryConfig: Record<string, {
  gradient: string;
  icon: string;
  titleColor: string;
  cardBg: string;
  servicesTitle: string;
  cta: string;
  ctaIcon: string;
  tags: string[];
}> = {
  meifa: { 
    gradient: 'from-rose-400 via-pink-400 to-fuchsia-500',
    icon: '✂️',
    titleColor: 'text-white',
    cardBg: 'bg-white/15',
    servicesTitle: '✂️ 服务项目',
    cta: '立即预约',
    ctaIcon: '📅',
    tags: ['💇 专业发型', '✨ 时尚造型', '💆 焕新体验'],
  },
  canyin: { 
    gradient: 'from-orange-400 via-amber-400 to-yellow-500',
    icon: '🍜',
    titleColor: 'text-white',
    cardBg: 'bg-white/15',
    servicesTitle: '🍜 招牌推荐',
    cta: '立即预约',
    ctaIcon: '📅',
    tags: ['🔥 地道风味', '🥬 精选食材', '🏠 舒适环境'],
  },
  yimei: { 
    gradient: 'from-cyan-400 via-blue-400 to-indigo-500',
    icon: '💎',
    titleColor: 'text-white',
    cardBg: 'bg-white/15',
    servicesTitle: '💎 热门项目',
    cta: '咨询预约',
    ctaIcon: '💬',
    tags: ['💉 专业技术', '🛡️ 安全保障', '🌸 私享空间'],
  },
  jiaoyu: { 
    gradient: 'from-violet-400 via-purple-400 to-fuchsia-500',
    icon: '📚',
    titleColor: 'text-white',
    cardBg: 'bg-white/15',
    servicesTitle: '📚 课程设置',
    cta: '了解更多',
    ctaIcon: '📱',
    tags: ['🎓 精品小班', '📐 因材施教', '🎮 寓教于乐'],
  },
  jianshen: { 
    gradient: 'from-emerald-400 via-teal-400 to-cyan-500',
    icon: '💪',
    titleColor: 'text-white',
    cardBg: 'bg-white/15',
    servicesTitle: '🏋️ 会员课程',
    cta: '预约体验',
    ctaIcon: '🏃',
    tags: ['👨🏫 专业教练', '📈 科学训练', '🎯 效果可见'],
  },
  qita: { 
    gradient: 'from-slate-400 via-gray-500 to-zinc-600',
    icon: '🏪',
    titleColor: 'text-white',
    cardBg: 'bg-white/15',
    servicesTitle: '🏪 精选服务',
    cta: '联系我们',
    ctaIcon: '📞',
    tags: ['⭐ 品质保障', '💖 贴心服务', '🤝 值得信赖'],
  },
};

// 生成可选时段
const timeSlots = [
  '09:00-10:00', '10:00-11:00', '11:00-12:00',
  '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00',
  '18:00-19:00', '19:00-20:00', '20:00-21:00'
];

export default function MerchantSite() {
  const params = useParams();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    const merchantId = params?.id as string;
    if (!merchantId) {
      setError('缺少商户ID');
      setLoading(false);
      return;
    }

    fetch('/api/merchant/list')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const m = data.data.find((item: Merchant) => item.id === merchantId);
          if (m) setMerchant(m);
          else setError('未找到该商户');
        } else setError('加载失败');
        setLoading(false);
      })
      .catch(() => {
        setError('网络错误');
        setLoading(false);
      });
  }, [params?.id]);

  const handleBooking = async () => {
    if (!merchant || !bookingDate || !bookingTime || !customerPhone) {
      toast.info('请填写完整信息');
      return;
    }
    
    setBooking(true);
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: merchant.id,
          merchantName: merchant.name,
          date: bookingDate,
          timeSlot: bookingTime,
          customerName,
          customerPhone
        })
      }).then(r => r.json());
      
      if (res.success) {
        toast.success('✅ 预约成功！商户会尽快确认');
        setShowBooking(false);
        setBookingDate('');
        setBookingTime('');
        setCustomerName('');
        setCustomerPhone('');
      } else {
        toast.error('❌ 预约失败：' + res.error);
      }
    } catch {
      toast.error('❌ 网络错误');
    }
    setBooking(false);
  };

  // 生成未来7天的日期
  const getDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-4xl mb-4 animate-spin">⏳</div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !merchant) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-center px-4">
          <div className="text-5xl mb-4">😕</div>
          <p className="text-xl mb-2">{error || '未找到商户'}</p>
          <p className="text-slate-400 text-sm">请检查链接是否正确</p>
        </div>
      </div>
    );
  }

  const config = categoryConfig[merchant.category] || categoryConfig.qita;
  const categoryName = categoryMap[merchant.category] || merchant.category;
  const services = merchant.services?.trim() 
    ? merchant.services.split('|').map(s => {
        const [name, price] = s.split('¥').map(x => x.trim());
        return { name: name || s, price: price ? `¥${price}` : '' };
      })
    : [];
  const dates = getDates();

  return (
    <div className={`min-h-screen bg-gradient-to-br ${config.gradient}`}>
      {/* 预约弹窗 */}
      {showBooking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">📅 预约服务</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">选择日期</label>
                <select 
                  value={bookingDate}
                  onChange={e => setBookingDate(e.target.value)}
                  className="w-full p-3 border rounded-xl text-slate-800"
                >
                  <option value="">请选择日期</option>
                  {dates.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-slate-600 mb-1">选择时段</label>
                <select 
                  value={bookingTime}
                  onChange={e => setBookingTime(e.target.value)}
                  className="w-full p-3 border rounded-xl text-slate-800"
                >
                  <option value="">请选择时段</option>
                  {timeSlots.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-slate-600 mb-1">您的称呼（选填）</label>
                <input 
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="如：张先生"
                  className="w-full p-3 border rounded-xl text-slate-800"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-600 mb-1">手机号码（必填）</label>
                <input 
                  type="tel"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="便于商户联系您"
                  className="w-full p-3 border rounded-xl text-slate-800"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowBooking(false)}
                  className="flex-1 py-3 rounded-xl bg-slate-200 text-slate-700 font-medium"
                >
                  取消
                </button>
                <button 
                  onClick={handleBooking}
                  disabled={booking || !bookingDate || !bookingTime || !customerPhone}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-400 to-amber-500 text-white font-bold disabled:opacity-50"
                >
                  {booking ? '提交中...' : '确认预约'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 主内容 */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Logo区 */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl mb-4">
            {config.icon}
          </div>
          <h1 className={`text-2xl font-bold ${config.titleColor}`}>{merchant.name}</h1>
          <p className={`${config.titleColor.replace('text-', 'text-/')}`}>{categoryName}</p>
        </div>

        {/* 描述卡片 */}
        <div className={`rounded-2xl p-4 ${config.cardBg} backdrop-blur-sm mb-4`}>
          <p className={config.titleColor}>{merchant.desc || '专业服务，品质保障'}</p>
        </div>

        {/* 品牌故事 */}
        <div className={`rounded-2xl p-5 ${config.cardBg} backdrop-blur-sm mb-4`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">📖</span>
            <h3 className={`font-bold text-lg ${config.titleColor}`}>品牌故事</h3>
          </div>
          <h4 className={`text-xl font-bold ${config.titleColor} mb-2`}>一间药房，二十年</h4>
          <p className={`${config.titleColor.replace('text-', 'text-/')} text-sm italic mb-3`}>—— 近一点，再近一点。</p>
          <div className={`space-y-2 text-sm ${config.titleColor.replace('text-', 'text-/')}`} style={{lineHeight: '1.75'}}>
            <p>铜仁老社区的巷口，有一间开了近二十年的药房。</p>
            <p>最早的时候，只有一排旧药柜和一位坐堂的老爷子。街坊邻居有个头疼脑热，总爱先来这里问问。老爷子不急着开药，先沏杯茶，聊聊最近吃了什么、睡得好不好。</p>
            <p>后来老爷子走了，店里来了一位新店员。街坊们发现，他耳朵不太灵光，交流起来要多说几遍。但奇怪的是，大家反而更愿意来找他——因为他认真，每一次拿药都要反复确认剂量，生怕出错。</p>
            <p>二十年，小店慢慢变成老店。药架换过几茬，招牌也重新刷过漆。但那些熟悉的街坊，进门还是习惯先喊一声"来了啊"，像回家一样。</p>
          </div>

          {/* 亮点标签 */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className={`px-3 py-1 rounded-full text-xs ${config.cardBg} ${config.titleColor} font-medium`}>🌿 近二十年老药房</span>
            <span className={`px-3 py-1 rounded-full text-xs ${config.cardBg} ${config.titleColor} font-medium`}>🍵 先问诊，再开药</span>
            <span className={`px-3 py-1 rounded-full text-xs ${config.cardBg} ${config.titleColor} font-medium`}>🤝 反复确认剂量</span>
            <span className={`px-3 py-1 rounded-full text-xs ${config.cardBg} ${config.titleColor} font-medium`}>🏠 街坊的"第二个家"</span>
          </div>
        </div>

        {/* 服务项目 */}
        {services.length > 0 && (
          <div className={`rounded-2xl p-4 ${config.cardBg} backdrop-blur-sm mb-4`}>
            <h3 className={`font-semibold mb-3 ${config.titleColor}`}>{config.servicesTitle}</h3>
            <div className="space-y-2">
              {services.map((s, i) => (
                <div key={i} className={`flex justify-between ${config.titleColor}`}>
                  <span>{s.name}</span>
                  <span className="font-medium">{s.price}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 标签 */}
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {config.tags.map((tag, i) => (
            <span key={i} className={`px-3 py-1 rounded-full text-sm ${config.cardBg} ${config.titleColor}`}>
              {tag}
            </span>
          ))}
        </div>

        {/* 预约按钮 */}
        <button 
          onClick={() => setShowBooking(true)}
          className={`block w-full py-4 rounded-2xl bg-white/90 text-center font-bold text-lg text-slate-800 shadow-lg hover:bg-white transition-all flex items-center justify-center gap-2 mb-4`}
        >
          <span>📅</span>
          <span>立即预约</span>
        </button>

        {/* 联系按钮 */}
        <a 
          href={`tel:${merchant.phone}`}
          className={`block w-full py-4 rounded-2xl bg-white/20 backdrop-blur-sm text-center font-bold text-lg ${config.titleColor} hover:bg-white/30 transition-all flex items-center justify-center gap-2`}
        >
          <span>📞</span>
          <span>致电商家</span>
        </a>

        {/* 底部信息 */}
        <div className="mt-6 text-center">
          <p className={`text-sm ${config.titleColor.replace('text-', 'text-/')}`}>
            📍 {merchant.address || '铜仁市'}
          </p>
          {(() => {
            // ⭐ 2026-07-30 03:59 奕霖需求：调起用户设备本地地图 app 选一个导航（精确定位）
            const c = BUSINESS_CONFIG.contact.coords
            const lng = (c && c[0]) ?? 109.200269
            const lat = (c && c[1]) ?? 27.732818
            return (
              <div className="mt-3 flex justify-center">
                <MapLauncher
                  lat={lat}
                  lng={lng}
                  name={BUSINESS_CONFIG.name}
                  address={merchant.address || BUSINESS_CONFIG.contact.address}
                  label="导航到店"
                  variant="ghost"
                />
              </div>
            )
          })()}
          <p className={`text-sm mt-2 ${config.titleColor.replace('text-', 'text-/')}`}>
            📞 {merchant.phone}
          </p>
        </div>
      </div>
    </div>
  );
}