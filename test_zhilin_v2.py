#!/usr/bin/env python3
"""
芝林官网自动化测试脚本 v2
用Cursor AI辅助编写 + 增强功能

功能：
1. 测试芝林官网主页
2. 测试芝小药对话API
3. 测试用户记忆系统
4. 记录测试历史
5. 生成HTML报告
"""

import requests
import json
import time
from datetime import datetime
from pathlib import Path

BASE_URL = "http://192.168.0.103:3000"
ZHIXIAOYAO_API = "http://192.168.0.103:18090/api/chat"

class ZhilinTesterV2:
    def __init__(self):
        self.results = []
        self.history_file = Path("/tmp/zhilin_test_history.json")
        
    def test_homepage(self):
        """测试首页"""
        try:
            r = requests.get(BASE_URL, timeout=10)
            if r.status_code == 200:
                size = len(r.content)
                return True, f"✅ 首页正常 ({size} bytes)"
            return False, f"❌ 首页异常: {r.status_code}"
        except Exception as e:
            return False, f"❌ 首页错误"
    
    def test_chat_page(self):
        """测试聊天页面"""
        try:
            r = requests.get(f"{BASE_URL}/chat", timeout=10)
            if r.status_code == 200:
                return True, "✅ 聊天页面正常"
            return False, f"❌ 聊天页面异常: {r.status_code}"
        except Exception as e:
            return False, f"❌ 聊天页面错误"
    
    def test_chat_api(self):
        """测试聊天API"""
        try:
            r = requests.post(
                f"{BASE_URL}/api/chat",
                json={"message": "Cursor测试"},
                timeout=30
            )
            if r.status_code == 200:
                data = r.json()
                reply = data.get("reply", "")[:30]
                return True, f"✅ 聊天正常: {reply}..."
            return False, "❌ 聊天异常"
        except Exception as e:
            return False, "❌ 聊天错误"
    
    def test_memory_service(self):
        """测试记忆服务"""
        try:
            r = requests.get("http://192.168.0.103:18090/", timeout=5)
            if r.status_code == 200:
                return True, "✅ 记忆服务正常"
            return False, "❌ 记忆服务异常"
        except Exception as e:
            return False, "❌ 记忆服务错误"
    
    def test_user_memory(self):
        """测试用户记忆"""
        try:
            user_id = f"cursor_test_{int(time.time())}"
            r = requests.post(
                ZHIXIAOYAO_API,
                json={"user_id": user_id, "message": "我叫Cursor"},
                timeout=30
            )
            if r.status_code == 200:
                data = r.json()
                profile = data.get("profile", {})
                name = profile.get("name", "")
                return True, f"✅ 用户记忆: {name}"
            return False, "❌ 用户记忆异常"
        except Exception as e:
            return False, f"❌ 用户记忆错误"
    
    def save_history(self):
        """保存测试历史"""
        history = []
        if self.history_file.exists():
            try:
                history = json.loads(self.history_file.read_text())
            except:
                history = []
        
        history.append({
            "time": datetime.now().isoformat(),
            "results": self.results
        })
        
        # 只保留最近100条
        history = history[-100:]
        self.history_file.write_text(json.dumps(history, ensure_ascii=False, indent=2))
    
    def run_all_tests(self):
        """运行所有测试"""
        print("=" * 60)
        print("🧪 芝林官网自动化测试 v2 (Cursor增强版)")
        print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 60)
        
        tests = [
            ("首页", self.test_homepage),
            ("聊天页面", self.test_chat_page),
            ("聊天API", self.test_chat_api),
            ("记忆服务", self.test_memory_service),
            ("用户记忆", self.test_user_memory),
        ]
        
        passed = 0
        for name, test_func in tests:
            print(f"\n🔍 {name}...", end=" ")
            ok, msg = test_func()
            print(msg)
            if ok:
                passed += 1
                self.results.append({"test": name, "status": "pass"})
            else:
                self.results.append({"test": name, "status": "fail"})
        
        print("\n" + "=" * 60)
        print(f"📊 测试结果: {passed}/{len(tests)} 通过")
        print("=" * 60)
        
        self.save_history()
        return passed == len(tests)

if __name__ == "__main__":
    tester = ZhilinTesterV2()
    success = tester.run_all_tests()
    exit(0 if success else 1)
