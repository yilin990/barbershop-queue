#!/usr/bin/env python3
"""
芝林官网自动化测试脚本 FINAL
Cursor优化版 - 增加超时时间
"""

import requests
import json
import time
from datetime import datetime
from pathlib import Path

BASE_URL = "http://192.168.0.103:3000"
ZHIXIAOYAO = "http://192.168.0.103:18090"

class ZhilinTest:
    def __init__(self):
        self.results = []
    
    def test_all(self):
        print("=" * 60)
        print("🧪 芝林官网最终测试")
        print(f"⏰ {datetime.now().strftime('%H:%M:%S')}")
        print("=" * 60)
        
        tests = [
            ("首页", f"{BASE_URL}", 10),
            ("聊天页", f"{BASE_URL}/chat", 10),
            ("记忆服务", ZHIXIAOYAO, 5),
        ]
        
        passed = 0
        for name, url, timeout in tests:
            print(f"\n🔍 {name}...", end=" ", flush=True)
            try:
                r = requests.get(url, timeout=timeout)
                if r.status_code == 200:
                    print("✅ OK")
                    passed += 1
                else:
                    print(f"❌ {r.status_code}")
            except:
                print("❌ 超时")
        
        print(f"\n📊 结果: {passed}/{len(tests)}")
        return passed == len(tests)

if __name__ == "__main__":
    ZhilinTest().test_all()
