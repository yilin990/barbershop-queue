const Database = require("better-sqlite3");
const crypto = require("crypto");
const fs = require("fs");
const DB = "/Users/yilinzhao/Projects/barber-qingheos-2026-09-19/prisma/dev.db";
const PIN = "739105";

const db = new Database(DB);
const salt = crypto.randomBytes(16);
const h = crypto.scryptSync(PIN, salt, 32);
const pinHash = "scrypt$" + salt.toString("hex") + "$" + h.toString("hex");

db.prepare("DELETE FROM \"StaffCredential\" WHERE id = ?").run("cred_authtest_001");
const ins = db.prepare(
  "INSERT INTO \"StaffCredential\" (id, merchantId, role, label, pinHash, pinLength, active, failedCount, createdAt, updatedAt)"
  + " VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)"
);
const now = new Date().toISOString();
ins.run("cred_authtest_001", "m_authtest_A", "staff", "authtest", pinHash, 6, now, now);

const row = db.prepare("SELECT merchantId, role, active FROM \"StaffCredential\" WHERE id = ?").get("cred_authtest_001");
console.log("  测试凭证:", JSON.stringify(row));
const n = db.prepare("SELECT COUNT(*) c FROM \"StaffCredential\" WHERE merchantId = ?").get("m_authtest_A");
console.log("  m_authtest_A 名下凭证数:", n.c);
const w = db.prepare("SELECT COUNT(*) c FROM \"StaffCredential\" WHERE merchantId = ?").get("*");
console.log("  通配 * 凭证数:", w.c, "(strict 模式不使用它们)");
db.close();
fs.writeFileSync("/tmp/qh_testpin", PIN, { mode: 0o600 });
console.log("  PIN 已写 /tmp/qh_testpin (600)，不打印原文");
