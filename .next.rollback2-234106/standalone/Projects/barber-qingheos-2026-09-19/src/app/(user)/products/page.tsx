import { redirect } from 'next/navigation'

/**
 * /products 重定向页 · 段 233
 *
 * 之前 /products 是果蔬商品列表（677 行），现在造型业务为主，
 * 自动跳转到 /ai-find-drug/products（造型产品展示页）。
 *
 * 保留 /products 路由的好处：
 * 1. 旧链接/书签/SEO 不丢失
 * 2. footer / 导航栏 / 其他入口指向 /products 的不需要改
 * 3. 未来想恢复"全商品"页只需要把 redirect 改回 page.tsx 即可
 */
export default function ProductsRedirect() {
  redirect('/ai-find-drug/products')
}