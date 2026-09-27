#!/usr/bin/env python3
"""
seed_discussions.py — 把原 SAMPLE_POSTS 灌进 Comment 表
"""
import sqlite3
import json
from datetime import datetime, timedelta

DB_PATH = "prisma/dev.db"

# 用奕霖 userId 作为发帖人
USER_ID = "cmqsym9e60000jm73g5q0bbi2"

POSTS = [
    {
        "category": "cold",
        "title": "最近感冒了，鼻塞流涕怎么办？",
        "content": "这两天受凉感冒了，鼻塞流清涕，喉咙有点痒。请问需要吃药吗？",
        "tags": ["鼻塞", "流涕", "受凉"],
        "author_nick": "王女士",
        "author_avatar": "👩",
        "hours_ago": 2,
        "replies": 5, "likes": 12,
    },
    {
        "category": "cold",
        "title": "孩子发烧 38.5 度，要不要去医院？",
        "content": "5 岁孩子突然发烧 38.5 度，精神状态还可以。需要立即去医院吗？",
        "tags": ["儿童", "发烧", "退烧"],
        "author_nick": "李先生",
        "author_avatar": "👨",
        "hours_ago": 5,
        "replies": 8, "likes": 23,
    },
    {
        "category": "stomach",
        "title": "胃酸烧心吃什么药比较好？",
        "content": "最近经常吃完饭胃酸烧心，反酸水。已经两周了，吃什么药？",
        "tags": ["胃酸", "烧心", "反酸"],
        "author_nick": "张大姐",
        "author_avatar": "👩‍🦰",
        "hours_ago": 24,
        "replies": 3, "likes": 8,
    },
    {
        "category": "hypertension",
        "title": "降压药什么时候吃最好？",
        "content": "医生开了降压药，让我早上吃。但听说晚上吃更好，到底什么时候吃？",
        "tags": ["高血压", "降压药", "用药时间"],
        "author_nick": "陈伯伯",
        "author_avatar": "👴",
        "hours_ago": 26,
        "replies": 12, "likes": 34,
    },
    {
        "category": "headache",
        "title": "偏头痛反复发作，有什么办法？",
        "content": "右侧太阳穴经常跳痛，持续 4-6 小时。每月发作 2-3 次，伴有恶心。",
        "tags": ["偏头痛", "跳痛", "恶心"],
        "author_nick": "小赵",
        "author_avatar": "🧑",
        "hours_ago": 48,
        "replies": 6, "likes": 15,
    },
    {
        "category": "allergy",
        "title": "每年春天就过敏性鼻炎，吃什么药？",
        "content": "每年 3-4 月就鼻塞打喷嚏眼睛痒。有什么预防或缓解方法？",
        "tags": ["过敏性鼻炎", "春季", "花粉"],
        "author_nick": "刘女士",
        "author_avatar": "👩‍💼",
        "hours_ago": 72,
        "replies": 4, "likes": 11,
    },
    {
        "category": "diabetes",
        "title": "二型糖尿病，血糖控制不好怎么办？",
        "content": "空腹血糖 8.5，餐后 12。医生开了二甲双胍，但还是高。",
        "tags": ["糖尿病", "血糖", "二甲双胍"],
        "author_nick": "王大爷",
        "author_avatar": "👴",
        "hours_ago": 76,
        "replies": 9, "likes": 18,
    },
    {
        "category": "sleep",
        "title": "长期失眠怎么办？",
        "content": "每天凌晨 3-4 点醒，再也睡不着。已经一个月了。",
        "tags": ["失眠", "早醒", "睡眠"],
        "author_nick": "小陈",
        "author_avatar": "🧑",
        "hours_ago": 96,
        "replies": 7, "likes": 14,
    },
    {
        "category": "child",
        "title": "宝宝 8 个月，辅食怎么添加？",
        "content": "宝宝 8 个月，纯母乳。最近想加辅食，不知道从什么开始。",
        "tags": ["辅食", "8个月", "母乳"],
        "author_nick": "新手妈妈",
        "author_avatar": "👩",
        "hours_ago": 120,
        "replies": 11, "likes": 28,
    },
    {
        "category": "chronic",
        "title": "关节炎多年，吃什么药效果好？",
        "content": "膝关节炎 10 年了，下雨阴天就疼。有什么长期缓解的方法？",
        "tags": ["关节炎", "慢性疼痛", "老年"],
        "author_nick": "退休李叔",
        "author_avatar": "👴",
        "hours_ago": 144,
        "replies": 8, "likes": 19,
    },
]


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 清掉之前的讨论种子（只删 category 不为空的）
    cur.execute("DELETE FROM Comment WHERE category IS NOT NULL")
    deleted = cur.rowcount
    print(f"清理旧讨论种子：{deleted} 条")

    now = datetime.utcnow()
    inserted = 0
    for p in POSTS:
        created_at = (now - timedelta(hours=p["hours_ago"])).strftime("%Y-%m-%d %H:%M:%S")
        # 名字存到 content 头部前缀（保持向后兼容，category 帖子没单独的 authorName 字段）
        full_content = f"[{p['author_nick']}|{p['author_avatar']}|{p['replies']}] {p['content']}"
        tags_json = json.dumps(p["tags"], ensure_ascii=False)
        cur.execute(
            """INSERT INTO Comment (id, userId, rating, content, likes, createdAt, category, title, tags)
               VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?)""",
            (
                f"disc_{int(now.timestamp())}_{inserted}",
                USER_ID,
                full_content,
                p["likes"],
                created_at,
                p["category"],
                p["title"],
                tags_json,
            ),
        )
        inserted += 1

    conn.commit()

    # 验证
    cur.execute(
        "SELECT category, title, likes FROM Comment WHERE category IS NOT NULL ORDER BY createdAt DESC"
    )
    print(f"\n✅ 插入 {inserted} 条讨论帖子：")
    for row in cur.fetchall():
        print(f"  [{row[0]:12s}] {row[1][:30]:30s} ❤ {row[2]}")

    conn.close()


if __name__ == "__main__":
    main()
