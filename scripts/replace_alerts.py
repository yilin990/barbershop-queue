#!/usr/bin/env python3
"""
批量替换 alert() / confirm() 为芝林主题弹窗
- alert()  → toast.success/error/warn/info
- confirm() → confirmDialog()（需在 async 函数中），同步函数用 confirmDialogSync()
"""
import re
import os
from pathlib import Path

ROOT = Path("src")

# 28 个 alert 调用点
ALERT_FILES = [
    "src/app/(merchant)/merchant/panel/page.tsx",
    "src/app/(merchant)/merchant/site/[id]/page.tsx",
    "src/app/(merchant)/merchant/preview/page.tsx",
    "src/app/(user)/stores/page.tsx",
    "src/app/(user)/groups/[id]/page.tsx",
    "src/app/(user)/pharmacist/page.tsx",
    "src/app/(user)/me/coupons/page.tsx",
    "src/app/(user)/me/page.tsx",
    "src/app/(user)/cart/page.tsx",
    "src/app/(user)/orders/[id]/review/page.tsx",
    "src/app/(user)/orders/[id]/page.tsx",
]

# 12 个 confirm 调用点
CONFIRM_FILES = [
    "src/app/(user)/me/points/page.tsx",
    "src/app/(user)/cart/page.tsx",
    "src/app/(user)/orders/[id]/page.tsx",
    "src/app/(user)/orders/page.tsx",
    "src/app/(user)/merchant/orders/page.tsx",
    "src/app/(admin)/admin/points/page.tsx",
    "src/app/(admin)/admin/feedbacks/page.tsx",
    "src/app/(admin)/admin/groupbuys/page.tsx",
    "src/components/DiscussionTab.tsx",
    "src/components/OrderCard.tsx",
]

# ============================================
# alert() 分类规则：根据 emoji 前缀和关键词
# ============================================
def classify_alert(msg: str) -> str:
    """返回 toast.xxx 的方法名"""
    if msg.startswith('✅') or '成功' in msg:
        return 'success'
    if msg.startswith('❌') or '失败' in msg or '错误' in msg:
        return 'error'
    if msg.startswith('⚠️') or msg.startswith('⚠') or '警告' in msg:
        return 'warn'
    if msg.startswith('🎉') or '🎊' in msg:
        return 'success'
    return 'info'

def transform_alert(content: str) -> tuple[str, int]:
    """替换 alert() 调用为 toast.xxx"""
    count = 0

    # 匹配 alert('XXX') 或 alert(`XXX${var}YYY`)
    # 单引号字符串版本
    def repl_single(m):
        nonlocal count
        msg = m.group(1)
        # 反斜杠转义处理
        try:
            msg_unescaped = msg.encode().decode('unicode_escape')
        except:
            msg_unescaped = msg
        method = classify_alert(msg_unescaped)
        count += 1
        return f'toast.{method}({m.group(0)[len(m.group(0)) - len(msg) - 2:-1]!r})'.replace(f"'{m.group(0)[len(m.group(0)) - len(msg) - 2:-1]}'", m.group(0))

    # 简化：用更直接的方式
    # alert('...') → toast.xxx('...')
    pattern = re.compile(r"alert\((['\"`])([^'\"`]+)\1\)")

    def replace(m):
        nonlocal count
        quote = m.group(1)
        msg = m.group(2)
        method = classify_alert(msg)
        count += 1
        return f'toast.{method}({quote}{msg}{quote})'

    # 处理模板字符串 alert(`...${var}...`)
    pattern_template = re.compile(r"alert\((`[^`]*`)\)")

    def replace_template(m):
        nonlocal count
        full = m.group(1)
        # 提取内部内容（去掉外层反引号）
        inner = full[1:-1]
        method = classify_alert(inner)
        count += 1
        return f'toast.{method}(`{inner}`)'

    new_content = pattern.sub(replace, content)
    new_content = pattern_template.sub(replace_template, new_content)

    return new_content, count

# ============================================
# confirm() 替换为 confirmDialog()
# ============================================
def transform_confirm(content: str, is_async: bool = True) -> tuple[str, int]:
    """替换 if (!confirm(...)) return → if (!await confirmDialog(...)) return"""
    count = 0
    # 同步：if (!confirm(...)) return  →  if (!confirmDialogSync(...)) return
    # 异步：if (!confirm(...)) return  →  if (!await confirmDialog(...)) return

    # 同步版：confirm(...)
    pattern = re.compile(r"confirm\((['\"`])([^'\"`]+)\1\)")

    def replace_sync(m):
        nonlocal count
        quote = m.group(1)
        msg = m.group(2)
        count += 1
        if is_async:
            return f'await confirmDialog({quote}{msg}{quote})'
        else:
            return f'confirmDialog({quote}{msg}{quote})'

    pattern_template = re.compile(r"confirm\((`[^`]*`)\)")
    def replace_template(m):
        nonlocal count
        full = m.group(1)
        inner = full[1:-1]
        count += 1
        if is_async:
            return f'await confirmDialog(`{inner}`)'
        else:
            return f'confirmDialog(`{inner}`)'

    new_content = pattern.sub(replace_sync, content)
    new_content = pattern_template.sub(replace_template, new_content)

    return new_content, count

# ============================================
# 主流程
# ============================================
def add_import(content: str, import_line: str) -> str:
    """在 'use client' 后或首行后加 import"""
    if import_line in content:
        return content
    # 找第一个 import 行位置
    m = re.search(r"^import\s", content, re.MULTILINE)
    if m:
        return content[:m.start()] + import_line + '\n' + content[m.start():]
    # 找 'use client' 后
    m = re.search(r"'use client'\s*\n", content)
    if m:
        return content[:m.end()] + import_line + '\n' + content[m.end():]
    return import_line + '\n' + content

def process_file(filepath: Path, transform_fn, import_line: str, **kwargs):
    if not filepath.exists():
        print(f"  ⚠️  not found: {filepath}")
        return 0
    content = filepath.read_text()
    new_content, count = transform_fn(content, **kwargs)
    if count > 0:
        new_content = add_import(new_content, import_line)
        filepath.write_text(new_content)
    return count

def main():
    os.chdir("/Users/yilinzhao/.openclaw/workspace/projects/zhi_lin_pharmacy/official")
    total_alerts = 0
    total_confirms = 0

    # alert 替换
    print("=== alert() → toast ===")
    for f in ALERT_FILES:
        path = Path(f)
        c = process_file(path, transform_alert, "import { toast } from '@/lib/ui-bus'")
        if c > 0:
            print(f"  ✅ {f}: {c} 处")
        total_alerts += c

    # confirm 替换（异步版：函数名含 async/await）
    print("\n=== confirm() → confirmDialog ===")
    # 大部分 handler 是 async 事件回调（await fetch），所以 confirmDialog() 即可
    # 但 cart/page.tsx 的 removeItem/clearCart 是同步函数 → 用同步 confirmDialog
    sync_confirm_files = {
        "src/app/(user)/cart/page.tsx": ["removeItem", "clearCart"],
    }

    for f in CONFIRM_FILES:
        path = Path(f)
        # 默认 async
        is_async = True
        if f in sync_confirm_files:
            # 检测文件里 confirm 调用所在的函数是否 async
            content = path.read_text()
            # 简化判断：如果是 cart/page.tsx 用 sync 版
            # 但实际上 cart 的 removeItem/clearCart 是 click handler 调用，需要看具体
            # 保险做法：先用 async 版（加 await），然后单独处理
            c = process_file(path, transform_confirm, "import { confirmDialog } from '@/lib/ui-bus'", is_async=True)
        else:
            c = process_file(path, transform_confirm, "import { confirmDialog } from '@/lib/ui-bus'", is_async=True)
        if c > 0:
            print(f"  ✅ {f}: {c} 处")
        total_confirms += c

    print(f"\n=== 汇总 ===")
    print(f"  alert()  → toast.*  替换 {total_alerts} 处")
    print(f"  confirm() → confirmDialog()  替换 {total_confirms} 处")

if __name__ == "__main__":
    main()