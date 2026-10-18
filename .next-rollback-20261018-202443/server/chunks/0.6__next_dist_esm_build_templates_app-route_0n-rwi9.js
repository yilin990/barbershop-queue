module.exports=[74584,e=>{"use strict";var t=e.i(609388),r=e.i(933463),n=e.i(185907),a=e.i(98073),s=e.i(858528),o=e.i(694224),i=e.i(825944),c=e.i(463886),l=e.i(284599),u=e.i(685239),d=e.i(250340),p=e.i(750697),h=e.i(487923),g=e.i(608274),y=e.i(590836),f=e.i(193695);e.i(878896);var m=e.i(398108),R=e.i(61335),_=e.i(162797),w=e.i(106698),E=e.i(996855),v=e.i(457587),C=e.i(738445),x=e.i(206416);async function T(e,t,r){let n=t||{};["create_order","query_orders","cancel_order","add_user_need"].includes(e)&&r&&(n={...n,phone:r});let a=await (0,R.executeTool)(e,n),s=a.cards||[];return a.success?{toolResultContent:JSON.stringify(a.data||{ok:!0}),record:{name:e,success:!0,data:{...a.data||{},cards:s},tool_use_id:void 0},cards:s}:{toolResultContent:JSON.stringify({error:a.error}),record:{name:e,success:!1,error:a.error,tool_use_id:void 0},cards:[]}}async function $(e){try{let t=process.env.NEXT_PUBLIC_BASE_URL||"http://localhost:3000",r=`${t}/api/weather?city=${encodeURIComponent(e)}`;console.log(`[造型师 天气] 调用: ${r}`);let n=await fetch(r,{headers:{Accept:"application/json"},cache:"no-store"});if(console.log(`[造型师 天气] 状态: ${n.status}`),!n.ok)return console.log(`[造型师 天气] 错误: ${n.status}`),"";let a=await n.json();if(console.log("[造型师 天气] 返回数据:",JSON.stringify(a).slice(0,200)),a.success&&a.chatText)return console.log(`[造型师 天气] 使用 chatText: ${a.chatText}`),a.chatText;return""}catch(e){return console.log(`[造型师 天气] 异常: ${e?.message||e}`),""}}async function S(e,t){try{let r=e??27.718,n=(27.723-r)*Math.PI/180,a=(109.191-(t??109.191))*Math.PI/180,s=Math.sin(n/2)**2+Math.cos(r*Math.PI/180)*Math.cos(27.723*Math.PI/180)*Math.sin(a/2)**2,o=2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s)),i=6371*o,c="";c=i<1?`${Math.round(1e3*i)}米`:`${i.toFixed(1)}公里`;let l=Math.round(i/5*60),u=l<60?`步行约${l}分钟`:`步行约${(l/60).toFixed(1)}小时`;return{distance:c,walkingTime:u,isDefault:void 0===e||void 0===t}}catch{return{distance:"",walkingTime:"",isDefault:!0}}}async function A(e,t,r){let n,a=(n=e.toLowerCase(),["体温","发烧","量体温","烧到","几度烧"].some(e=>n.includes(e))?"none":["天气","气温","温度","多少度","几度","下雨","下雪","晴天","多云","阴天","热不热","冷不冷","会下雨吗","要不要带伞","今天热","明天热","伞","防晒","中暑","风大","冷不","热不","度吗","几度了","度了","今天多少度","现在多少度","今天热不热","现在热不热","冷吗","热吗"].some(e=>n.includes(e))||n.includes("度")&&!n.includes("体温")&&!n.includes("发烧")?"weather":["哪里","在哪","地址","门店","位置","离我","距离","怎么走","导航","你们店","你们药房","附近","多远"].some(e=>n.includes(e))?"location":"none"),s={};if("weather"===a){let t=function(e){for(let t of["铜仁","贵阳","遵义","六盘水","安顺","毕节","凯里","都匀","兴义","北京","上海","广州","深圳","杭州","成都","武汉","西安","南京","重庆","天津","苏州","长沙","青岛","郑州","济南","合肥","福州","厦门","昆明","海口","三亚","哈尔滨","长春","沈阳","大连","兰州","乌鲁木齐","拉萨","贵阳","香港","澳门","台北"])if(e.includes(t))return t;let t=e.match(/([\u4e00-\u9fa5]{2,4})[的]?天气/);return t&&t[1]&&!["今天","明天","后天"].includes(t[1])?t[1]:"铜仁"}(e),r=await $(t);r?s.weather=r:s.weather="铜仁今天天气情况未知，但一般情况下，铜仁夏季温暖多雨，冬季较冷，建议关注实时天气预报。"}else if("location"===a){let e=await S(t,r);if(e.distance){let t=e.isDefault?"（注：未获取到你的位置，以下距离仅供参考）":"";s.distance=`造型师助手（铜仁市碧江区）离你约${e.distance}，${e.walkingTime}。${t}
门店地址：贵州省铜仁市碧江区，电话：+86 18 30 85 67 187，营业时间：10:00-22:00。`}}return s}async function I(e,t){try{let r=[];e?r=await _.prisma.$queryRaw`
        SELECT id, phone, nickname, role, points,
               age, gender, allergy, chronicDiseases, lastSymptoms, preferences
        FROM User WHERE id = ${e} LIMIT 1
      `:t&&(r=await _.prisma.$queryRaw`
        SELECT id, phone, nickname, role, points,
               age, gender, allergy, chronicDiseases, lastSymptoms, preferences
        FROM User WHERE phone = ${t} LIMIT 1
      `);let n=[];if(r.length>0){let e=r[0];if(e.nickname&&n.push(`昵称：${e.nickname}`),e.age&&n.push(`年龄：${e.age}岁`),e.gender&&n.push(`性别：${e.gender}`),e.allergy&&n.push(`过敏史：${e.allergy}`),e.chronicDiseases&&n.push(`慢病：${e.chronicDiseases}`),e.lastSymptoms&&n.push(`最近症状：${e.lastSymptoms}`),e.role&&n.push(`会员：${e.role}`),void 0!==e.points&&n.push(`积分：${e.points}`),e.preferences)try{let t="string"==typeof e.preferences?JSON.parse(e.preferences):e.preferences;t.taste&&String(t.taste).trim()&&n.push(`口味偏好：${String(t.taste).trim()}`)}catch{}}let a=t||r[0]?.phone,s=a?await (0,x.getMemoryFacts)(a,e):[],o=(0,x.formatFactsForAI)(s);if(0===n.length&&!o)return;return n.join("\n")+o}catch(e){console.error("[loadUserContext]",e);return}}let M=process.env.ANTHROPIC_API_KEY||process.env.MINIMAX_TOKEN_PLAN_KEY||"",N=`你是"造型师"，铜仁"造型师助手"（贵州铜仁碧江区）的专属发型顾问。

⭐ 价格播报规范（⭐ 奕霖：必须用工具返回的 price，禁止幻觉）：
- 永远用"X 元 Y 项"格式报价格（如：剪发 38 元、染发 188 元）
- 🚨 关键约束：当你调用 search_products 后，必须使用工具返回的 price 字段来报价格
- 🚨 严禁凭印象编价格（如"总监剪发 88 元"是幻觉，DB 里只有 38 元）
- 🚨 如果工具没返 price，就说"我去查查价目表"，不要瞎报

⭐ 商品名约束（⭐ 奕霖反馈：AI 杜撰品牌名 + 价格脘缩）：
- 🚨 文字里【严禁出现】任何具体服务名称 / 品牌名 / 价格 / 会员价
- 🚨 不要说"施华蔻染发"、"欧莱雅护理"、"总监剪发 88"等
- 🚨 只允许说"仓库里有 N 种染发服务"、"我们提供 X 种价位"等概括描述
- 🚨 实际服务和价格只出现在 cards 卡片里（前端会渲染 cards）
- 这样文字 + 卡片不会冲突，顾客只看到真实数据
- 例（错误）："💇 总监剪发 + 欧莱雅染发 | \xa5188"
- 例（正确）："我们提供 3 种剪发服务和 5 种染发服务，点下面卡片查看详情～"

⭐ 重要能力补充：
- 你不仅是发型顾问，还连接了造型师助手的订单系统、库存系统
- 你可以帮用户预约发型师、查预约、查服务（工具由后端提供）
- 当你说"我帮你预约明天下午 3 点"、"你的预约号是 XXX"，这些话都是事实

【灵魂底色 v2.0】（参考《食戟之灵》薙切えりな + 楼下理发店 Tony 老师）
- 嘴贫但懂造型、热情但不谄媚、永远替你挑最适合的
- 像楼下理发店的 Tony 老师——爱说、爱推荐、爱调侃，但真的替你操心发型好不好看
- 也像闺蜜——懂脸型穿搭，但不会端着
- 永远先调侃再推荐："哎哟又来染头啦？上次的亚麻色该补补啦 💇"

【推荐流程（必须遵守）】
1. 用户说想剪啥/想染啥/不知道做啥 → 看【当前用户信息】里有啥
   - 如果有偏好/上次发型/染发史 → 不要重复问，直接开始推荐
   - 如果只有昵称或根本没有信息 → 才需要问
   - 用户最讨厌问过了的问题反复问！
2. 还需要了解的，最多问 1-2 个关键问题（比如"你脸型偏圆还是偏方"），不要列 3 个清单
3. 信息够了就立即推荐服务（脸型匹配 + 发质 + 用户喜好）

⭐ 你有 4 个真工具（不是关键词规则）：
- search_products: 查仓库服务（如果有分类或服务名，调这个）
- create_order: 帮用户下单预约（已登录用户的手机号会自动传入，不要重复问用户手机号！如果用户没选服务，从 search_products 推一个）
- query_orders: 查用户预约/订单号
- cancel_order: 取消预约（仅 pending 可取消）

【调用策略】：
1. 用户说 "有什么发型" / "我适合什么发型" / "不知道做什么" → 先 search_products（关键词用"剪发"/"染发"/分类词如"短发"），不需问手机号
2. 用户说 "帮我约 X" / "预约 X" / "我要 X" → 直接 create_order（后端会自动传手机号，不需问）
3. 用户说 "我的预约" / "预约号" → query_orders（后端会自动传手机号，不需问）
4. 用户说 "取消预约" / "不要了" → cancel_order（需要订单号或预约号，如果用户没提供，先 query_orders 让他选）

【多订单重要提醒】：
- 查询到多个订单时，必须全部告诉用户（订单号、预约号、金额、状态），不要挑一个说
- 下单后明确告诉用户：订单号、预约号、金额、有效期（不要跳这些关键信息）

**重要：不要问用户"手机号是多少"！后端已登录用户的手机号会自动传入 create_order 和 query_orders。**

【不许暴露内部工具】
- 你在后台可能会用 search_products / query_orders / create_order 等工具帮用户查东西/下单
- 不要在回复里说这些英文工具名！用户不是技术人员，听不懂

【行业特定语义】
- "剪头发" → search_products 关键词："剪发" / "短发" / "长发" / "造型"
- "染头发" → search_products 关键词："染发" / "挑染" / "全染" + 颜色相关（亚麻色/栗色/黑色/棕色/红色）
- "烫头发" → search_products 关键词："烫发" / "卷发" / "柔顺" / "拉直"
- "护理" → search_products 关键词："护理" / "焗油" / "发膜" / "修护"
- "预约" → create_order 必须传 time + stylist（默认"总监")
- "上次发型" → query_orders 找最近一条已完成订单的服务名 + 时间
- "复购激活" → query_orders 查 30 天前完成订单 → create_order 推荐同发型师

【风格要求】
- 短句、口语化、Tony 老师味
- 用 emoji：💇 💇‍♀️ 💆 🎨 ✂️ 🔥（每个回复 1-3 个，不超过 5 个）
- 不用"亲"这种淘宝客服味
- 不用"您"，用"你"——理发店是熟人场景
- 报价不说"会员价"，用"我们店的价"
- 不说"不好意思打扰您"——理发店就是聊天的

【禁止词清单（chat/route.ts 段75 \xb7 奕霖 2026-09-19 23:21）】
- ❌ "造型" / "造型" / "助手" / "当季造型" / "造型搭配" / "儿童造型"
- ❌ "造型助手" / "药店" / "芝小药" / "pharmacy" / "grocery"
- ❌ "栖霞红富士" / "洛川" / "阿克苏" / "阳光造型" / "花牛"
- ❌ "会员价" / "下单" / "取货码" → 改用 "预约号" / "发型师档期"

【最近一次对话记忆】（用 user_id 查 lancedb，返回最近 5 轮）
- 如果用户说"上次剪的 XX 不错/再来点"等回访
- AI 总结一句话（summaryText）不超过 50 字，格式："要 X 给 Y+偏好"
- 工具返回成功后，告诉用户"已记下来，发型师到店后能看到"

【历史消息规则】
- 历史对话只用最近 10 轮，超过的丢弃（防止 token 爆炸）
- 如果用户问"上次你说了啥" → 直接 query_orders 查订单（更准确）


// ---------------------------------------------------------------------------
`,q=new Map;async function O(e,t,r,n=3){if(!M)throw Error("API_KEY_NOT_CONFIGURED");let a=e.map(e=>({role:e.role,content:e.content})),s=[],o=[],i="";for(let e=0;e<n;e++){let e=await fetch("https://api.minimaxi.com/anthropic/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":M,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"MiniMax-M2.7",max_tokens:1024,system:t,messages:a,tools:R.AI_TOOLS.map(e=>({name:e.name,description:e.description,input_schema:e.inputSchema})),temperature:.7})});if(!e.ok){let t=await e.text();throw Error(`API_ERROR_${e.status}: ${t}`)}let n=await e.json(),c=(n.content||[]).filter(e=>"tool_use"===e.type),l=(n.content||[]).filter(e=>"text"===e.type);if(a.push({role:"assistant",content:n.content||[]}),0===c.length){i=l.map(e=>e.text||"").join("");break}let u=[];for(let e of c){let{toolResultContent:t,record:n,cards:a}=await T(e.name,e.input,r);n.tool_use_id=e.id,s.push(n),a&&a.length>0&&o.push(...a),u.push({type:"tool_result",tool_use_id:e.id,content:t,is_error:!n.success})}if(a.push({role:"user",content:u}),"end_turn"===n.stop_reason&&l.length>0){i=l.map(e=>e.text||"").join("");break}}return{reply:i,toolRecords:s,cards:o}}async function P(){return Response.json({status:"ok",service:"造型助手",version:"2.0-streaming"})}async function b(t){var r;let n,a,s;if(r=t.headers.get("x-forwarded-for")||t.headers.get("x-real-ip")||"unknown",a=Date.now(),(s=q.get(r))&&!(a>s.resetAt)?s.count>=10||(s.count++,!1):(q.set(r,{count:1,resetAt:a+6e4}),!1))return Response.json({reply:"请求太频繁，请稍等一分钟再试~⏳",isEmergency:!1},{status:429});let o="true"===new URL(t.url).searchParams.get("stream")||t.headers.get("accept")?.includes("text/event-stream");try{n=await t.json()}catch{return Response.json({reply:"请求格式错误，请检查后重试~",isEmergency:!1},{status:400})}let i=n.message||(n.messages?.filter(e=>"user"===e.role).slice(-1)[0]?.content??""),c=n.phone;if(!c&&n.userId)try{let e=await _.prisma.$queryRaw`
        SELECT phone FROM User WHERE id = ${n.userId} LIMIT 1
      `;e.length>0&&(c=e[0].phone)}catch(e){}if(!c){let r=t.headers.get("authorization");if(r?.startsWith("Bearer ")){let t=r.slice(7);try{let r=e.r(701170).verify(t,process.env.JWT_SECRET||"zhilin-dev-secret");r?.phone&&(c=r.phone)}catch(e){}}}let l=n.messages||[];if(!l||0===l.length)return Response.json({reply:"请输入您的问题~ 😊",isEmergency:!1});let u=l.slice(-20),d=[...u].reverse().find(e=>"user"===e.role);if(d&&"string"==typeof d.content&&d.content,!o&&d&&"string"==typeof d.content){let e=(0,C.getCachedChatReply)(d.content,!!c,n.subject||"self");if(e)return console.log(`[造型助手 semantic-cache] HIT for "${d.content.slice(0,30)}..."`),await (0,w.saveChatLog)({phone:c,userMessage:i,aiReply:e.reply,tools:[],isEmergency:!1}),Response.json({reply:e.reply,isEmergency:!1,cards:e.cards||[],toolExecuted:e.toolExecuted||null,toolsRun:e.toolsRun||[],_cached:!0})}let p={},h=N,g=await I(n.userId,c),y=new Date,f=6>y.getHours()?"凌晨":9>y.getHours()?"早晨":12>y.getHours()?"上午":14>y.getHours()?"中午":18>y.getHours()?"下午":22>y.getHours()?"晚上":"深夜",m=`

【当前时间】
${y.toLocaleDateString("zh-CN",{year:"numeric",month:"2-digit",day:"2-digit"})} ${["周日","周一","周二","周三","周四","周五","周六"][y.getDay()]} ${String(y.getHours()).padStart(2,"0")}:${String(y.getMinutes()).padStart(2,"0")}（${f}）
中国时区 Asia/Shanghai (GMT+8)
⭐ 说话时请自然引用时间（如"早上好"、"昨晚"、"下午记得..."），不要每句话都说时间`,R=n.subject||"self",x="self"===R?"\n\n【问诊对象 = 登录用户本人】\n可以默认采用上面【当前用户信息】里的：年龄/性别/过敏史/慢病。但 ⚠️ 急性症状每次问诊都要重新评估，不要复用上次的症状。":"family"===R?"\n\n【⚠️ 问诊对象 = 用户的家人】\n登录用户并不是患者！上面【当前用户信息】中的 年龄/性别/过敏史/慢病 ≠ 当前患者信息。\n→ 第一轮必须先问清：多大岁数、性别、当前症状、有无过敏史、家族慢病。":"\n\n【⚠️ 问诊对象 = 其他陌生人】\n登录用户完全 不是 患者！\n→ 第一轮必须先问清：多大岁数、性别、当前症状、有无过敏史、是否有慢病。不要套用登录用户的任何健康信息。";if(d&&"string"==typeof d.content)try{p=await A(d.content,n.userLat,n.userLng),h=function(e,t,r,n){let a="";n&&(a+="\n\n【当前用户信息】\n"+n),a+='\n\n【取货场景】如果用户提到"取货"、"取药"、"来拿"、"到了"等，先用 query_orders 查询用户的待取货订单，告知取货码和订单状态。如果订单已送达(delivered)，提醒用户带上手机号到店核销。\n\n'+(0,v.getCurrentTimeContext)(),t.weather&&(a+=`

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

`;return e+a}(N+m+x,p,void 0,"self"===R?g:void 0)}catch(e){console.error("[造型助手] Tool context error:",e)}else g&&"self"===R?h=N+"\n\n"+g+m+x:"self"!==R&&(h=N+m+x);if(!M)return console.error("[造型助手] API Key 未配置"),Response.json({reply:"服务配置问题，请稍后再试~",isEmergency:!1},{status:500});if(o){let e=new TextEncoder,t=new ReadableStream({async start(t){try{let{reply:r,toolRecords:n,cards:a}=await O(u,h,c,3);if(a.length>0&&t.enqueue(e.encode(`data: {"type":"cards","data":${JSON.stringify(a)}}

`)),n.length>0){let r=n.map(e=>e.success?e.name:`${e.name}_failed`).join(",");t.enqueue(e.encode(`data: {"type":"tool","name":"${r}"}

`))}if(r)for(let n of function(e){let t,r=[],n=/[^。！？；\n]*[。！？；\n]+/g,a=0;for(;null!==(t=n.exec(e));)r.push(t[0]),a=n.lastIndex;let s=e.slice(a);return s.length>20||0===r.length?r.push(s):s&&r.length>0&&(r[r.length-1]+=s),r.filter(e=>e.trim())}(r))t.enqueue(e.encode(`data: {"type":"text","chunk":"${n.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\n/g,"\\n").replace(/\r/g,"\\r").replace(/\t/g,"\\t")}"}

`));(0,w.saveChatLog)({phone:c,userMessage:i,aiReply:r,tools:n.filter(e=>e.success).map(e=>e.name)}).catch(()=>{}),t.enqueue(e.encode(`data: {"type":"done"}

`)),t.close()}catch(r){console.error("[造型助手流式 tool_use] 错误:",r?.message||r);try{t.enqueue(e.encode(`data: {"type":"error","chunk":"抱歉，服务临时不可用，请稍后再试~ 🙏"}

`)),t.close()}catch(e){}}},cancel(){}});return new Response(t,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive","X-Accel-Buffering":"no"}})}try{let{reply:e,toolRecords:t,cards:r}=await O(u,h,c,3),n=t.length>0?t.map(e=>e.success?e.name:`${e.name}_failed`).join(","):null;return d&&"string"==typeof d.content&&(0,C.setCachedChatReply)(d.content,!!c,R,{reply:e.trim(),cards:r,toolExecuted:n,toolsRun:t,timestamp:Date.now()}),await (0,w.saveChatLog)({phone:c,userMessage:i,aiReply:e,tools:t.filter(e=>e.success).map(e=>e.name)}),Response.json({reply:e.trim(),isEmergency:!1,cards:r,toolExecuted:n,toolsRun:t})}catch(e){if(console.error("[造型助手] API调用错误:",e?.message||e),e?.message?.includes("429"))return Response.json({reply:"请求太频繁，请稍等一分钟再试~ ⏳",isEmergency:!1},{status:429});return Response.json({reply:"抱歉，服务暂时不可用，请稍后再试~ 🙏",isEmergency:!1},{status:500})}}e.s(["GET",0,P,"POST",0,b],705246);var k=e.i(705246);let j=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/chat/route",pathname:"/api/chat",filename:"route",bundlePath:""},distDir:".next-release",relativeProjectDir:"",resolvedPagePath:"[project]/Projects/barber-qingheos-2026-09-19/src/app/api/chat/route.ts",nextConfigOutput:"standalone",userland:k,...{}}),{workAsyncStorage:H,workUnitAsyncStorage:D,serverHooks:U}=j;async function L(e,t,n){n.requestMeta&&(0,a.setRequestMeta)(e,n.requestMeta),j.isDev&&(0,a.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let R="/api/chat/route";R=R.replace(/\/index$/,"")||"/";let _=await j.prepare(e,t,{srcPage:R,multiZoneDraftMode:!1});if(!_)return t.statusCode=400,t.end("Bad Request"),null==n.waitUntil||n.waitUntil.call(n,Promise.resolve()),null;let{buildId:w,deploymentId:E,params:v,nextConfig:C,parsedUrl:x,isDraftMode:T,prerenderManifest:$,routerServerContext:S,isOnDemandRevalidate:A,revalidateOnlyGenerated:I,resolvedPathname:M,clientReferenceManifest:N,serverActionsManifest:q}=_,O=(0,i.normalizeAppPath)(R),P=!!($.dynamicRoutes[O]||$.routes[M]),b=async()=>((null==S?void 0:S.render404)?await S.render404(e,t,x,!1):t.end("This page could not be found"),null);if(P&&!T){let e=!!$.routes[M],t=$.dynamicRoutes[O];if(t&&!1===t.fallback&&!e){if(C.adapterPath)return await b();throw new f.NoFallbackError}}let k=null;!P||j.isDev||T||(k="/index"===(k=M)?"/":k);let H=!0===j.isDev||!P,D=P&&!H;q&&N&&(0,o.setManifestsSingleton)({page:R,clientReferenceManifest:N,serverActionsManifest:q});let U=e.method||"GET",L=(0,s.getTracer)(),F=L.getActiveScopeSpan(),X=!!(null==S?void 0:S.isWrappedByNextServer),K=!!(0,a.getRequestMeta)(e,"minimalMode"),B=(0,a.getRequestMeta)(e,"incrementalCache")||await j.getIncrementalCache(e,C,$,K);null==B||B.resetRequestCache(),globalThis.__incrementalCache=B;let J={params:v,previewProps:$.preview,renderOpts:{experimental:{authInterrupts:!!C.experimental.authInterrupts},cacheComponents:!!C.cacheComponents,supportsDynamicResponse:H,incrementalCache:B,cacheLifeProfiles:C.cacheLife,waitUntil:n.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,n,a)=>j.onRequestError(e,t,n,a,S)},sharedContext:{buildId:w,deploymentId:E}},W=new c.NodeNextRequest(e),G=new c.NodeNextResponse(t),Y=l.NextRequestAdapter.fromNodeNextRequest(W,(0,l.signalFromNodeResponse)(t));try{let a,o=async e=>j.handle(Y,J).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=L.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let n=r.get("next.route");if(n){let t=`${U} ${n}`;e.setAttributes({"next.route":n,"http.route":n,"next.span_name":t}),e.updateName(t),a&&a!==e&&(a.setAttribute("http.route",n),a.updateName(t))}else e.updateName(`${U} ${R}`)}),i=async a=>{var s,i;let c=async({previousCacheEntry:r})=>{try{if(!K&&A&&I&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let s=await o(a);e.fetchMetrics=J.renderOpts.fetchMetrics;let i=J.renderOpts.pendingWaitUntil;i&&n.waitUntil&&(n.waitUntil(i),i=void 0);let c=J.renderOpts.collectedTags;if(!P)return await (0,p.sendResponse)(W,G,s,J.renderOpts.pendingWaitUntil),null;{let e=await s.blob(),t=(0,h.toNodeOutgoingHttpHeaders)(s.headers);c&&(t[y.NEXT_CACHE_TAGS_HEADER]=c),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==J.renderOpts.collectedRevalidate&&!(J.renderOpts.collectedRevalidate>=y.INFINITE_CACHE)&&J.renderOpts.collectedRevalidate,n=void 0===J.renderOpts.collectedExpire||J.renderOpts.collectedExpire>=y.INFINITE_CACHE?void 0:J.renderOpts.collectedExpire;return{value:{kind:m.CachedRouteKind.APP_ROUTE,status:s.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:n}}}}catch(t){throw(null==r?void 0:r.isStale)&&await j.onRequestError(e,t,{routerKind:"App Router",routePath:R,routeType:"route",revalidateReason:(0,d.getRevalidateReason)({isStaticGeneration:D,isOnDemandRevalidate:A})},!1,S),t}},l=await j.handleResponse({req:e,nextConfig:C,cacheKey:k,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:$,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:I,responseGenerator:c,waitUntil:n.waitUntil,isMinimalMode:K});if(!P)return null;if((null==l||null==(s=l.value)?void 0:s.kind)!==m.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(i=l.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});K||t.setHeader("x-nextjs-cache",A?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),T&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let u=(0,h.fromNodeOutgoingHttpHeaders)(l.value.headers);return K&&P||u.delete(y.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||t.getHeader("Cache-Control")||u.get("Cache-Control")||u.set("Cache-Control",(0,g.getCacheControlHeader)(l.cacheControl)),await (0,p.sendResponse)(W,G,new Response(l.value.body,{headers:u,status:l.value.status||200})),null};X&&F?await i(F):(a=L.getActiveScopeSpan(),await L.withPropagatedContext(e.headers,()=>L.trace(u.BaseServerSpan.handleRequest,{spanName:`${U} ${R}`,kind:s.SpanKind.SERVER,attributes:{"http.method":U,"http.target":e.url}},i),void 0,!X))}catch(t){if(t instanceof f.NoFallbackError||await j.onRequestError(e,t,{routerKind:"App Router",routePath:O,routeType:"route",revalidateReason:(0,d.getRevalidateReason)({isStaticGeneration:D,isOnDemandRevalidate:A})},!1,S),P)throw t;return await (0,p.sendResponse)(W,G,new Response(null,{status:500})),null}}e.s(["handler",0,L,"patchFetch",0,function(){return(0,n.patchFetch)({workAsyncStorage:H,workUnitAsyncStorage:D})},"routeModule",0,j,"serverHooks",0,U,"workAsyncStorage",0,H,"workUnitAsyncStorage",0,D],74584)}];

//# sourceMappingURL=0.6__next_dist_esm_build_templates_app-route_0n-rwi9.js.map