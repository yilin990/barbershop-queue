#!/usr/bin/env python3
"""
芝林官网自动化测试脚本
用Cursor AI辅助编写

功能：
1. 测试芝林官网主页是否正常
2. 测试芝小药对话API
3. 测试用户记忆系统
4. 生成测试报告
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:3000"
ZHIXIAOYAO_API = "http://localhost:18090/api/chat"

class ZhilinTester:
    def __init__(self):
        self.results = []
    
    def test_homepage(self):
        """测试首页"""
        try:
            r = requests.get(BASE_URL, timeout=10)
            if r.status_code == 200:
                return True, "✅ 首页正常"
            return False, f"❌ 首页异常: {r.status_code}"
        except Exception as e:
            return False, f"❌ 首页错误: {e}"
    
    def test_chat_api(self, message="你好"):
        """测试聊天API"""
        try:
            r = requests.post(
                f"{BASE_URL}/api/chat",
                json={"message": message},
                timeout=30
            )
            if r.status_code == 200:
                data = r.json()
                reply = data.get("reply", "")
                if reply:
                    return True, f"✅ 聊天正常: {reply[:50]}..."
            return False, f"❌ 聊天异常"
        except Exception as e:
            return False, f"❌ 聊天错误: {e}"
    
    def test_memory_service(self):
        """测试记忆服务"""
        try:
            # 测试健康检查
            r = requests.get(ZHIXIAOYAO_API.replace("/api/chat", ""), timeout=5)
            if r.status_code == 200:
                return True, "✅ 记忆服务正常"
            return False, "❌ 记忆服务异常"
        except Exception as e:
            return False, f"❌ 记忆服务错误: {e}"
    
    def test_user_memory(self, user_id="test_cursor", message="Cursor测试"):
        """测试用户记忆"""
        try:
            r = requests.post(
                ZHIXIAOYAO_API,
                json={"user_id": user_id, "message": message},
                timeout=30
            )
            if r.status_code == 200:
                data = r.json()
                profile = data.get("profile", {})
                return True, f"✅ 用户记忆: {profile}"
            return False, "❌ 用户记忆异常"
        except Exception as e:
            return False, f"❌ 用户记忆错误: {e}"
    
    def run_all_tests(self):
        """运行所有测试"""
        print("=" * 50)
        print("🧪 芝林官网自动化测试")
        print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 50)
        
        tests = [
            ("首页", self.test_homepage),
            ("聊天API", lambda: self.test_chat_api()),
            ("记忆服务", self.test_memory_service),
            ("用户记忆", lambda: self.test_user_memory()),
        ]
        
        passed = 0
        for name, test_func in tests:
            print(f"\n🔍 测试: {name}")
            ok, msg = test_func()
            print(f"  {msg}")
            if ok:
                passed += 1
                self.results.append({"test": name, "status": "pass", "message": msg})
            else:
                self.results.append({"test": name, "status": "fail", "message": msg})
        
        print("\n" + "=" * 50)
        print(f"📊 测试结果: {passed}/{len(tests)} 通过")
        print("=" * 50)
        
        return passed == len(tests)

if __name__ == "__main__":
    tester = ZhilinTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)