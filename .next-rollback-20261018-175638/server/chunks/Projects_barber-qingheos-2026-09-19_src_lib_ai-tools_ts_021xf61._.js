module.exports=[61335,106698,457587,738445,e=>{"use strict";var t=e.i(162797);class r{store=new Map;ttlMs;maxSize;constructor(e=3e5,t=200){this.ttlMs=e,this.maxSize=t}get(e){let t=this.store.get(e);if(t)return Date.now()>t.expiresAt?void this.store.delete(e):t.data}set(e,t,r){if(this.store.size>=this.maxSize){let e=this.store.keys().next().value;e&&this.store.delete(e)}this.store.set(e,{data:t,expiresAt:Date.now()+(r??this.ttlMs)})}delete(e){this.store.delete(e)}clear(){this.store.clear()}size(){return this.store.size}async wrap(e,t,r){let s=this.get(e);if(void 0!==s)return s;let a=await t();return this.set(e,a,r),a}}let s=globalThis.__qinghe_cache??new r(3e5,200);globalThis.__qinghe_cache||(globalThis.__qinghe_cache=s);let a="G0001",o={pending:"待付款",paid:"已付款",preparing:"备货中",ready:"可取货",delivered:"已取货",cancelled:"已取消",refunded:"已退款",completed:"已完成"};async function i(e){let{phone:r,orderNo:s,limit:i=5,status:n}=e,c=[];try{if(s)if(!r)return[];else c=await t.prisma.$queryRaw`
          SELECT o.id, o.orderNo, o.status, o.pickupCode, o.pickupExpiresAt,
                 o.finalAmount, o.createdAt
          FROM "Order" o
          JOIN Merchant m ON o.merchantId = m.id
          LEFT JOIN Customer c ON o.customerId = c.id
          WHERE m.code = ${a} AND o.orderNo = ${s} AND c.phone = ${r}
          LIMIT 1
        `;else r&&(c=n?await t.prisma.$queryRaw`
          SELECT o.id, o.orderNo, o.status, o.pickupCode, o.pickupExpiresAt,
                 o.finalAmount, o.createdAt
          FROM "Order" o
          JOIN Merchant m ON o.merchantId = m.id
          LEFT JOIN Customer c ON o.customerId = c.id
          WHERE m.code = ${a} AND c.phone = ${r} AND o.status = ${n}
          ORDER BY o.createdAt DESC
          LIMIT ${i}
        `:await t.prisma.$queryRaw`
          SELECT o.id, o.orderNo, o.status, o.pickupCode, o.pickupExpiresAt,
                 o.finalAmount, o.createdAt
          FROM "Order" o
          JOIN Merchant m ON o.merchantId = m.id
          LEFT JOIN Customer c ON o.customerId = c.id
          WHERE m.code = ${a} AND c.phone = ${r}
          ORDER BY o.createdAt DESC
          LIMIT ${i}
        `)}catch(e){return console.error("[ai-cards] query error:",e?.message),[]}if(0===c.length)return[];let d=c.map(e=>e.id),p=[];try{p=d.length>0?await t.prisma.$queryRawUnsafe(`SELECT orderId, productName, quantity FROM OrderItem WHERE orderId IN (${d.map(()=>"?").join(",")})`,...d):[]}catch(e){console.error("[ai-cards] items query error:",e?.message)}let u=new Map;for(let e of p)u.has(e.orderId)||u.set(e.orderId,[]),u.get(e.orderId).push({name:e.productName,quantity:e.quantity});return c.map(e=>{let t=u.get(e.id)||[],r=t.reduce((e,t)=>e+t.quantity,0),s=0===t.length?"（无商品信息）":1===t.length?`${t[0].name} \xd7 ${t[0].quantity}`:`${t[0].name} 等 ${t.length} 件商品`;return{type:"order",orderId:e.id,orderNo:e.orderNo,status:e.status,statusLabel:o[e.status]||e.status,pickupCode:e.pickupCode||void 0,pickupExpiresAt:e.pickupExpiresAt||void 0,finalAmount:e.finalAmount,itemCount:r,itemSummary:s,createdAt:e.createdAt}})}let n="G0001",c=[{name:"create_order",description:`创建订单（用户/AI 主动下单）。当用户说"我要买"、"帮我下单"、"来一盒 X"时调用。
成功后返回订单号 + 6 位取货码（用户到店凭码取货 + 支付）。
注意：当前 0-1 阶段不接支付，订单默认 pickup（到店取货）+ simulateComplete=false（真实取货码）。`,inputSchema:{type:"object",properties:{phone:{type:"string",description:"顾客手机号（必填）"},customerName:{type:"string",description:"顾客姓名（可选）"},items:{type:"array",description:"商品列表（至少 1 个）",items:{type:"object",properties:{name:{type:"string",description:'商品名（如"感冒灵颗粒"）'},quantity:{type:"number",description:"数量（默认 1）"}},required:["name"]}},remark:{type:"string",description:"订单备注（可选）"}},required:["phone","items"]}},{name:"query_orders",description:'查询用户的订单（返回最近 5 个订单的卡片数据）。用户问"我的订单"、"取货码"、"我买了什么"时调用。',inputSchema:{type:"object",properties:{phone:{type:"string",description:"用户手机号"},orderNo:{type:"string",description:"订单号（ORD 开头，可选）"},limit:{type:"number",description:"返回数量（默认 5）"}},required:["phone"]}},{name:"search_products",description:'搜索商品（用于推荐/查询库存）。用户问"有没有 X"、"X 多少钱"、"有什么感冒药"时调用。',inputSchema:{type:"object",properties:{keyword:{type:"string",description:"商品关键词（必填）"},limit:{type:"number",description:"返回数量（默认 5）"}},required:["keyword"]}},{name:"cancel_order",description:`取消订单（仅 pending 状态的订单可取消）。当用户说"取消订单"、"不要了"、"退掉"时调用。
需要订单号（ORD 开头）或取货码。
如果用户没提供订单号/取货码，先调用 query_orders 列出用户订单让用户选。`,inputSchema:{type:"object",properties:{phone:{type:"string",description:"用户手机号（必填，自动注入）"},orderNo:{type:"string",description:"订单号（ORD 开头）"},pickupCode:{type:"string",description:"6 位取货码"}},required:["phone"]}},{name:"add_user_need",description:'记录用户需求/偏好（不一定要下单）。用户说"我想做XX""给老人要软的""便宜点""明天要"等隐性需求时调用。商家到店后可按手机号查看用户最近需求。',inputSchema:{type:"object",properties:{phone:{type:"string",description:"用户手机号（必填，自动注入）"},needText:{type:"string",description:"用户原话（必填）"},summaryText:{type:"string",description:"AI 一句话总结（不超过 50 字）"},customerName:{type:"string",description:"用户昵称（可选）"}},required:["phone","needText"]}}];async function d(e){if(!e.phone)return{success:!1,error:"手机号必填"};if(!e.items||0===e.items.length)return{success:!1,error:"商品列表不能为空"};try{let r=e.items.map(e=>e.name).filter(Boolean);if(0===r.length)return{success:!1,error:"至少需要一个商品名"};let s=r[0],a=await t.prisma.$queryRaw`
      SELECT p.id, p.name, p.spec, p.price, p.stock, p.status
      FROM Product p
      JOIN Merchant m ON p.merchantId = m.id
      WHERE m.code = ${n}
        AND (p.name LIKE ${`%${s}%`} OR p.name LIKE ${`%${s.replace(/润/g,"g")}%`})
        AND p.status = 'active'
        AND p.stock > 0
      ORDER BY p.price ASC
      LIMIT 1
    `;if(0===a.length){let e=await t.prisma.$queryRaw`
        SELECT p.name, p.stock FROM Product p
        JOIN Merchant m ON p.merchantId = m.id
        WHERE m.code = ${n}
          AND p.name LIKE ${`%${s}%`}
          AND p.status = 'active'
        ORDER BY p.price ASC
        LIMIT 3
      `;if(e.length>0){let t=e.map(e=>e.name).join("、");return{success:!1,error:`"${s}"暂时没货了（找到的：${t} 都没库存）。建议：让用户描述要啥或问其他常见商品。`}}return console.log("[ai-tools] 商品未找到:",s),{success:!1,error:`没找到"${s}"这个商品。建议：让用户描述症状或问你其他常见商品。`}}console.log("[ai-tools] 找到商品:",a[0]);let o=a[0],i=`ord_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,c=`ORD${function(e=new Date){let t=new Date(e.getTime()+60*e.getTimezoneOffset()*1e3+288e5),r=t.getFullYear(),s=String(t.getMonth()+1).padStart(2,"0"),a=String(t.getDate()).padStart(2,"0"),o=String(t.getHours()).padStart(2,"0"),i=String(t.getMinutes()).padStart(2,"0"),n=String(t.getSeconds()).padStart(2,"0");return`${r}${s}${a}${o}${i}${n}`}()}${Math.floor(1e3*Math.random()).toString().padStart(3,"0")}`,d=e.items[0].quantity||1,p=o.price,u=p*d,m=e.customerName||"AI 顾客",l=await t.prisma.$queryRaw`
      SELECT id FROM Customer
      WHERE merchantId = (SELECT id FROM Merchant WHERE code = ${n})
        AND phone = ${e.phone}
      LIMIT 1
    `,h=await t.prisma.$queryRaw`
      SELECT id FROM Merchant WHERE code = ${n} LIMIT 1
    `,E=h[0]?.id;if(!E)return{success:!1,error:"商户不存在"};let $=l.length>0?l[0].id:`c_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;0===l.length&&await t.prisma.$executeRaw`
        INSERT INTO Customer (id, merchantId, phone, nickname, totalSpent, totalOrders, points, createdAt, updatedAt)
        VALUES (${$}, ${E}, ${e.phone}, ${m}, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;let g=null;for(let e=0;e<10;e++){let e=Math.floor(1e5+9e5*Math.random()).toString(),r=await t.prisma.$queryRaw`
        SELECT id FROM "Order" WHERE pickupCode = ${e} LIMIT 1
      `;if(0===r.length){g=e;break}}if(!g)return{success:!1,error:"取货码生成失败"};let y=new Date(Date.now()+6048e5).toISOString();await t.prisma.$executeRaw`
      INSERT INTO "Order" (
        id, merchantId, customerId, orderNo, totalAmount, discountAmount, pointsUsed, pointsValue, finalAmount,
        deliveryType, deliveryAddress, deliveryPhone, status, remark,
        pickupCode, pickupExpiresAt, createdAt, updatedAt
      ) VALUES (
        ${i}, ${E}, ${$}, ${c}, ${u}, 0, 0, 0, ${u},
        'pickup', null, ${e.phone}, 'pending', ${e.remark||`AI 下单：${s}`},
        ${g}, ${y}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `,await t.prisma.$executeRaw`
      INSERT INTO OrderItem (id, orderId, productId, productName, productSpec, price, quantity, subtotal)
      VALUES (${`oi_${Date.now()}_${Math.random().toString(36).slice(2,6)}`}, ${i}, ${o.id}, ${o.name}, ${o.spec||null}, ${p}, ${d}, ${u})
    `,await t.prisma.$executeRaw`
      UPDATE Customer
      SET totalSpent = totalSpent + ${u},
          totalOrders = totalOrders + 1,
          points = points + ${Math.floor(u)},
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${$}
    `;let R=await t.prisma.$executeRaw`
      UPDATE Product
      SET stock = stock - ${d},
          sales30d = COALESCE(sales30d, 0) + ${d},
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${o.id}
        AND stock >= ${d}
    `;if(0===R)return console.error("[ai-tools] 库存不足，回滚订单:",o.name),await t.prisma.$executeRaw`DELETE FROM "Order" WHERE id = ${i}`,await t.prisma.$executeRaw`DELETE FROM OrderItem WHERE orderId = ${i}`,{success:!1,error:`${o.name} 库存不够了，请试试其他商品。`};return console.log("[ai-tools] 库存已扣减:",o.name,"-",d),{success:!0,data:{orderId:i,orderNo:c,pickupCode:g,pickupExpiresAt:y,productName:o.name,spec:o.spec,quantity:d,price:p,finalAmount:u,status:"pending"},cards:[{type:"order",orderId:i,orderNo:c,status:"pending",statusLabel:"待付款",pickupCode:g,pickupExpiresAt:y,finalAmount:u,itemCount:d,itemSummary:`${o.name} \xd7 ${d}`,createdAt:new Date().toISOString()}]}}catch(e){return console.error("[ai-tools] create_order error FULL:",e?.message,e),{success:!1,error:`下单失败：${e?.message||"未知错误"}`}}}async function p(e){if(!e.phone&&!e.orderNo)return{success:!1,error:"手机号或订单号必填"};let t=await i({phone:e.phone,orderNo:e.orderNo,limit:e.limit||20});return 0===t.length?{success:!0,data:{count:0,message:"没找到相关订单",orders:[]},cards:[]}:{success:!0,data:{count:t.length,message:`找到 ${t.length} 个订单`,orders:t.map(e=>({orderNo:e.orderNo,pickupCode:e.pickupCode,status:e.statusLabel,finalAmount:e.finalAmount,itemSummary:e.itemSummary}))},cards:t}}async function u(e){if(!e.phone)return{success:!1,error:"手机号必填"};if(!e.orderNo&&!e.pickupCode)return{success:!1,error:"订单号或取货码必填（其一）"};try{let r=[];if(e.orderNo?r=await t.prisma.$queryRaw`
        SELECT id, orderNo, status, pickupCode, finalAmount, customerId, merchantId
        FROM "Order"
        WHERE orderNo = ${e.orderNo}
          AND merchantId = (SELECT id FROM Merchant WHERE code = ${n})
        LIMIT 1
      `:e.pickupCode&&(r=await t.prisma.$queryRaw`
        SELECT id, orderNo, status, pickupCode, finalAmount, customerId, merchantId
        FROM "Order"
        WHERE pickupCode = ${e.pickupCode}
          AND merchantId = (SELECT id FROM Merchant WHERE code = ${n})
        LIMIT 1
      `),0===r.length)return{success:!1,error:`没找到这个订单（订单号：${e.orderNo||""}，取货码：${e.pickupCode||""}）。请先调 query_orders 查看订单列表。`};let s=r[0],a=await t.prisma.$queryRaw`
      SELECT phone FROM Customer WHERE id = ${s.customerId} LIMIT 1
    `;if(0===a.length||a[0].phone!==e.phone)return{success:!1,error:"这个订单不属于你，不能取消"};if("pending"!==s.status)return{success:!1,error:`订单状态是【${s.status}】，不能取消（只能取消"待付款"状态的订单）。如果订单已支付，请到店协商退款。`};await t.prisma.$executeRaw`
      UPDATE "Order"
      SET status = 'cancelled', updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${s.id}
    `;let o=await t.prisma.$queryRaw`
      SELECT productId, quantity FROM OrderItem WHERE orderId = ${s.id}
    `;for(let e of o)await t.prisma.$executeRaw`
        UPDATE Product SET stock = stock + ${e.quantity}, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ${e.productId}
      `;let i=Math.floor(s.finalAmount||0);i>0&&await t.prisma.$executeRaw`
        UPDATE Customer
        SET points = MAX(0, points - ${i}),
            totalOrders = MAX(0, totalOrders - 1),
            totalSpent = MAX(0, totalSpent - ${s.finalAmount||0}),
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = ${s.customerId}
      `;let c={type:"order",orderId:s.id,orderNo:s.orderNo,status:"cancelled",statusLabel:"已取消",pickupCode:s.pickupCode,finalAmount:s.finalAmount,itemCount:o.length,cancelled:!0};return{success:!0,data:{orderNo:s.orderNo,pickupCode:s.pickupCode,status:"cancelled",message:`订单 ${s.orderNo} 已取消，库存已恢复`},cards:[c]}}catch(e){return console.error("[ai-tools] cancel_order error FULL:",e?.message,e),{success:!1,error:`取消失败：${e?.message||"未知错误"}`}}}async function m(e){if(!e.keyword)return{success:!1,error:"关键词必填"};try{let r=`search_products:${n}:${e.keyword}:${e.limit||5}`,a=await s.wrap(r,async()=>(await t.prisma.$queryRaw`
        SELECT
          p.id, p.name, p.shortName, p.spec, p.price, p.memberPrice,
          p.points, p.stock, p.image, p.productCode, p.weightGram,
          p.unit, p.sales30d, p.sales30_60d, p.sales60_90d,
          p.category, p.categoryLabel, p.qualityClass, p.description
        FROM Product p
        JOIN Merchant m ON p.merchantId = m.id
        WHERE m.code = ${n}
          AND p.name LIKE ${`%${e.keyword}%`}
          AND p.status = 'active'
        ORDER BY p.price ASC
        LIMIT ${e.limit||5}
      `).map(e=>({type:"product",productId:e.id,name:e.name,shortName:e.shortName,spec:e.spec,price:e.price,memberPrice:e.memberPrice,points:e.points,stock:e.stock,image:e.image,productCode:e.productCode,weightGram:e.weightGram,unit:e.unit,sales30d:e.sales30d,sales30_60d:e.sales30_60d,sales60_90d:e.sales60_90d,category:e.category,categoryLabel:e.categoryLabel,qualityClass:e.qualityClass,description:e.description,available:(e.stock||0)>0})),3e5);return{success:!0,data:{count:a.length,message:`找到 ${a.length} 个商品`},cards:a}}catch(e){return console.error("[ai-tools] search_products error:",e?.message),{success:!1,error:`搜索失败：${e?.message}`}}}async function l(e,t){switch(e){case"create_order":return d(t);case"query_orders":return p(t);case"search_products":return m(t);case"cancel_order":return u(t);case"add_user_need":return h(t);default:return{success:!1,error:`未知工具：${e}`}}}async function h(e){if(!e.phone)return{success:!1,error:"手机号必填"};if(!e.needText||0===e.needText.trim().length)return{success:!1,error:"需求文本不能为空"};try{let t=process.env.NEXT_PUBLIC_BASE_URL||"http://localhost:3020",r=await fetch(`${t}/api/user-needs`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userPhone:e.phone,userName:e.customerName||null,needText:e.needText,summaryText:e.summaryText||e.needText.slice(0,50),source:"chat"})}),s=await r.json();if(!r.ok||!s.success)return{success:!1,error:s.error||`HTTP ${r.status}`};return{success:!0,data:{id:s.id,summary:s.summary,message:"需求已记录，商家到店时可按手机号查看"}}}catch(e){return console.error("[executeAddUserNeed]",e),{success:!1,error:e.message||String(e)}}}e.s(["AI_TOOLS",0,c,"executeTool",0,l],61335);var E=e.i(254799);async function $(e){try{let r=(0,E.randomUUID)();return await t.prisma.$executeRawUnsafe(`INSERT INTO ChatLog (id, phone, userName, userMessage, aiReply, tools, isEmergency, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,r,e.phone||null,e.userName||null,e.userMessage.slice(0,1e3),e.aiReply.slice(0,2e3),JSON.stringify(e.tools||[]),+!!e.isEmergency,new Date().toISOString()),r}catch(e){return console.error("[chat-log] saveChatLog failed:",e?.message||e),null}}e.s(["saveChatLog",0,$],106698);let g="Asia/Shanghai";function y(e,t,r="self"){let s=e?e.toLowerCase().replace(/[\s\p{P}]+/gu," ").trim().slice(0,200):"",a=(0,E.createHash)("sha256").update(s).digest("hex").slice(0,16);return`zhilin:chat:${a}:${t?"auth":"guest"}:${r}`}e.s(["getCurrentTimeContext",0,function(){let e=(Intl.DateTimeFormat().resolvedOptions().timeZone!==g&&console.warn(`[time] Node 时区是 ${Intl.DateTimeFormat().resolvedOptions().timeZone}，不是 ${g}`),new Date),t=e.getFullYear(),r=e.getMonth()+1,s=e.getDate(),a=e.getHours(),o=e.getMinutes(),i=["日","一","二","三","四","五","六"][e.getDay()],n="上午";return a>=11&&a<14?n="中午":a>=14&&a<18?n="下午":a>=18&&a<22?n="晚上":(a>=22||a<6)&&(n="深夜"),`【【【实时时间（重要）】】】
当前北京时间（UTC+8）：${t}年${r}月${s}日 星期${i} ${n} ${a}:${o.toString().padStart(2,"0")}

⚠️ 重要规则：
- 用户问"几点了" / "今天几号" / "星期几" / "上午还是下午"，**必须用上面这个北京时间回答**
- **绝对不要瞎编时间、日期、星期**
- **不要因为是下午/晚上就说"晚安"**（用户没说告别，你不要主动结束）
- 如果用户说"晚安"或"再见"，才说晚安
- 回答时间时标注"北京时间"，避免用户困惑
`}],457587),e.s(["getCachedChatReply",0,function(e,t,r="self"){let a=y(e,t,r);return s.get(a)||null},"setCachedChatReply",0,function(e,t,r,a){if(!e||!(a.reply&&!(a.reply.length<5)&&(!a.cards||!(a.cards.length>0))&&!a.toolExecuted&&1))return;let o=y(e,t,r);s.set(o,{...a,timestamp:Date.now()},36e5)}],738445)}];

//# sourceMappingURL=Projects_barber-qingheos-2026-09-19_src_lib_ai-tools_ts_021xf61._.js.map