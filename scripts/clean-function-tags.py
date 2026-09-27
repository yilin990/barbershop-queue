"""
批量重写 Product.functionTags 为真正本商品相关的标签
原数据是 LLM 乱生成（把同品类所有商品名都塞进 functionTags）
正确策略：每个商品的 functionTags = [本商品名] + [1-2 个品类标签]
"""
import sqlite3
import json
import re

DB = '/Users/yilinzhao/Desktop/zhi-lin-2026-08-14/prisma/dev.db'
EMOJIS = re.compile(r'^[\U0001F000-\U0001FFFF\u2600-\u27BF]+', flags=re.UNICODE)

conn = sqlite3.connect(DB)
cur = conn.cursor()

# 品类 → 默认 1-2 个简洁标签
CATEGORY_DEFAULT = {
    'F001': ['时令鲜果', '水果'],
    'F002': ['新鲜蔬菜'],
    'F003': ['粮油米面'],
    'F001_citrus': ['柑橘类', '水果'],
    'F001_berry': ['浆果类', '水果'],
    'F001_melon': ['瓜果类', '水果'],
    'F002_leafy': ['叶菜类', '蔬菜'],
    'F002_root': ['根茎类', '蔬菜'],
    'F002_mushroom': ['菌菇类', '蔬菜'],
    'F003_grain': ['米面粮油'],
    'F003_protein': ['肉蛋蛋白', '生鲜'],
}

cur.execute("""
    SELECT id, name, category, categoryLabel, functionTags 
    FROM Product 
    WHERE merchantId='m_grocery_001' AND status='active'
""")
rows = cur.fetchall()

updated = 0
for id_, name, category, categoryLabel, old_tags in rows:
    # 新 tags：本商品名 + 1-2 个品类标签
    new_tags = [name]  # 本商品名（含 emoji）
    
    # 加 1-2 个品类标签（按 category 优先）
    defaults = CATEGORY_DEFAULT.get(category, [])
    for dt in defaults[:2]:
        if dt not in new_tags:
            new_tags.append(dt)
    
    # 如果 QM 标签特殊（有机/进口）也加一个
    # （可选 - 不在本次修复范围）
    
    new_tags_json = json.dumps(new_tags, ensure_ascii=False)
    
    if old_tags != new_tags_json:
        cur.execute("UPDATE Product SET functionTags=? WHERE id=?", (new_tags_json, id_))
        updated += 1

conn.commit()
print(f"✅ 已重写 {updated} 件商品的 functionTags")

# 验证：抽样 5 件
cur.execute("""
    SELECT name, functionTags FROM Product 
    WHERE merchantId='m_grocery_001' AND status='active' 
    LIMIT 5
""")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")

conn.close()
