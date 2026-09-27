import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ADMIN_MERCHANT_ID } from '@/lib/admin-merchant'
import { verifyAdminRequest, unauthorized } from '@/lib/admin-jwt-auth'

export const runtime = 'nodejs'


interface Issue { level: 'critical' | 'warning' | 'info'; text: string; suggestion: string }

/**
 * POST /api/admin/activities/compliance-check
 * body: { title, subtitle, description }
 * 返回 { passed, score, issues: Issue[] }
 *
 * 合规规则（药店 + 医药行业 + 中国广告法）：
 * 1. 不能承诺疗效 / 治愈 / 根治
 * 2. 不能用绝对化用语 (最好/最佳/第一/唯一/100%)
 * 3. 不能诱导过量用药
 * 4. 不能贬低其他产品
 * 5. 处方药不能直接促销
 * 6. 必须有免责（请遵医嘱）
 * 7. 价格信息必须真实可核验
 * 8. 不能宣称"无副作用"
 * 9. 涉及特殊人群需明确警示
 */
export async function POST(request: NextRequest) {
  try {
    const auth = verifyAdminRequest(request)
    if (!auth.ok) return unauthorized(auth)

    const body = await request.json()
    const title = String(body.title || '')
    const subtitle = String(body.subtitle || '')
    const description = String(body.description || '')
    const fullText = `${title} ${subtitle} ${description}`.trim()

    if (fullText.length === 0) {
      return NextResponse.json({ success: true, passed: false, score: 0, issues: [{ level: 'critical', text: '内容为空', suggestion: '请填写活动内容' }] })
    }

    const issues: Issue[] = []
    let score = 100

    // 规则 1: 疗效承诺
    const cureWords = ['治愈', '根治', '疗效最佳', '完全治好', '包治', '100% 有效', '保证治好', '永不复发', '彻底']
    for (const w of cureWords) {
      if (fullText.includes(w)) {
        issues.push({ level: 'critical', text: `检测到疗效承诺词：「${w}」`, suggestion: '药品/保健品广告法禁止承诺疗效，请改用"辅助"、"有助于"等中性词' })
        score -= 30
      }
    }

    // 规则 2: 绝对化用语
    const absoluteWords = ['最好', '最佳', '第一', '唯一', '顶级', '最优秀', '首家', '独创', '100%', '百分之百', '绝对', '最']
    for (const w of absoluteWords) {
      if (fullText.includes(w)) {
        issues.push({ level: 'critical', text: `绝对化用语：「${w}」`, suggestion: '广告法第九条禁止使用极限词，请删除或换为相对描述' })
        score -= 20
      }
    }

    // 规则 3: 诱导过量
    const overuseWords = ['多吃', '加倍服用', '大量服用', '尽量多吃', '越多越好', '使劲吃']
    for (const w of overuseWords) {
      if (fullText.includes(w)) {
        issues.push({ level: 'critical', text: `过量用药诱导：「${w}」`, suggestion: '请删除，医药品需明确按说明书/医嘱服用' })
        score -= 25
      }
    }

    // 规则 4: 贬低
    const disparageWords = ['比 XX 好', '秒杀同类', '碾压同行', '比 XX 便宜']
    for (const w of disparageWords) {
      if (fullText.includes(w)) {
        issues.push({ level: 'warning', text: `可能贬低同类：「${w}」`, suggestion: '请删除比较性描述，避免不正当竞争' })
        score -= 15
      }
    }

    // 规则 5: 无副作用
    const noSideEffect = ['无副作用', '没有副作用', '无任何副作用', '零副作用', '绝对安全']
    for (const w of noSideEffect) {
      if (fullText.includes(w)) {
        issues.push({ level: 'critical', text: `宣称无副作用：「${w}」`, suggestion: '任何药品/保健品都有潜在副作用，不可宣称零风险' })
        score -= 25
      }
    }

    // 规则 6: 缺免责（必须有"请遵医嘱"或"请按说明书"或"禁忌"或"注意事项"）
    const safeWords = ['遵医嘱', '说明书', '禁忌', '注意事项', '不良反应', '儿童需', '孕妇']
    const hasSafe = safeWords.some((w) => fullText.includes(w))
    if (!hasSafe) {
      issues.push({ level: 'warning', text: '缺少用药安全提示', suggestion: '建议添加"请遵医嘱/按说明书服用"、"禁忌人群"等提示' })
      score -= 10
    }

    // 规则 7: 价格相关
    if (/最低价|史上最低|全网最低|最便宜/i.test(fullText)) {
      issues.push({ level: 'critical', text: '价格绝对化用语', suggestion: '禁止使用"最低价"等比较性价格表述' })
      score -= 20
    }

    // 规则 8: 处方药相关
    if (/处方药/.test(fullText) && /促销|折扣|秒杀|降价|优惠/i.test(fullText)) {
      issues.push({ level: 'warning', text: '处方药不能做促销', suggestion: '处方药需凭处方销售，不能作为促销活动主推' })
      score -= 15
    }

    // 规则 9: 特殊人群警示
    if (/儿童|孕妇|老人|婴幼儿|哺乳期/.test(fullText) && !/咨询|遵医|注意|慎用|禁用/.test(fullText)) {
      issues.push({ level: 'info', text: '涉及特殊人群但无警示', suggestion: '建议加"特殊人群请咨询医师"' })
      score -= 5
    }

    // 规则 10: 标题过短
    if (title.length > 0 && title.length < 4) {
      issues.push({ level: 'info', text: '标题过短（< 4 字）', suggestion: '建议补充活动主题' })
      score -= 3
    }

    score = Math.max(0, score)
    const passed = !issues.some((i) => i.level === 'critical')

    return NextResponse.json({
      success: true,
      passed,
      score,
      issues,
      summary: {
        critical: issues.filter((i) => i.level === 'critical').length,
        warning: issues.filter((i) => i.level === 'warning').length,
        info: issues.filter((i) => i.level === 'info').length,
      },
    })
  } catch (error: any) {
    console.error('[admin/activities/compliance-check]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}