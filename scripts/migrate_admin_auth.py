#!/usr/bin/env python3
"""Day 4 - 直接行扫描版本"""
import re
from pathlib import Path

FILES = [
    "src/app/api/products/[id]/status/route.ts",
    "src/app/api/products/[id]/restock/route.ts",
    "src/app/api/admin/restock-suggestions/route.ts",
    "src/app/api/admin/products/batch-category/route.ts",
    "src/app/api/admin/products/[id]/route.ts",
    "src/app/api/admin/products/import/route.ts",
    "src/app/api/admin/purchase-orders/route.ts",
    "src/app/api/admin/purchase-orders/[id]/route.ts",
    "src/app/api/admin/suppliers/route.ts",
    "src/app/api/admin/suppliers/[id]/route.ts",
    "src/app/api/admin/audit-list/route.ts",
    "src/app/api/admin/today/route.ts",
    "src/app/api/admin/users-list/route.ts",
    "src/app/api/admin/merchant-list/route.ts",
    "src/app/api/admin/ai-chat/route.ts",
    "src/app/api/admin/products-list/route.ts",
    "src/app/api/admin/feedbacks/[id]/reply/route.ts",
    "src/app/api/admin/groupbuys/route.ts",
    "src/app/api/admin/groupbuys/[id]/route.ts",
    "src/app/api/admin/activities/route.ts",
    "src/app/api/admin/activities/[id]/route.ts",
    "src/app/api/admin/activities/upload/route.ts",
    "src/app/api/admin/activities/compliance-check/route.ts",
    "src/app/api/admin/members/[id]/profile/route.ts",
    "src/app/api/admin/members/[id]/route.ts",
    "src/app/api/admin/orders/route.ts",
    "src/app/api/admin/orders/export/route.ts",
    "src/app/api/admin/orders/[id]/route.ts",
    "src/app/api/admin/feedbacks-list/route.ts",
    "src/app/api/admin/categories/route.ts",
    "src/app/api/feedbacks/[id]/route.ts",
    "src/app/api/content-reports/[id]/route.ts",
]

ROOT = Path("/Users/yilinzhao/.openclaw/workspace/projects/zhi_lin_pharmacy/official")
NEW_IMPORT = "import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'"


def migrate(path: Path) -> str:
    text = path.read_text(encoding='utf-8')
    lines = text.split('\n')
    out = []
    i = 0
    deleted_lines = 0
    replaced_calls = 0

    while i < len(lines):
        L = lines[i]
        Ls = L.strip()

        # 1. 删除顶层 const ADMIN_PINS 行（变种 1/2/3/4）
        # 条件：单独一行的 const ADMIN_PINS 开头，且不在 function 内
        if (Ls.startswith('const ADMIN_PINS') or Ls.startswith('// 鉴权')):
            i += 1
            deleted_lines += 1
            # 紧跟空行也吃掉一个
            if i < len(lines) and lines[i].strip() == '':
                i += 1
                deleted_lines += 1
            continue

        # 2. 删除整个 function checkAdminAuth { ... }
        if Ls.startswith('function checkAdminAuth') or Ls.startswith('async function checkAdminAuth'):
            depth = 0
            started = False
            while i < len(lines):
                for ch in lines[i]:
                    if ch == '{':
                        depth += 1
                        started = True
                    elif ch == '}':
                        depth -= 1
                if started and depth == 0:
                    i += 1
                    deleted_lines += 1
                    # 紧跟空行
                    if i < len(lines) and lines[i].strip() == '':
                        i += 1
                        deleted_lines += 1
                    break
                i += 1
                deleted_lines += 1
            continue

        # 3. 三行调用点: if (!checkAdminAuth(...)) {
        m_a = re.match(r'^(\s*)if\s*\(\s*!\s*checkAdminAuth\((?:req|request)\)\s*\)\s*\{', L)
        if m_a:
            indent = m_a.group(1)
            out.append(f"{indent}const auth = verifyAdminRequest(request)")
            out.append(f"{indent}if (!auth.ok) return unauthorized(auth)")
            i += 1
            replaced_calls += 1
            # 跳过 return NextResponse.json ... ; 那行
            while i < len(lines) and 'NextResponse.json' in lines[i]:
                i += 1
            # 跳过闭合 }
            if i < len(lines) and lines[i].strip() == '}':
                i += 1
            continue

        # 4. 三行 await 调用点: if (!(await checkAdminAuth(...))) {
        m_b = re.match(r'^(\s*)if\s*\(\s*!\s*\(\s*await\s+checkAdminAuth\((?:req|request)\)\s*\)\s*\)\s*\{', L)
        if m_b:
            indent = m_b.group(1)
            out.append(f"{indent}const auth = verifyAdminRequest(request)")
            out.append(f"{indent}if (!auth.ok) return unauthorized(auth)")
            i += 1
            replaced_calls += 1
            while i < len(lines) and 'NextResponse.json' in lines[i]:
                i += 1
            if i < len(lines) and lines[i].strip() == '}':
                i += 1
            continue

        # 5. 单行调用点: if (!checkAdminAuth(req)) return NextResponse.json({...}, {status: 401});
        m_c = re.match(r'^(\s*)if\s*\(\s*!\s*checkAdminAuth\((?:req|request)\)\s*\)\s*return\s+NextResponse\.json\([^)]*\)\s*;\s*$', L)
        if m_c:
            indent = m_c.group(1)
            out.append(f"{indent}const auth = verifyAdminRequest(request)")
            out.append(f"{indent}if (!auth.ok) return unauthorized(auth)")
            i += 1
            replaced_calls += 1
            continue

        out.append(L)
        i += 1

    new_text = '\n'.join(out)

    # 6. 加 import
    if 'verifyAdminRequest' in new_text and NEW_IMPORT not in new_text:
        all_lines = new_text.split('\n')
        last_import_idx = -1
        for j, l in enumerate(all_lines):
            if l.startswith('import '):
                last_import_idx = j
        if last_import_idx >= 0:
            all_lines.insert(last_import_idx + 1, NEW_IMPORT)
            new_text = '\n'.join(all_lines)

    if new_text != text:
        path.write_text(new_text, encoding='utf-8')

    return f"del={deleted_lines} call={replaced_calls}"


ok = 0
for rel in FILES:
    p = ROOT / rel
    if not p.exists():
        print(f"⏭️  MISSING {rel}")
        continue
    try:
        info = migrate(p)
        print(f"✅ {rel}  [{info}]")
        ok += 1
    except Exception as e:
        print(f"❌ {rel}  ERR: {e}")

print(f"\n--- {ok} 处理 ---")
