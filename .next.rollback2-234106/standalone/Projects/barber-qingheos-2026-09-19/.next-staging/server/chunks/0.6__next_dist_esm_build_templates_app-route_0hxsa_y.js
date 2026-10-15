module.exports=[251990,e=>{"use strict";var t=e.i(609388),r=e.i(933463),n=e.i(185907),a=e.i(98073),s=e.i(858528),o=e.i(694224),i=e.i(825944),c=e.i(463886),l=e.i(284599),u=e.i(685239),d=e.i(250340),p=e.i(750697),h=e.i(487923),g=e.i(608274),f=e.i(590836),m=e.i(193695);e.i(878896);var y=e.i(398108),R=e.i(61335),_=e.i(162797),w=e.i(106698),E=e.i(996855),v=e.i(457587),x=e.i(738445),C=e.i(206416);async function $(e,t,r){let n=t||{};["create_order","query_orders","cancel_order","add_user_need"].includes(e)&&r&&(n={...n,phone:r});let a=await (0,R.executeTool)(e,n),s=a.cards||[];return a.success?{toolResultContent:JSON.stringify(a.data||{ok:!0}),record:{name:e,success:!0,data:{...a.data||{},cards:s},tool_use_id:void 0},cards:s}:{toolResultContent:JSON.stringify({error:a.error}),record:{name:e,success:!1,error:a.error,tool_use_id:void 0},cards:[]}}async function T(e){try{let t=process.env.NEXT_PUBLIC_BASE_URL||"http://localhost:3000",r=`${t}/api/weather?city=${encodeURIComponent(e)}`;console.log(`[造型助手 天气] 调用: ${r}`);let n=await fetch(r,{headers:{Accept:"application/json"},cache:"no-store"});if(console.log(`[造型助手 天气] 状态: ${n.status}`),!n.ok)return console.log(`[造型助手 天气] 错误: ${n.status}`),"";let a=await n.json();if(console.log("[造型助手 天气] 返回数据:",JSON.stringify(a).slice(0,200)),a.success&&a.chatText)return console.log(`[造型助手 天气] 使用 chatText: ${a.chatText}`),a.chatText;return""}catch(e){return console.log(`[造型助手 天气] 异常: ${e?.message||e}`),""}}async function S(e,t){try{let r=e??27.718,n=(27.723-r)*Math.PI/180,a=(109.191-(t??109.191))*Math.PI/180,s=Math.sin(n/2)**2+Math.cos(r*Math.PI/180)*Math.cos(27.723*Math.PI/180)*Math.sin(a/2)**2,o=2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s)),i=6371*o,c="";c=i<1?`${Math.round(1e3*i)}米`:`${i.toFixed(1)}公里`;let l=Math.round(i/5*60),u=l<60?`步行约${l}分钟`:`步行约${(l/60).toFixed(1)}小时`;return{distance:c,walkingTime:u,isDefault:void 0===e||void 0===t}}catch{return{distance:"",walkingTime:"",isDefault:!0}}}async function A(e,t,r){let n,a=(n=e.toLowerCase(),["体温","发烧","量体温","烧到","几度烧"].some(e=>n.includes(e))?"none":["天气","气温","温度","多少度","几度","下雨","下雪","晴天","多云","阴天","热不热","冷不冷","会下雨吗","要不要带伞","今天热","明天热","伞","防晒","中暑","风大","冷不","热不","度吗","几度了","度了","今天多少度","现在多少度","今天热不热","现在热不热","冷吗","热吗"].some(e=>n.includes(e))||n.includes("度")&&!n.includes("体温")&&!n.includes("发烧")?"weather":["哪里","在哪","地址","门店","位置","离我","距离","怎么走","导航","你们店","你们药房","附近","多远"].some(e=>n.includes(e))?"location":"none"),s={};if("weather"===a){let t=function(e){for(let t of["铜仁","贵阳","遵义","六盘水","安顺","毕节","凯里","都匀","兴义","北京","上海","广州","深圳","杭州","成都","武汉","西安","南京","重庆","天津","苏州","长沙","青岛","郑州","济南","合肥","福州","厦门","昆明","海口","三亚","哈尔滨","长春","沈阳","大连","兰州","乌鲁木齐","拉萨","贵阳","香港","澳门","台北"])if(e.includes(t))return t;let t=e.match(/([\u4e00-\u9fa5]{2,4})[的]?天气/);return t&&t[1]&&!["今天","明天","后天"].includes(t[1])?t[1]:"铜仁"}(e),r=await T(t);r?s.weather=r:s.weather="铜仁今天天气情况未知，但一般情况下，铜仁夏季温暖多雨，冬季较冷，建议关注实时天气预报。"}else if("location"===a){let e=await S(t,r);if(e.distance){let t=e.isDefault?"（注：未获取到你的位置，以下距离仅供参考）":"";s.distance=`造型师助手（铜仁市碧江区店）离你约${e.distance}，${e.walkingTime}。${t}
门店地址：贵州省铜仁市碧江区锦江南路304号，电话：0851-XXX-XXXX，营业时间：08:00-22:00。`}}return s}async function M(e,t){try{let r=[];e?r=await _.prisma.$queryRaw`
        SELECT id, phone, nickname, role, points,
               age, gender, allergy, chronicDiseases, lastSymptoms, preferences
        FROM User WHERE id = ${e} LIMIT 1
      `:t&&(r=await _.prisma.$queryRaw`
        SELECT id, phone, nickname, role, points,
               age, gender, allergy, chronicDiseases, lastSymptoms, preferences
        FROM User WHERE phone = ${t} LIMIT 1
      `);let n=[];if(r.length>0){let e=r[0];if(e.nickname&&n.push(`昵称：${e.nickname}`),e.age&&n.push(`年龄：${e.age}岁`),e.gender&&n.push(`性别：${e.gender}`),e.allergy&&n.push(`过敏史：${e.allergy}`),e.chronicDiseases&&n.push(`慢病：${e.chronicDiseases}`),e.lastSymptoms&&n.push(`最近症状：${e.lastSymptoms}`),e.role&&n.push(`会员：${e.role}`),void 0!==e.points&&n.push(`积分：${e.points}`),e.preferences)try{let t="string"==typeof e.preferences?JSON.parse(e.preferences):e.preferences;t.taste&&String(t.taste).trim()&&n.push(`口味偏好：${String(t.taste).trim()}`)}catch{}}let a=t||r[0]?.phone,s=a?await (0,C.getMemoryFacts)(a,e):[],o=(0,C.formatFactsForAI)(s);if(0===n.length&&!o)return;return n.join("\n")+o}catch(e){console.error("[loadUserContext]",e);return}}let I=process.env.ANTHROPIC_API_KEY||process.env.MINIMAX_TOKEN_PLAN_KEY||"",N=`你是"造型助手"，造型师助手（铜仁市碧江区店）的专属发型顾问。

⭐ 价格播报规范（⭐ 19:16 奕霖：必须用工具返回的 price，禁止幻觉）：
- 永远用"X 元 Y 克"格式报价格（如：9.9 元 500 克、28 元 5 千克）
- 1000 克及以上自动说"X 千克"（如：1500 克 → 1.5 千克）
- 不要说"袋/盒/个/颗/把"等数量单位 — 直接用克数
- 这样顾客一听"是"就知道多重多少钱
- 🚨 关键约束：当你调用 search_products 后，必须使用工具返回的 price/memberPrice 字段来报价格
- 🚨 严禁凭印象编价格（如"大果 9.9 元"、"中果 7.9 元"是幻觉，DB里只有 8.0 元/6.8 元）
- 🚨 如果工具没返 price，就说"我去看看库存"，不要瞎报

⭐ 商品名约束（⭐ MEMORY \xa7271 + \xa7272 奕霖 2026-08-25 反馈：AI 杜撰品种名 + 名字脘缩）：
- 🚨 文字里【严禁出现】任何具体商品名称/品种名/产地名/价格/会员价/会员名
- 🚨 不要说"栖霞红富士"、"洛川红富士"、"阿克苏冰糖心"、"阳光造型"、"花牛"等
- 🚨 不要说"\xa58.0/500g"、"会员价 \xa56.8"等数字
- 🚨 只允许说"仓库里有 N 种苹果"、"品种丰富"、"仓库里有 X 种价格区间"等概括描述
- 🚨 实际商品名称和价格只出现在 cards 卡片里（前端会渲染 cards），不要重复出现在文字里
- 这样文字 + 卡片不会冲突，顾客只看到真实数据
- 例（错误）："🍎 山东栖霞红富士 | \xa58/500g | 会员 \xa56.8"
- 例（正确）："仓库里有 4 种苹果，点下面卡片查看详情～"

⭐ 重要能力补充：
- 你不仅是发型顾问，还连接了造型师助手的预约系统、库存系统
- 你可以帮用户预约、查订单、查服务（工具由后端提供）
- 当你说"我帮你预约下午 3 点"、"你的预约号是 XXX"，这些话都是事实

【灵魂底色 v1.0】（参考《食戟之灵》薙切えりな + 资深造型师顾问）
- 嘴贫但懂造型、热情但不谄媚、永远替你挑最适合的发型
- 像资深造型师——爱说、爱推荐、爱调侃，但真的替你操心什么发型最合适
- 也像闺蜜的损友——懂脸型搭配，但不会端着
- 永远先调侃再推荐："哎哟又乱剪？来让我看看你的脸型 💇"

【推荐流程（必须遵守）】
1. 用户说想买啥/不知道吃啥 → 看【当前用户信息】里有啥
   - 如果有偏好/忌口/家庭情况 → 不要重复问，直接开始推荐
   - 如果只有昵称或根本没有信息 → 才需要问
   - 用户最讨厌问过了的问题反复问！
2. 还需要了解的，最多问 1-2 个关键问题（比如"几个人吃"），不要列 3 个清单
3. 信息够了就立即推荐商品（季节性 + 营养搭配 + 用户喜好）

⭐ 你有 4 个真工具（不是关键词规则）：
- search_products: 查仓库商品（如果有分类或造型名，调这个）
- create_order: 帮用户下单（已登录用户的手机号会自动传入，不要重复问用户手机号！如果用户没选商品，从 search_products 推一个）
- query_orders: 查用户订单/取货码
- cancel_order: 取消订单（仅 pending 可取消）

【调用策略】：
1. 用户说 "有什么造型" / "今天什么新鲜" / "不知道买什么" → 先 search_products（关键词用"造型"/"当季"/分类词如"热带造型"），不需问手机号
2. 用户说 "帮我买X" / "下一斤X" / "来X" → 直接 create_order（后端会自动传手机号，不需问）
3. 用户说 "我的订单" / "取货码" → query_orders（后端会自动传手机号，不需问）
4. 用户说 "取消订单" / "不要了" → cancel_order（需要订单号或取货码，如果用户没提供，先 query_orders 让他选）

【多订单重要提醒】：
- 查询到多个订单时，必须全部告诉用户（订单号、取货码、金额、状态），不要挑一个说
- 下单后明确告诉用户：订单号、取货码、金额、有效期（不要跳这些关键信息）

**重要：不要问用户"手机号是多少"！后端已登录用户的手机号会自动传入 create_order 和 query_orders。**

【不许暴露内部工具】
- 你在后台可能会用 search_products / query_orders / create_order 等工具帮用户查东西/下单
- 不要在回复里说这些英文工具名！用户不是技术人员，听不懂
- 用人话表达：
  - ❌ "我用 search_products 查到了商品"
  - ✅ "我查了下仓库..."
  - ❌ "调用 create_order 工具下单成功"
  - ✅ "已帮你下单 ✓"
  - ❌ "query_orders 返回了订单列表"
  - ✅ "你最近的订单..."
- 工具调用是内部机制，用户只能看到结果卡片和你的自然语言回复

【必须给结果】
- 你说了要查询、查仓、查订单的话 → 查询完成后必须告诉用户结果
- ❌ 不允许说完查询后什么都不说
- ❌ 不允许让用户自己去别的页面看
- ✅ 查询完成 → 用自然语言明确告诉用户："我查到了 X，Y, Z"
- 如果查询失败 → 明确告诉用户"抱歉，现在查不了，可以..."。不要沉默。

【严格禁止】
- ❌ 不说"晚安"（不管什么时候都不要主动说晚安，那是旧版本的问题）
- ❌ 不瞎编当前时间（你不确定就告诉用户不确定）
- ❌ 不瞎编当前日期（不确定就说不确定）
- ❌ 不推荐过期/变质造型
- ❌ 不推荐有毒/危险食物（如野生菌、生豆角、发芽土豆等）
- ❌ 不做医学诊断（这不是理发师该做的事）
- ❌ 不编造造型品种/产地
- ❌ 不保证"一定能治好/有效果"

【食物过敏与不适宜提醒】（理发行业特有风险点）
- 用户提到"过敏"/"忌口"时，调用 search_products 时主动避开相关品类
- 推荐造型前简单确认"对 XX 过敏吗？"——如果 userContext 里有 prefs 直接跳过
- 【疑似食物中毒】立即建议就医（不要卖任何东西）：
  - 呕吐 + 腹泻持续 2h 以上
  - 高烧
  - 血便
  - 神经系统症状（视物模糊/肌肉抽搐）
- 【严重过敏反应】立即建议 120 + 联系门店：
  - 呼吸困难
  - 喉头水肿
  - 全身皮疹 + 头晕
  - 意识不清

【时间/日期规则】
- 用户问"现在几点了"/"今天是几号"时，如果【上面提供的实时时间】里有，就用那里的数据
- 如果没有，诚实告诉用户"我这边没有实时时钟"
- 绝对不要瞎编时间或日期
- 【季节性推荐】根据当前月份推荐当季造型（不确定就说"我不确定现在是不是 XX 季节"）

【经营范围】（理发店定位）
- 只卖：精剪造型 / 染发护色 / 烫发造型 / 形象设计 / 洗护套餐
- 不卖：药品 / 保健品 / 加工食品 / 服务外产品 / 野生菌（安全风险）
- 如果用户问"有没有药"/"能开药吗" → 明确说"我们是理发店，不卖药，请到药店或医院"
- 如果用户问保健品 → 说"我们是理发店，不卖保健品，需要可以到药店"

【⭐ 2026-08-25 14:42 奕霖需求 — 记录用户偏好/需求】⭐
当你识别到用户有以下任一情况时，**主动调 add_user_need 工具**记录（不一定要下单）：
- 用户说"想要/想买/想吃"某品类但没具体下单
- 用户说"给谁吃/给老人/给小孩/给孕妇"等人群偏好
- 用户说"要软的/甜的/便宜的/新鲜的/不的/的"等质量要求
- 用户说"明天/下周/周几要"等时间期望
- 用户说"上次买的XX不错/再来点"等回访
- AI 总结一句话（summaryText）不超过 50 字，格式："要 X 给 Y+偏好"
- 工具返回成功后，告诉用户"已记下来，店员到店后能看到"
**不要**对纯问候（你好/在吗/谢谢）调此工具
`,O=new Map;async function P(e,t,r,n=3){if(!I)throw Error("API_KEY_NOT_CONFIGURED");let a=e.map(e=>({role:e.role,content:e.content})),s=[],o=[],i="";for(let e=0;e<n;e++){let e=await fetch("https://api.minimaxi.com/anthropic/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":I,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"MiniMax-M2.7",max_tokens:1024,system:t,messages:a,tools:R.AI_TOOLS.map(e=>({name:e.name,description:e.description,input_schema:e.inputSchema})),temperature:.7})});if(!e.ok){let t=await e.text();throw Error(`API_ERROR_${e.status}: ${t}`)}let n=await e.json(),c=(n.content||[]).filter(e=>"tool_use"===e.type),l=(n.content||[]).filter(e=>"text"===e.type);if(a.push({role:"assistant",content:n.content||[]}),0===c.length){i=l.map(e=>e.text||"").join("");break}let u=[];for(let e of c){let{toolResultContent:t,record:n,cards:a}=await $(e.name,e.input,r);n.tool_use_id=e.id,s.push(n),a&&a.length>0&&o.push(...a),u.push({type:"tool_result",tool_use_id:e.id,content:t,is_error:!n.success})}if(a.push({role:"user",content:u}),"end_turn"===n.stop_reason&&l.length>0){i=l.map(e=>e.text||"").join("");break}}return{reply:i,toolRecords:s,cards:o}}async function q(){return Response.json({status:"ok",service:"造型助手",version:"2.0-streaming"})}async function b(t){var r;let n,a,s;if(r=t.headers.get("x-forwarded-for")||t.headers.get("x-real-ip")||"unknown",a=Date.now(),(s=O.get(r))&&!(a>s.resetAt)?s.count>=10||(s.count++,!1):(O.set(r,{count:1,resetAt:a+6e4}),!1))return Response.json({reply:"请求太频繁，请稍等一分钟再试~⏳",isEmergency:!1},{status:429});let o="true"===new URL(t.url).searchParams.get("stream")||t.headers.get("accept")?.includes("text/event-stream");try{n=await t.json()}catch{return Response.json({reply:"请求格式错误，请检查后重试~",isEmergency:!1},{status:400})}let i=n.message||(n.messages?.filter(e=>"user"===e.role).slice(-1)[0]?.content??""),c=n.phone;if(!c&&n.userId)try{let e=await _.prisma.$queryRaw`
        SELECT phone FROM User WHERE id = ${n.userId} LIMIT 1
      `;e.length>0&&(c=e[0].phone)}catch(e){}if(!c){let r=t.headers.get("authorization");if(r?.startsWith("Bearer ")){let t=r.slice(7);try{let r=e.r(701170).verify(t,process.env.JWT_SECRET||"zhilin-dev-secret");r?.phone&&(c=r.phone)}catch(e){}}}let l=n.messages||[];if(!l||0===l.length)return Response.json({reply:"请输入您的问题~ 😊",isEmergency:!1});let u=l.slice(-20),d=[...u].reverse().find(e=>"user"===e.role);if(d&&"string"==typeof d.content&&d.content,!o&&d&&"string"==typeof d.content){let e=(0,x.getCachedChatReply)(d.content,!!c,n.subject||"self");if(e)return console.log(`[造型助手 semantic-cache] HIT for "${d.content.slice(0,30)}..."`),await (0,w.saveChatLog)({phone:c,userMessage:i,aiReply:e.reply,tools:[],isEmergency:!1}),Response.json({reply:e.reply,isEmergency:!1,cards:e.cards||[],toolExecuted:e.toolExecuted||null,toolsRun:e.toolsRun||[],_cached:!0})}let p={},h=N,g=await M(n.userId,c),f=new Date,m=6>f.getHours()?"凌晨":9>f.getHours()?"早晨":12>f.getHours()?"上午":14>f.getHours()?"中午":18>f.getHours()?"下午":22>f.getHours()?"晚上":"深夜",y=`

【当前时间】
${f.toLocaleDateString("zh-CN",{year:"numeric",month:"2-digit",day:"2-digit"})} ${["周日","周一","周二","周三","周四","周五","周六"][f.getDay()]} ${String(f.getHours()).padStart(2,"0")}:${String(f.getMinutes()).padStart(2,"0")}（${m}）
中国时区 Asia/Shanghai (GMT+8)
⭐ 说话时请自然引用时间（如"早上好"、"昨晚"、"下午记得..."），不要每句话都说时间`,R=n.subject||"self",C="self"===R?"\n\n【问诊对象 = 登录用户本人】\n可以默认采用上面【当前用户信息】里的：年龄/性别/过敏史/慢病。但 ⚠️ 急性症状每次问诊都要重新评估，不要复用上次的症状。":"family"===R?"\n\n【⚠️ 问诊对象 = 用户的家人】\n登录用户并不是患者！上面【当前用户信息】中的 年龄/性别/过敏史/慢病 ≠ 当前患者信息。\n→ 第一轮必须先问清：多大岁数、性别、当前症状、有无过敏史、家族慢病。":"\n\n【⚠️ 问诊对象 = 其他陌生人】\n登录用户完全 不是 患者！\n→ 第一轮必须先问清：多大岁数、性别、当前症状、有无过敏史、是否有慢病。不要套用登录用户的任何健康信息。";if(d&&"string"==typeof d.content)try{p=await A(d.content,n.userLat,n.userLng),h=function(e,t,r,n){let a="";n&&(a+="\n\n【当前用户信息】\n"+n),a+='\n\n【取货场景】如果用户提到"取货"、"取药"、"来拿"、"到了"等，先用 query_orders 查询用户的待取货订单，告知取货码和订单状态。如果订单已送达(delivered)，提醒用户带上手机号到店核销。\n\n'+(0,v.getCurrentTimeContext)(),t.weather&&(a+=`

【实时天气信息】${t.weather}
你可以用轻松的方式告诉用户天气情况，并结合实际情况给健康建议（如提醒带伞/防暑/加衣）。`),t.distance&&(a+=`

【门店位置信息】${t.distance}
当用户询问门店位置/距离时，用这段信息回答，并自然引导用户来买药或导航过去。`);try{let e=(0,E.formatCategoryHintForAI)();a+=`

${e}

当你需要 search_products 时，可以根据用户描述的症状/需求，先推断属于哪个分类（用 4 位数字 code），再调 search_products 带上分类关键词。`}catch(e){console.error("[category hint error]",e)}if(r&&r.length>0)for(let e of(a+="\n\n【你刚刚已执行的操作】\n",r))if(e.success){let t=e.data?JSON.stringify(e.data,null,0):"";a+=`✅ 工具 ${e.name} 执行成功：
${t}

`,"create_order"===e.name?a+=`【回复指引】
你已经成功为用户创建了订单。**你必须告诉用户**：
- 订单创建成功
- 订单号
- 6 位取货码（重点强调）
- 7 天内到店出示取货码 + 付款
- 不要再问“需不需要下单”这种问题。

`:"query_orders"===e.name?a+=`【回复指引】
你帮用户查到了订单。**你必须告诉用户**：每个订单的取货码/状态/金额。

`:"search_products"===e.name&&(a+=`【回复指引】
你帮用户查到了商品。**你必须告诉用户**：哪些商品有货、价格多少。

`)}else a+=`❌ 工具 ${e.name} 执行失败：${e.error||"未知错误"}
【回复指引】
你需要在回复中告诉用户问题。

`;return e+a}(N+y+C,p,void 0,"self"===R?g:void 0)}catch(e){console.error("[造型助手] Tool context error:",e)}else g&&"self"===R?h=N+"\n\n"+g+y+C:"self"!==R&&(h=N+y+C);if(!I)return console.error("[造型助手] API Key 未配置"),Response.json({reply:"服务配置问题，请稍后再试~",isEmergency:!1},{status:500});if(o){let e=new TextEncoder,t=new ReadableStream({async start(t){try{let{reply:r,toolRecords:n,cards:a}=await P(u,h,c,3);if(a.length>0&&t.enqueue(e.encode(`data: {"type":"cards","data":${JSON.stringify(a)}}

`)),n.length>0){let r=n.map(e=>e.success?e.name:`${e.name}_failed`).join(",");t.enqueue(e.encode(`data: {"type":"tool","name":"${r}"}

`))}if(r)for(let n of function(e){let t,r=[],n=/[^。！？；\n]*[。！？；\n]+/g,a=0;for(;null!==(t=n.exec(e));)r.push(t[0]),a=n.lastIndex;let s=e.slice(a);return s.length>20||0===r.length?r.push(s):s&&r.length>0&&(r[r.length-1]+=s),r.filter(e=>e.trim())}(r))t.enqueue(e.encode(`data: {"type":"text","chunk":"${n.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\n/g,"\\n").replace(/\r/g,"\\r").replace(/\t/g,"\\t")}"}

`));(0,w.saveChatLog)({phone:c,userMessage:i,aiReply:r,tools:n.filter(e=>e.success).map(e=>e.name)}).catch(()=>{}),t.enqueue(e.encode(`data: {"type":"done"}

`)),t.close()}catch(r){console.error("[造型助手流式 tool_use] 错误:",r?.message||r);try{t.enqueue(e.encode(`data: {"type":"error","chunk":"抱歉，服务临时不可用，请稍后再试~ 🙏"}

`)),t.close()}catch(e){}}},cancel(){}});return new Response(t,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}try{let{reply:e,toolRecords:t,cards:r}=await P(u,h,c,3),n=t.length>0?t.map(e=>e.success?e.name:`${e.name}_failed`).join(","):null;return d&&"string"==typeof d.content&&(0,x.setCachedChatReply)(d.content,!!c,R,{reply:e.trim(),cards:r,toolExecuted:n,toolsRun:t,timestamp:Date.now()}),await (0,w.saveChatLog)({phone:c,userMessage:i,aiReply:e,tools:t.filter(e=>e.success).map(e=>e.name)}),Response.json({reply:e.trim(),isEmergency:!1,cards:r,toolExecuted:n,toolsRun:t})}catch(e){if(console.error("[造型助手] API调用错误:",e?.message||e),e?.message?.includes("429"))return Response.json({reply:"请求太频繁，请稍等一分钟再试~ ⏳",isEmergency:!1},{status:429});return Response.json({reply:"抱歉，服务暂时不可用，请稍后再试~ 🙏",isEmergency:!1},{status:500})}}e.s(["GET",0,q,"POST",0,b],860231);var k=e.i(860231);let H=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/grocery-chat/route",pathname:"/api/grocery-chat",filename:"route",bundlePath:""},distDir:".next-staging",relativeProjectDir:"",resolvedPagePath:"[project]/Projects/barber-qingheos-2026-09-19/src/app/api/grocery-chat/route.ts",nextConfigOutput:"standalone",userland:k,...{}}),{workAsyncStorage:X,workUnitAsyncStorage:j,serverHooks:D}=H;async function U(e,t,n){n.requestMeta&&(0,a.setRequestMeta)(e,n.requestMeta),H.isDev&&(0,a.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let R="/api/grocery-chat/route";R=R.replace(/\/index$/,"")||"/";let _=await H.prepare(e,t,{srcPage:R,multiZoneDraftMode:!1});if(!_)return t.statusCode=400,t.end("Bad Request"),null==n.waitUntil||n.waitUntil.call(n,Promise.resolve()),null;let{buildId:w,deploymentId:E,params:v,nextConfig:x,parsedUrl:C,isDraftMode:$,prerenderManifest:T,routerServerContext:S,isOnDemandRevalidate:A,revalidateOnlyGenerated:M,resolvedPathname:I,clientReferenceManifest:N,serverActionsManifest:O}=_,P=(0,i.normalizeAppPath)(R),q=!!(T.dynamicRoutes[P]||T.routes[I]),b=async()=>((null==S?void 0:S.render404)?await S.render404(e,t,C,!1):t.end("This page could not be found"),null);if(q&&!$){let e=!!T.routes[I],t=T.dynamicRoutes[P];if(t&&!1===t.fallback&&!e){if(x.adapterPath)return await b();throw new m.NoFallbackError}}let k=null;!q||H.isDev||$||(k="/index"===(k=I)?"/":k);let X=!0===H.isDev||!q,j=q&&!X;O&&N&&(0,o.setManifestsSingleton)({page:R,clientReferenceManifest:N,serverActionsManifest:O});let D=e.method||"GET",U=(0,s.getTracer)(),L=U.getActiveScopeSpan(),F=!!(null==S?void 0:S.isWrappedByNextServer),K=!!(0,a.getRequestMeta)(e,"minimalMode"),B=(0,a.getRequestMeta)(e,"incrementalCache")||await H.getIncrementalCache(e,x,T,K);null==B||B.resetRequestCache(),globalThis.__incrementalCache=B;let J={params:v,previewProps:T.preview,renderOpts:{experimental:{authInterrupts:!!x.experimental.authInterrupts},cacheComponents:!!x.cacheComponents,supportsDynamicResponse:X,incrementalCache:B,cacheLifeProfiles:x.cacheLife,waitUntil:n.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,n,a)=>H.onRequestError(e,t,n,a,S)},sharedContext:{buildId:w,deploymentId:E}},W=new c.NodeNextRequest(e),Y=new c.NodeNextResponse(t),G=l.NextRequestAdapter.fromNodeNextRequest(W,(0,l.signalFromNodeResponse)(t));try{let a,o=async e=>H.handle(G,J).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=U.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let n=r.get("next.route");if(n){let t=`${D} ${n}`;e.setAttributes({"next.route":n,"http.route":n,"next.span_name":t}),e.updateName(t),a&&a!==e&&(a.setAttribute("http.route",n),a.updateName(t))}else e.updateName(`${D} ${R}`)}),i=async a=>{var s,i;let c=async({previousCacheEntry:r})=>{try{if(!K&&A&&M&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let s=await o(a);e.fetchMetrics=J.renderOpts.fetchMetrics;let i=J.renderOpts.pendingWaitUntil;i&&n.waitUntil&&(n.waitUntil(i),i=void 0);let c=J.renderOpts.collectedTags;if(!q)return await (0,p.sendResponse)(W,Y,s,J.renderOpts.pendingWaitUntil),null;{let e=await s.blob(),t=(0,h.toNodeOutgoingHttpHeaders)(s.headers);c&&(t[f.NEXT_CACHE_TAGS_HEADER]=c),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==J.renderOpts.collectedRevalidate&&!(J.renderOpts.collectedRevalidate>=f.INFINITE_CACHE)&&J.renderOpts.collectedRevalidate,n=void 0===J.renderOpts.collectedExpire||J.renderOpts.collectedExpire>=f.INFINITE_CACHE?void 0:J.renderOpts.collectedExpire;return{value:{kind:y.CachedRouteKind.APP_ROUTE,status:s.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:n}}}}catch(t){throw(null==r?void 0:r.isStale)&&await H.onRequestError(e,t,{routerKind:"App Router",routePath:R,routeType:"route",revalidateReason:(0,d.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:A})},!1,S),t}},l=await H.handleResponse({req:e,nextConfig:x,cacheKey:k,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:T,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:M,responseGenerator:c,waitUntil:n.waitUntil,isMinimalMode:K});if(!q)return null;if((null==l||null==(s=l.value)?void 0:s.kind)!==y.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(i=l.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});K||t.setHeader("x-nextjs-cache",A?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),$&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let u=(0,h.fromNodeOutgoingHttpHeaders)(l.value.headers);return K&&q||u.delete(f.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||t.getHeader("Cache-Control")||u.get("Cache-Control")||u.set("Cache-Control",(0,g.getCacheControlHeader)(l.cacheControl)),await (0,p.sendResponse)(W,Y,new Response(l.value.body,{headers:u,status:l.value.status||200})),null};F&&L?await i(L):(a=U.getActiveScopeSpan(),await U.withPropagatedContext(e.headers,()=>U.trace(u.BaseServerSpan.handleRequest,{spanName:`${D} ${R}`,kind:s.SpanKind.SERVER,attributes:{"http.method":D,"http.target":e.url}},i),void 0,!F))}catch(t){if(t instanceof m.NoFallbackError||await H.onRequestError(e,t,{routerKind:"App Router",routePath:P,routeType:"route",revalidateReason:(0,d.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:A})},!1,S),q)throw t;return await (0,p.sendResponse)(W,Y,new Response(null,{status:500})),null}}e.s(["handler",0,U,"patchFetch",0,function(){return(0,n.patchFetch)({workAsyncStorage:X,workUnitAsyncStorage:j})},"routeModule",0,H,"serverHooks",0,D,"workAsyncStorage",0,X,"workUnitAsyncStorage",0,j],251990)}];

//# sourceMappingURL=0.6__next_dist_esm_build_templates_app-route_0hxsa_y.js.map