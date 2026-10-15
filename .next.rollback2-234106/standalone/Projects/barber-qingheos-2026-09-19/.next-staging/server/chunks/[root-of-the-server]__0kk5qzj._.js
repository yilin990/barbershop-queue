module.exports=[522734,(e,t,r)=>{t.exports=e.x("fs",()=>require("fs"))},918622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},832319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},556704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},270406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},814747,(e,t,r)=>{t.exports=e.x("path",()=>require("path"))},193695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},630085,(e,t,r)=>{t.exports=e.x("better-sqlite3-f3cc2ebec5cdad24",()=>require("better-sqlite3-f3cc2ebec5cdad24"))},167022,e=>{"use strict";class t extends Error{status=500;code="INTERNAL_ERROR";constructor(e){super(e||"服务器错误"),this.name="ApiError"}}e.s(["AuthError",0,class extends t{constructor(e="请先登录"){super(e),this.status=401,this.code="AUTH_REQUIRED",this.name="AuthError"}},"ConflictError",0,class extends t{constructor(e="资源冲突"){super(e),this.status=409,this.code="CONFLICT",this.name="ConflictError"}},"NotFoundError",0,class extends t{constructor(e="资源不存在"){super(e),this.status=404,this.code="NOT_FOUND",this.name="NotFoundError"}},"RateLimitError",0,class extends t{constructor(e="请求太频繁，请稍后再试"){super(e),this.status=429,this.code="RATE_LIMITED",this.name="RateLimitError"}},"ValidationError",0,class extends t{constructor(e){super(e),this.status=400,this.code="VALIDATION_ERROR",this.name="ValidationError"}},"errorResponse",0,function(e,r=500){if(e instanceof t)return Response.json({success:!1,error:e.message,code:e.code},{status:e.status});if(e&&"object"==typeof e&&"success"in e&&!1===e.success)return Response.json(e,{status:r});let o=e instanceof Error?e.message:"string"==typeof e?e:"服务器错误";return r>=500&&console.error("[error]",e),Response.json({success:!1,error:o,code:"INTERNAL_ERROR"},{status:r})},"successResponse",0,function(e,t=200){return Response.json({success:!0,..."object"==typeof e&&null!==e?e:{data:e}},{status:t})}])},861143,e=>{"use strict";var t=e.i(814747);function r(){let e=process.cwd(),r=t.default.join(".next","standalone"),o=e.indexOf(r);return -1!==o?e.slice(0,o):e}e.s(["projectRoot",0,r,"resolveDbPath",0,function(){return process.env.MEMBER_DB_PATH?process.env.MEMBER_DB_PATH:t.default.join(r(),"prisma","dev.db")}])},233405,(e,t,r)=>{t.exports=e.x("child_process",()=>require("child_process"))},202572,e=>{"use strict";var t=e.i(162797);async function r(e){for(let e=0;e<10;e++){let e=Math.floor(1e5+9e5*Math.random()).toString();if(0===(await t.prisma.$queryRaw`
      SELECT id FROM "Order" WHERE pickupCode = ${e} LIMIT 1
    `).length)return e}throw Error("取货码生成失败，请重试")}async function o(e,r){if(!/^\d{6}$/.test(e))return{success:!1,error:"取货码格式错误（需 6 位数字）"};let o=await t.prisma.$queryRaw`
    SELECT * FROM "Order"
    WHERE pickupCode = ${e}
    LIMIT 1
  `;if(0===o.length)return{success:!1,error:"取货码不存在"};let a=o[0];return a.pickedUpAt?{success:!1,error:"取货码已使用"}:"cancelled"===a.status?{success:!1,error:"订单已取消，取货码作废"}:a.pickupExpiresAt&&new Date(a.pickupExpiresAt)<new Date?{success:!1,error:"取货码已过期，请重新下单"}:(await t.prisma.$executeRaw`
    UPDATE "Order"
    SET pickedUpAt = CURRENT_TIMESTAMP, pickedUpBy = ${r},
        status = 'delivered', completedAt = CURRENT_TIMESTAMP,
        updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${a.id}
  `,{success:!0,order:{id:a.id,orderNo:a.orderNo,finalAmount:a.finalAmount,itemCount:a.items?.length||0}})}e.s(["PICKUP_CODE_EXPIRES_MS",0,6048e5,"generatePickupCode",0,r,"redeemPickupCode",0,o])},388820,e=>{"use strict";e.i(162797),e.s(["genId",0,function(e){return`${e}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`},"genOrderNo",0,function(){let e=Date.now().toString(),t=Math.floor(1e3*Math.random()).toString().padStart(3,"0");return`ORD${e}${t}`}])},96043,e=>{"use strict";var t=e.i(390089),r=e.i(162797),o=e.i(202572),a=e.i(388820),n=e.i(167022);let i="G0001";async function s(e){let s,{merchantCode:d=i,customerName:u,phone:c,items:l,deliveryType:p="pickup",deliveryAddress:m,deliveryPhone:E,remark:h,simulateComplete:R=!1,groupBuyId:w,actualPaidAmount:I,source:$="normal"}=e,A=e.actualPaidAmount??e.posRecordedAmount??0;if(!c)throw new n.ValidationError("缺少必填字段: phone");if(!l||!Array.isArray(l)||0===l.length)throw new n.ValidationError("缺少必填字段: items (非空数组)");if(e.merchantId){let t=await r.prisma.$queryRaw`
      SELECT id, code, name FROM Merchant WHERE id = ${e.merchantId} LIMIT 1
    `;if(0===t.length)throw new n.NotFoundError("商户不存在");s=t[0].id}else{let e=await r.prisma.$queryRaw`
      SELECT id, code, name FROM Merchant WHERE code = ${d} LIMIT 1
    `;if(0===e.length)throw new n.NotFoundError("商户不存在");s=e[0].id}let g=l.map(e=>e.productId).filter(Boolean),f=new Map((g.length>0?await r.prisma.$queryRaw`
        SELECT id, name, spec, price, image FROM Product WHERE id IN (${t.Prisma.join(g)})
      `:[]).map(e=>[e.id,e])),N=0,T=l.map(e=>{let t=e.productId?f.get(e.productId):null,r=e.price??t?.price??0,o=e.quantity??1,n=r*o;return N+=n,{id:(0,a.genId)("oi"),productId:e.productId||t?.id||"",productName:e.name||t?.name||"商品",productSpec:e.spec||t?.spec||null,productImage:e.image||t?.image||null,price:r,quantity:o,subtotal:n}}),C=Math.max(0,N),O=(0,a.genId)("ord"),S=(0,a.genOrderNo)(),y=R?"completed":"pending",x=new Date().toISOString(),v=null,M=null;"pickup"!==p||R||(v=await (0,o.generatePickupCode)(d),M=new Date(Date.now()+o.PICKUP_CODE_EXPIRES_MS).toISOString());let D=await r.prisma.$queryRaw`
    SELECT id FROM Customer WHERE merchantId = ${s} AND phone = ${c} LIMIT 1
  `,P=D.length>0?D[0].id:(0,a.genId)("c");for(let e of(0===D.length&&await r.prisma.$executeRaw`
      INSERT INTO Customer (id, merchantId, phone, nickname, totalSpent, totalOrders, points, createdAt, updatedAt)
      VALUES (${P}, ${s}, ${c}, ${u||"顾客"}, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,await r.prisma.$executeRaw`
    INSERT INTO "Order" (
      id, merchantId, customerId, orderNo, totalAmount, discountAmount, pointsUsed, pointsValue, finalAmount,
      deliveryType, deliveryAddress, deliveryPhone, status, paidAt, completedAt, remark,
      pickupCode, pickupExpiresAt, source, groupBuyId, posRecordedAmount, createdAt, updatedAt
    ) VALUES (
      ${O}, ${s}, ${P}, ${S}, ${N}, 0, 0, 0, ${C},
      ${p}, ${m||null}, ${E||c}, ${y},
      ${R?x:null}, ${R?x:null}, ${h||null},
      ${v}, ${M},
      ${$}, ${w||null},
      ${A},
      ${x}, ${x}
    )
  `,T))await r.prisma.$executeRaw`
      INSERT INTO OrderItem (id, orderId, productId, productName, productSpec, productImage, price, quantity, subtotal)
      VALUES (${e.id}, ${O}, ${e.productId||null}, ${e.productName}, ${e.productSpec}, ${e.productImage}, ${e.price}, ${e.quantity}, ${e.subtotal})
    `;return{orderId:O,orderNo:S,totalAmount:N,finalAmount:C,status:y,itemCount:T.length,createdAt:x,pickupCode:v,pickupExpiresAt:M,membership:null}}async function d(e){let o,a=e.merchantCode,s=e.phone,d=e.status,u=e.limit||50;if(!s)throw new n.ValidationError("需提供 phone 参数");if(!a){let e,o=(await r.prisma.$queryRaw`
      SELECT id, merchantId FROM Customer WHERE phone = ${s}
    `).map(e=>e.id),a=(e=o.length>0?d?await r.prisma.$queryRaw`
            SELECT * FROM "Order"
            WHERE (customerId IN (${t.Prisma.join(o)}) OR deliveryPhone = ${s})
              AND status = ${d}
            ORDER BY createdAt DESC LIMIT ${u}
          `:await r.prisma.$queryRaw`
            SELECT * FROM "Order"
            WHERE (customerId IN (${t.Prisma.join(o)}) OR deliveryPhone = ${s})
            ORDER BY createdAt DESC LIMIT ${u}
          `:d?await r.prisma.$queryRaw`
            SELECT * FROM "Order"
            WHERE deliveryPhone = ${s} AND status = ${d}
            ORDER BY createdAt DESC LIMIT ${u}
          `:await r.prisma.$queryRaw`
            SELECT * FROM "Order"
            WHERE deliveryPhone = ${s}
            ORDER BY createdAt DESC LIMIT ${u}
          `).map(e=>e.id),n=a.length>0?await r.prisma.$queryRaw`
          SELECT * FROM OrderItem WHERE orderId IN (${t.Prisma.join(a)})
        `:[],i=new Map;for(let e of n)i.has(e.orderId)||i.set(e.orderId,[]),i.get(e.orderId).push(e);return{orders:e.map(e=>({...e,items:i.get(e.id)||[]}))}}let c=a||i,l=await r.prisma.$queryRaw`
    SELECT id, code, name FROM Merchant WHERE code = ${c} LIMIT 1
  `;if(0===l.length)throw new n.NotFoundError("商户不存在");let p=l[0].id,m=await r.prisma.$queryRaw`
    SELECT id FROM Customer WHERE merchantId = ${p} AND phone = ${s} LIMIT 1
  `,E=m.length>0?m[0].id:null,h=(o=E?d?await r.prisma.$queryRaw`
          SELECT * FROM "Order"
          WHERE merchantId = ${p}
            AND (customerId = ${E} OR deliveryPhone = ${s})
            AND status = ${d}
          ORDER BY createdAt DESC LIMIT ${u}
        `:await r.prisma.$queryRaw`
          SELECT * FROM "Order"
          WHERE merchantId = ${p}
            AND (customerId = ${E} OR deliveryPhone = ${s})
          ORDER BY createdAt DESC LIMIT ${u}
        `:d?await r.prisma.$queryRaw`
          SELECT * FROM "Order"
          WHERE merchantId = ${p}
            AND deliveryPhone = ${s}
            AND status = ${d}
          ORDER BY createdAt DESC LIMIT ${u}
        `:await r.prisma.$queryRaw`
          SELECT * FROM "Order"
          WHERE merchantId = ${p}
            AND deliveryPhone = ${s}
          ORDER BY createdAt DESC LIMIT ${u}
        `).map(e=>e.id),R=h.length>0?await r.prisma.$queryRaw`
        SELECT * FROM OrderItem WHERE orderId IN (${t.Prisma.join(h)})
      `:[],w=new Map;for(let e of R)w.has(e.orderId)||w.set(e.orderId,[]),w.get(e.orderId).push(e);return{orders:o.map(e=>({...e,items:w.get(e.id)||[]}))}}async function u(e){if(!e)throw new n.ValidationError("缺少取货码");if(!/^\d{6}$/.test(e))throw new n.ValidationError("取货码格式错误（需 6 位数字）");let t=await r.prisma.$queryRaw`
    SELECT o.id, o.orderNo, o.totalAmount, o.finalAmount, o.status,
           o.pickupCode, o.pickupExpiresAt, o.pickedUpAt, o.remark,
           c.phone as customerPhone, c.nickname as customerName
    FROM "Order" o
    LEFT JOIN Customer c ON o.customerId = c.id
    WHERE o.pickupCode = ${e}
    LIMIT 1
  `;if(0===t.length)throw new n.NotFoundError("取货码不存在");let o=t[0],a=new Date,i=o.pickupExpiresAt?new Date(o.pickupExpiresAt):null;return{orderNo:o.orderNo,finalAmount:o.finalAmount,status:o.status,customerName:o.customerName||"顾客",customerPhone:o.customerPhone,pickedUpAt:o.pickedUpAt,isRedeemed:!!o.pickedUpAt,isExpired:!!i&&i<a,expiresAt:o.pickupExpiresAt,remark:o.remark||null}}async function c(t){let{code:a,staffId:i,staffName:s,payMethod:d="cash",printReceipt:u=!1}=t;if(!a)throw new n.ValidationError("缺少取货码");let c=await (0,o.redeemPickupCode)(a,i||"unknown");if(!c.success)throw new n.ValidationError(c.error||"核销失败");let l=[];if(c.order){await r.prisma.$executeRaw`
      UPDATE "Order"
      SET remark = COALESCE(remark, '') || ${`
[核销] staff=${s||i||"unknown"}, payMethod=${d}, at=${new Date().toISOString()}`}
      WHERE id = ${c.order.id}
    `;try{l=await r.prisma.$queryRaw`
        SELECT productName, quantity, price FROM OrderItem WHERE orderId = ${c.order.id}
      `}catch(e){}u&&function(t,r,o){try{let{spawn:a}=e.r(233405);e.r(814747);let n=t.items||[],i=["/Users/yilinzhao/.openclaw/workspace/tools/printer_hp4512.py","--template","receipt","--title","造型师助手（铜仁市碧江区店） · 销售小票"];for(let e of n)i.push("--item",`${e.quantity||1}|${e.productName||"商品"}|${Number(e.price||0).toFixed(2)}`);i.push("--total",String(t.finalAmount||t.totalAmount||0),"--section",`订单号: ${t.orderNo||t.id}`,"--section",`取货码: ${t.pickupCode||"-"}`,"--section",`核销员: ${o}`,"--section",`支付方式: ${r}`,"--section",`下单时间: ${new Date(t.createdAt?t.createdAt.includes("Z")||t.createdAt.includes("+")?t.createdAt:t.createdAt+"Z":Date.now()).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai",hour12:!1})}`,"--footer","地址: 铜仁市碧江区干群路与清水大道交汇处东北50米 · 谢谢惠顾","--copies","1");let s=a("/Users/yilinzhao/.openclaw/venv/bin/python3",i,{detached:!0,stdio:["ignore","pipe","pipe"]});s.stdout?.on("data",e=>console.log("[receipt:out]",String(e).trim())),s.stderr?.on("data",e=>console.warn("[receipt:err]",String(e).trim())),s.on("exit",e=>console.log(`[receipt:done] exit code=${e}`)),s.unref(),console.log("[receipt] spawn pid:",s.pid)}catch(e){console.warn("[receipt] spawn failed:",e.message)}}({...c.order,items:l},d,s||i||"unknown");try{let e=Number(c.order.posRecordedAmount>0?c.order.posRecordedAmount:c.order.finalAmount??c.order.totalAmount??0).toFixed(2);await r.prisma.$executeRaw`
        INSERT INTO AuditLog (id, merchantId, actorType, actorId, action, target, description, createdAt)
        VALUES (${`al_${Date.now()}_${Math.random().toString(36).slice(2,8)}`}, ${c.order.merchantId||null}, 'staff', ${i||null}, 'order_completed', ${c.order.id}, ${`核销订单 ${c.order.orderNo||c.order.id}（取货码：${c.order.pickupCode||""}, 实付\xa5${e}, 支付：${d}）`}, CURRENT_TIMESTAMP)
      `}catch(e){console.warn("[audit] pickup log failed:",e.message)}}return{success:!0,message:"核销成功",printReceipt:!0===u,order:{...c.order,staffName:s,payMethod:d,pickedUpAt:new Date().toISOString()}}}e.s(["createOrder",0,s,"getCustomerOrders",0,d,"getPickupInfo",0,u,"redeemOrder",0,c])},196345,e=>{"use strict";var t=e.i(609388),r=e.i(933463),o=e.i(185907),a=e.i(98073),n=e.i(858528),i=e.i(694224),s=e.i(825944),d=e.i(463886),u=e.i(284599),c=e.i(685239),l=e.i(250340),p=e.i(750697),m=e.i(487923),E=e.i(608274),h=e.i(590836),R=e.i(193695);e.i(878896);var w=e.i(398108),I=e.i(96043),$=e.i(167022),A=e.i(630085),g=e.i(861143);async function f(e){try{let{searchParams:t}=new URL(e.url),r=t.get("phone"),o=t.get("merchantCode")||void 0,a=t.get("status")||void 0,n=parseInt(t.get("limit")||"50"),i=await (0,I.getCustomerOrders)({phone:r||"",merchantCode:o,status:a,limit:n});return(0,$.successResponse)(i)}catch(e){return(0,$.errorResponse)(e)}}async function N(e){try{let t=await e.json(),r=await (0,I.createOrder)(t);if(t.enqueue){let e=String(t.merchantId||r?.merchantId||"").trim();if(!e)throw Error("enqueue 需要 merchantId");let o=function(e){let t=new A.default((0,g.resolveDbPath)());try{let r=e.merchantId.trim(),o=(e.customerPhone||"").trim();if(!r)throw Error("merchantId 必填");if(!o)throw Error("customerPhone 必填");let a=Date.now()%1e5,n=e=>!!t.prepare("SELECT 1 FROM BarberQueue WHERE orderNo = ? AND merchantId = ?").get(e,r),i="";for(let e=0;e<500;e++){let e="A"+String(a).padStart(3,"0");if(!n(e)){i=e;break}a++}i||(i="A"+Date.now().toString(36).toUpperCase().slice(-6));let s="q_"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),d=e.service||"剪发",u=e.stylistName||"待分配",c=e.scheduledAt||"",l=e.scheduledDate||"today",p=e.orderNo?`在线预约 \xb7 单号 ${e.orderNo}`:e.note||"在线预约";return t.prepare(`
      INSERT INTO BarberQueue (
        id, merchantId, orderNo, type, customerName, customerPhone,
        service, stylistName, stylistCode, status, scheduledAt, scheduledDate,
        arrivedAt, startedAt, completedAt, note
      )
      VALUES (?, ?, ?, 'booking', ?, ?, ?, ?, NULL, 'reserved', ?, ?, NULL, NULL, NULL, ?)
    `).run(s,r,i,e.customerName||"顾客",o,d,u,c,l,p),{queueId:s,queueOrderNo:i}}finally{t.close()}}({merchantId:e,orderNo:r?.orderNo,customerName:String(t.customerName||"顾客"),customerPhone:String(t.phone||""),service:t.enqueueService||t.service,scheduledAt:t.scheduledAt});return(0,$.successResponse)({...r,queueId:o.queueId,queueOrderNo:o.queueOrderNo},201)}return(0,$.successResponse)(r,201)}catch(e){return(0,$.errorResponse)(e)}}e.s(["GET",0,f,"POST",0,N,"runtime",0,"nodejs"],522506);var T=e.i(522506);let C=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/orders/route",pathname:"/api/orders",filename:"route",bundlePath:""},distDir:".next-staging",relativeProjectDir:"",resolvedPagePath:"[project]/Projects/barber-qingheos-2026-09-19/src/app/api/orders/route.ts",nextConfigOutput:"standalone",userland:T,...{}}),{workAsyncStorage:O,workUnitAsyncStorage:S,serverHooks:y}=C;async function x(e,t,o){o.requestMeta&&(0,a.setRequestMeta)(e,o.requestMeta),C.isDev&&(0,a.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let I="/api/orders/route";I=I.replace(/\/index$/,"")||"/";let $=await C.prepare(e,t,{srcPage:I,multiZoneDraftMode:!1});if(!$)return t.statusCode=400,t.end("Bad Request"),null==o.waitUntil||o.waitUntil.call(o,Promise.resolve()),null;let{buildId:A,deploymentId:g,params:f,nextConfig:N,parsedUrl:T,isDraftMode:O,prerenderManifest:S,routerServerContext:y,isOnDemandRevalidate:x,revalidateOnlyGenerated:v,resolvedPathname:M,clientReferenceManifest:D,serverActionsManifest:P}=$,L=(0,s.normalizeAppPath)(I),q=!!(S.dynamicRoutes[L]||S.routes[M]),k=async()=>((null==y?void 0:y.render404)?await y.render404(e,t,T,!1):t.end("This page could not be found"),null);if(q&&!O){let e=!!S.routes[M],t=S.dynamicRoutes[L];if(t&&!1===t.fallback&&!e){if(N.adapterPath)return await k();throw new R.NoFallbackError}}let _=null;!q||C.isDev||O||(_="/index"===(_=M)?"/":_);let b=!0===C.isDev||!q,U=q&&!b;P&&D&&(0,i.setManifestsSingleton)({page:I,clientReferenceManifest:D,serverActionsManifest:P});let H=e.method||"GET",F=(0,n.getTracer)(),j=F.getActiveScopeSpan(),W=!!(null==y?void 0:y.isWrappedByNextServer),B=!!(0,a.getRequestMeta)(e,"minimalMode"),V=(0,a.getRequestMeta)(e,"incrementalCache")||await C.getIncrementalCache(e,N,S,B);null==V||V.resetRequestCache(),globalThis.__incrementalCache=V;let K={params:f,previewProps:S.preview,renderOpts:{experimental:{authInterrupts:!!N.experimental.authInterrupts},cacheComponents:!!N.cacheComponents,supportsDynamicResponse:b,incrementalCache:V,cacheLifeProfiles:N.cacheLife,waitUntil:o.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,o,a)=>C.onRequestError(e,t,o,a,y)},sharedContext:{buildId:A,deploymentId:g}},Y=new d.NodeNextRequest(e),G=new d.NodeNextResponse(t),X=u.NextRequestAdapter.fromNodeNextRequest(Y,(0,u.signalFromNodeResponse)(t));try{let a,i=async e=>C.handle(X,K).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=F.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==c.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let o=r.get("next.route");if(o){let t=`${H} ${o}`;e.setAttributes({"next.route":o,"http.route":o,"next.span_name":t}),e.updateName(t),a&&a!==e&&(a.setAttribute("http.route",o),a.updateName(t))}else e.updateName(`${H} ${I}`)}),s=async a=>{var n,s;let d=async({previousCacheEntry:r})=>{try{if(!B&&x&&v&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let n=await i(a);e.fetchMetrics=K.renderOpts.fetchMetrics;let s=K.renderOpts.pendingWaitUntil;s&&o.waitUntil&&(o.waitUntil(s),s=void 0);let d=K.renderOpts.collectedTags;if(!q)return await (0,p.sendResponse)(Y,G,n,K.renderOpts.pendingWaitUntil),null;{let e=await n.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(n.headers);d&&(t[h.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==K.renderOpts.collectedRevalidate&&!(K.renderOpts.collectedRevalidate>=h.INFINITE_CACHE)&&K.renderOpts.collectedRevalidate,o=void 0===K.renderOpts.collectedExpire||K.renderOpts.collectedExpire>=h.INFINITE_CACHE?void 0:K.renderOpts.collectedExpire;return{value:{kind:w.CachedRouteKind.APP_ROUTE,status:n.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:o}}}}catch(t){throw(null==r?void 0:r.isStale)&&await C.onRequestError(e,t,{routerKind:"App Router",routePath:I,routeType:"route",revalidateReason:(0,l.getRevalidateReason)({isStaticGeneration:U,isOnDemandRevalidate:x})},!1,y),t}},u=await C.handleResponse({req:e,nextConfig:N,cacheKey:_,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:S,isRoutePPREnabled:!1,isOnDemandRevalidate:x,revalidateOnlyGenerated:v,responseGenerator:d,waitUntil:o.waitUntil,isMinimalMode:B});if(!q)return null;if((null==u||null==(n=u.value)?void 0:n.kind)!==w.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==u||null==(s=u.value)?void 0:s.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});B||t.setHeader("x-nextjs-cache",x?"REVALIDATED":u.isMiss?"MISS":u.isStale?"STALE":"HIT"),O&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let c=(0,m.fromNodeOutgoingHttpHeaders)(u.value.headers);return B&&q||c.delete(h.NEXT_CACHE_TAGS_HEADER),!u.cacheControl||t.getHeader("Cache-Control")||c.get("Cache-Control")||c.set("Cache-Control",(0,E.getCacheControlHeader)(u.cacheControl)),await (0,p.sendResponse)(Y,G,new Response(u.value.body,{headers:c,status:u.value.status||200})),null};W&&j?await s(j):(a=F.getActiveScopeSpan(),await F.withPropagatedContext(e.headers,()=>F.trace(c.BaseServerSpan.handleRequest,{spanName:`${H} ${I}`,kind:n.SpanKind.SERVER,attributes:{"http.method":H,"http.target":e.url}},s),void 0,!W))}catch(t){if(t instanceof R.NoFallbackError||await C.onRequestError(e,t,{routerKind:"App Router",routePath:L,routeType:"route",revalidateReason:(0,l.getRevalidateReason)({isStaticGeneration:U,isOnDemandRevalidate:x})},!1,y),q)throw t;return await (0,p.sendResponse)(Y,G,new Response(null,{status:500})),null}}e.s(["handler",0,x,"patchFetch",0,function(){return(0,o.patchFetch)({workAsyncStorage:O,workUnitAsyncStorage:S})},"routeModule",0,C,"serverHooks",0,y,"workAsyncStorage",0,O,"workUnitAsyncStorage",0,S],196345)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0kk5qzj._.js.map