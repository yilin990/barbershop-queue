import { NextResponse } from 'next/server';
import { appendFileSync } from 'fs';

const ACCESS_LOG = '/tmp/agent-hub-access.log';

export async function GET(req: Request) {
  const ua = req.headers.get('user-agent') || 'unknown';
  const line = `${new Date().toISOString()} | ${ua} | ${req.headers.get('x-pid') || 'no-pid'}\n`;
  try { appendFileSync(ACCESS_LOG, line); } catch (e) {}
  
  return NextResponse.json({
    status: 'ok',
    hub: 'agent-hub',
    note: 'stub - real agent comm uses sessions_send or gateway RPC',
    messages: [],  // 关键：返回空消息让 poll 脚本"无事可做"
    agents: ['main', 'shangqu', 'nianhe', 'tiaoyan', 'zhixiaoyao'],
    timestamp: new Date().toISOString(),
  });
}

export async function POST() {
  return NextResponse.json({ status: 'ok', accepted: true, message: 'hub is read-only stub now' });
}
