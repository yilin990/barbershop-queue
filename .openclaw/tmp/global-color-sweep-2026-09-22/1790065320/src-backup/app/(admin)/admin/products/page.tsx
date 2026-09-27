'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Button } from '@/components/ui/Button'
import { Card, SummaryCard } from '@/components/ui/Card'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { BarcodeScanner } from '@/components/admin/BarcodeScanner'
import { EmptyState, ErrorState, Loading } from '@/components/ui/States'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { colors, fontSize, fontWeight, radius, spacing } from '@/lib/design-tokens'
import {
  Package, Plus, AlertTriangle, Search, RefreshCw, Upload,
  Tag, Edit, ChevronLeft, ChevronRight, FileSpreadsheet, X, ScanBarcode, Camera, Zap, ZapOff,
} from 'lucide-react'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { CategoryChip } from './_components/CategoryChip'
import { BatchCategoryModal } from './_components/BatchCategoryModal'
import { ImportModal } from './_components/ImportModal'
import type { Product, Category } from './_components/types'
import { isMobileView } from './_components/types'



function ProductsPageInner() {
  const toast = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  // 奕霖 2026-08-02 02:14 反馈"返回商品管理时不丢搜索状态" → URL ?q= 持久化
  const [list, setList] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [aggregates, setAggregates] = useState({ totalValue: 0, totalStock: 0, lowCount: 0 })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // 奕霖 2026-08-02 02:14 反馈"返回商品管理时不丢搜索状态" → URL ?q= 持久化
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [lowOnly, setLowOnly] = useState(false)
  const [tierFilter, setTierFilter] = useState<'all' | 'critical_0' | 'critical_5' | 'warning' | 'normal'>('all')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showImport, setShowImport] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  // 奕霖 2026-08-01 22:52 扫描枪工作流（替代相机方案）
  const [scannerGunMode, setScannerGunMode] = useState(false)
  const [showBatchCat, setShowBatchCat] = useState(false)
  const [confirmToggle, setConfirmToggle] = useState<Product | null>(null)
  const [restockTarget, setRestockTarget] = useState<Product | null>(null)
  const [editTarget, setEditTarget] = useState<Product | null>(null)
  const [restockQty, setRestockQty] = useState('30')
  const [editForm, setEditForm] = useState<{
    name: string; shortName: string; spec: string; price: string; stock: string; status: string
    productCode: string; manufacturer: string; barcode: string
    category: string; categoryLabel: string; unit: string
    memberPrice: string; totalAmount: string; points: string; weightGram: string
    image: string; description: string
  }>({
    name: '', shortName: '', spec: '', price: '0', stock: '0', status: 'active',
    productCode: '', manufacturer: '', barcode: '',
    category: '', categoryLabel: '', unit: '',
    memberPrice: '', totalAmount: '', points: '0', weightGram: '0',
    image: '', description: '',
  })
  // ⭐ P0 #7.5 奕霖 2026-07-20 17:47 — 进货信息录入（独立 modal 不污染 edit 6 字段）
  const [supplierTarget, setSupplierTarget] = useState<Product | null>(null)
  const [supplierForm, setSupplierForm] = useState<{ costPrice: string; supplierName: string; supplierPhone: string; supplierContact: string; supplierNote: string }>({ costPrice: '0', supplierName: '', supplierPhone: '', supplierContact: '', supplierNote: '' })
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  // v3.0 — 新建商品状态
  const [showCreate, setShowCreate] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  // ⭐ 2026-09-06 — 商品图文件上传(替掉 URL 输入)
  const [imgUploading, setImgUploading] = useState(false)
  const handleImageUpload = async (file: File, target: 'create' | 'edit') => {
    if (!file.type.startsWith('image/')) { toast.toast('只支持图片文件', 'err'); return }
    if (file.size > 8 * 1024 * 1024) { toast.toast('图片不能超过 8MB', 'err'); return }
    setImgUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch('/api/admin/products/upload-image', { method: 'POST', body: fd, credentials: 'include' })
      const d = await r.json()
      if (!d.success) { toast.toast(d.error || '上传失败', 'err'); return }
      if (target === 'create') setCreateForm((f) => ({ ...f, image: d.url }))
      else setEditForm((f) => ({ ...f, image: d.url }))
      toast.toast('✅ 图片已上传', 'ok')
    } catch (e: any) { toast.toast(e.message, 'err') }
    finally { setImgUploading(false) }
  }
  const [createForm, setCreateForm] = useState({
    productCode: '', name: '', shortName: '', spec: '',
    manufacturer: '', barcode: '',
    category: '', categoryLabel: '', unit: '',
    price: '0', totalAmount: '', memberPrice: '', points: '0', weightGram: '0',
    stock: '0', status: 'active', image: '', description: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (lowOnly) params.set('low', '1')
      // ⭐ P0 #4.6 奕霖 2026-07-20 16:48 — 4 档 tier 筛选（与首页 KPI 卡联动）
      if (tierFilter !== 'all') params.set('tier', tierFilter)
      if (category) params.set('category', category)
      params.set('page', String(page))
      params.set('limit', '30')

      const r = await fetch(`/api/admin/products-list?${params}`, { credentials: 'include' })
      const d = await r.json()
      if (d.success) {
        setList(d.products)
        setTotal(d.total)
        setTotalPages(d.totalPages || 1)
        if (d.aggregates) setAggregates(d.aggregates)
      } else {
        setError(d.error || '加载失败')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [q, lowOnly, tierFilter, category, page])

  useEffect(() => {
    load()
    fetch('/api/admin/categories', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.success) setCategories(d.categories || []) })
      .catch(() => {})
  }, [load])

  // 奕霖 2026-08-02 02:14 + 02:20：搜索状态同步到 URL ?q=，浏览器历史栈自动保留（返回能恢复）
  // ⚠️ 关键：只单向同步 state → URL，绝不反向（之前双向同步导致用户输入被立即清空）
  useEffect(() => {
    const currentUrlQ = searchParams.get('q') || ''
    if (q && currentUrlQ !== q) {
      // 用户刚输入（state 有值且不等于 URL）→ 写 URL
      router.replace('/admin/products?q=' + encodeURIComponent(q), { scroll: false })
    } else if (!q && currentUrlQ) {
      // 用户清空了搜索（state 空但 URL 还在）→ 移除 URL 参数
      router.replace('/admin/products', { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  // ⭐ P0 #4.6 奕霖 2026-07-20 16:48 — 初始化时从 URL ?tier= 读取（首页 TierCard 点击跳转过来时）
  useEffect(() => {
    if (typeof window === 'undefined') return
    const t = new URLSearchParams(window.location.search).get('tier')
    if (t && ['critical_0', 'critical_5', 'warning', 'normal', 'all'].includes(t)) {
      setTierFilter(t as any)
    }
  }, [])

  useEffect(() => { setPage(1) }, [q, lowOnly, tierFilter, category])
  useEffect(() => { setSelected(new Set()) }, [category, q, tierFilter, page])
  useEffect(() => {
    if (editTarget) {
      setEditForm({
        name: editTarget.name || '',
        shortName: editTarget.shortName || '',
        spec: editTarget.spec || '',
        price: String(editTarget.price ?? 0),
        stock: String(editTarget.stock ?? 0),
        status: editTarget.status || 'active',
        productCode: editTarget.productCode || '',
        manufacturer: (editTarget as any).manufacturer || '',
        barcode: (editTarget as any).barcode || '',
        category: editTarget.category || '',
        categoryLabel: editTarget.categoryLabel || '',
        unit: editTarget.unit || '',
        memberPrice: String((editTarget as any).memberPrice ?? ''),
        totalAmount: String((editTarget as any).totalAmount ?? ''),
        points: String((editTarget as any).points ?? 0),
        weightGram: String((editTarget as any).weightGram ?? 0),
        image: (editTarget as any).image || '',
        description: (editTarget as any).description || '',
      })
    }
  }, [editTarget])

  // ⭐ P0 #7.5 — supplier target useEffect
  useEffect(() => {
    if (!supplierTarget) return
    fetch(`/api/admin/products/${supplierTarget.id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.product) {
          const p = d.product
          setSupplierForm({
            costPrice: String(p.costPrice ?? 0),
            supplierName: p.supplierName || '',
            supplierPhone: p.supplierPhone || '',
            supplierContact: p.supplierContact || '',
            supplierNote: p.supplierNote || '',
          })
        }
      })
      .catch(() => {})
  }, [supplierTarget])

  const handleSaveSupplier = async () => {
    if (!supplierTarget) return
    const costPrice = Number(supplierForm.costPrice)
    if (isNaN(costPrice) || costPrice < 0) {
      toast.toast('进货价必须是非负数', 'err')
      return
    }
    setBusy((b) => ({ ...b, [supplierTarget.id]: true }))
    try {
      const r = await fetch(`/api/admin/products/${supplierTarget.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          costPrice,
          supplierName: supplierForm.supplierName.trim() || null,
          supplierPhone: supplierForm.supplierPhone.trim() || null,
          supplierContact: supplierForm.supplierContact.trim() || null,
          supplierNote: supplierForm.supplierNote.trim() || null,
        }),
      })
      const result = await r.json()
      if (r.status === 401) toast.toast('登录已过期', 'err')
      else if (result.success) {
        toast.toast(`✓ 进货信息已保存（${result.updatedFields} 个字段）`, 'ok')
        setSupplierTarget(null)
        load()
      } else {
        toast.toast(result.error || '保存失败', 'err')
      }
    } catch (e: any) {
      toast.toast(e.message, 'err')
    } finally {
      setBusy((b) => ({ ...b, [supplierTarget.id]: false }))
    }
  }

  // v3.0 — 新建商品
  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.toast('商品名不能为空', 'err')
      return
    }
    if (isNaN(Number(createForm.price)) || Number(createForm.price) < 0) {
      toast.toast('价格必须是非负数', 'err')
      return
    }
    setCreateBusy(true)
    try {
      const r = await fetch('/api/admin/products', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCode: createForm.productCode.trim() || undefined,
          name: createForm.name.trim(),
          shortName: createForm.shortName.trim() || undefined,
          spec: createForm.spec.trim() || undefined,
          manufacturer: createForm.manufacturer.trim() || undefined,
          barcode: createForm.barcode.trim() || undefined,
          category: createForm.category.trim() || undefined,
          categoryLabel: createForm.categoryLabel.trim() || undefined,
          unit: createForm.unit.trim() || undefined,
          price: Number(createForm.price),
          totalAmount: createForm.totalAmount.trim() ? Number(createForm.totalAmount) : undefined,
          memberPrice: createForm.memberPrice.trim() ? Number(createForm.memberPrice) : undefined,
          points: Number(createForm.points) || 0,
          weightGram: Number(createForm.weightGram) || 0,
          stock: Number(createForm.stock) || 0,
          status: createForm.status,
          image: createForm.image.trim() || undefined,
          description: createForm.description.trim() || undefined,
        }),
      })
      const result = await r.json()
      if (r.status === 401) toast.toast('登录已过期', 'err')
      else if (result.success) {
        toast.toast(`✓ 已创建「${createForm.name}」(${result.productCode})`, 'ok')
        setShowCreate(false)
        setCreateForm({
          productCode: '', name: '', shortName: '', spec: '',
          manufacturer: '', barcode: '',
          category: '', categoryLabel: '', unit: '',
          price: '0', totalAmount: '', memberPrice: '', points: '0', weightGram: '0',
          stock: '0', status: 'active', image: '', description: '',
        })
        load()
      } else {
        toast.toast(result.error || '创建失败', 'err')
      }
    } catch (e: any) {
      toast.toast(e.message, 'err')
    } finally {
      setCreateBusy(false)
    }
  }

  // v3.0 — 导出 Excel
  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (lowOnly) params.set('tier', 'critical_5') // 低库存导出 critical_5 档
      else if (tierFilter !== 'all') params.set('tier', tierFilter)
      if (category) params.set('category', category)
      const r = await fetch(`/api/admin/products/export?${params}`, { credentials: 'include' })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        toast.toast(`导出失败: ${j.error || r.statusText}`, 'err')
        return
      }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `果蔬商品_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.toast(`✅ 已导出 ${list.length} 件商品`, 'ok')
    } catch (e: any) {
      toast.toast(e.message, 'err')
    } finally {
      setExporting(false)
    }
  }
  const handleSaveEdit = async () => {
    if (!editTarget) return
    const payload: any = {
      name: editForm.name.trim(),
      shortName: editForm.shortName.trim() || null,
      spec: editForm.spec.trim() || null,
      price: Number(editForm.price),
      stock: Number(editForm.stock),
      status: editForm.status,
    }
    // v3.0 — 扩展字段(可选)
    if (editForm.productCode.trim()) payload.productCode = editForm.productCode.trim()
    if (editForm.manufacturer.trim()) payload.manufacturer = editForm.manufacturer.trim()
    if (editForm.barcode.trim()) payload.barcode = editForm.barcode.trim()
    if (editForm.category.trim()) payload.category = editForm.category.trim()
    if (editForm.categoryLabel.trim()) payload.categoryLabel = editForm.categoryLabel.trim()
    if (editForm.unit.trim()) payload.unit = editForm.unit.trim()
    if (editForm.memberPrice.trim()) payload.memberPrice = Number(editForm.memberPrice)
    if (editForm.totalAmount.trim()) payload.totalAmount = Number(editForm.totalAmount)
    if (editForm.points.trim()) payload.points = Number(editForm.points)
    if (editForm.weightGram.trim()) payload.weightGram = Number(editForm.weightGram)
    if (editForm.image.trim()) payload.image = editForm.image.trim()
    if (editForm.description.trim()) payload.description = editForm.description.trim()
    if (!payload.name) {
      toast.toast('商品名不能为空', 'err')
      return
    }
    if (isNaN(payload.price) || payload.price < 0) {
      toast.toast('价格必须是非负数', 'err')
      return
    }
    if (isNaN(payload.stock) || payload.stock < 0 || !Number.isInteger(payload.stock)) {
      toast.toast('库存必须是非负整数', 'err')
      return
    }
    setBusy((b) => ({ ...b, [editTarget.id]: true }))
    try {
      const r = await fetch(`/api/admin/products/${editTarget.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await r.json()
      if (r.status === 401) toast.toast('登录已过期，请重新输入 PIN', 'err')
      else if (result.success) {
        toast.toast(`✓ 已更新「${payload.name}」（${result.updatedFields} 个字段）`, 'ok')
        setEditTarget(null)
        load()
      } else {
        toast.toast(result.error || '保存失败', 'err')
      }
    } catch (e: any) {
      toast.toast(e.message, 'err')
    } finally {
      setBusy((b) => ({ ...b, [editTarget.id]: false }))


    }
  }

  const handleRestock = async () => {
    if (!restockTarget) return
    const qty = Number(restockQty)
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.toast('请输入 > 0 的数量', 'err')
      return
    }
    setBusy((b) => ({ ...b, [restockTarget.id]: true }))
    try {
      const r = await fetch(`/api/products/${restockTarget.id}/restock`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty }),
      })
      const result = await r.json()
      if (r.status === 401) toast.toast('登录已过期，请重新输入 PIN', 'err')
      else if (result.success) {
        toast.toast(`✅「${restockTarget.shortName || restockTarget.name}」补货 +${qty} (新库存 ${result.newStock})`, 'ok')
        setRestockTarget(null)
        setRestockQty('30')
        load()
      } else {
        toast.toast(result.error || '失败', 'err')
      }
    } catch (e: any) {
      toast.toast(e.message, 'err')
    } finally {
      setBusy((b) => ({ ...b, [restockTarget.id]: false }))
    }
  }

  const handleToggleStatus = async (p: Product) => {
    setBusy((b) => ({ ...b, [p.id]: true }))
    try {
      const newStatus = p.status === 'active' ? 'inactive' : 'active'
      const r = await fetch(`/api/products/${p.id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const result = await r.json()
      if (r.status === 401) toast.toast('登录已过期', 'err')
      else if (result.success) {
        toast.toast(`✅ 已${newStatus === 'active' ? '上架' : '下架'}「${p.shortName || p.name}」`, 'ok')
        load()
      } else {
        toast.toast(result.error || '失败', 'err')
      }
    } catch (e: any) {
      toast.toast(e.message, 'err')
    } finally {
      setBusy((b) => ({ ...b, [p.id]: false }))
      setConfirmToggle(null)
    }
  }

  const lowCount = aggregates.lowCount
  const totalValue = aggregates.totalValue
  const totalStock = aggregates.totalStock

  // 奕霖 2026-08-01 22:52 扫描枪 -> 查商品 -> 跳拍照页
  const handleBarcodeScanned = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/products/by-barcode/${encodeURIComponent(code)}`)
      const data = await res.json()
      if (data.success && data.product) {
        toast.toast(`✅ 找到商品：${data.product.shortName || data.product.name}`, 'ok')
        router.push(`/admin/products/${data.product.id}/photo`)
      } else {
        toast.toast(`❌ 未找到条码 ${code} 对应的商品`, 'err')
      }
    } catch (e: any) {
      toast.toast(`查询失败：${e.message}`, 'err')
    }
  }, [toast, router])

  useBarcodeScanner({
    onScan: handleBarcodeScanned,
    enabled: scannerGunMode,
  })

  const ScannerGunBanner = scannerGunMode ? (
    <div
      onClick={() => setScannerGunMode(false)}
      title="点击关闭扫描枪模式"
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.95), rgba(52, 200, 123, 0.95))',
        color: '#0a0f0d',
        padding: '10px 18px',
        borderRadius: 999,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        boxShadow: '0 4px 20px rgba(184, 134, 11, 0.5), 0 0 0 3px rgba(184, 134, 11, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        animation: 'scannerGunPulse 1.5s ease-in-out infinite',
      }}
    >
      <Zap size={16} />
      扫描模式已开 · 扫商品条码直接跳拍照页
      <span style={{ marginLeft: 6, opacity: 0.7, fontSize: fontSize.xs }}>（点击关闭）</span>
    </div>
  ) : null

  const columns: Column<Product>[] = [
    {
      // ⭐ P0 奕霖 2026-08-01 "图片用上展示页" — 缩略图列，跳转拍照页
      key: 'image',
      title: '图',
      width: 64,
      render: (p) => {
        const hasRealImage = !!(p.image && p.image.startsWith('/uploads/'))
        const src = hasRealImage ? p.image! : `/api/product-image/${p.id}`
        return (
          <div
            onClick={() => router.push(`/admin/products/${p.id}/photo`)}
            title={hasRealImage ? '查看 / 修改商品图' : '点击拍照上传商品图'}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              overflow: 'hidden',
              background: colors.bgHover,
              border: hasRealImage
                ? `1px solid ${colors.primary}`
                : `1px dashed ${colors.borderMuted}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              transition: 'transform 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            <img
              src={src}
              alt={p.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {!hasRealImage && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.45)',
                fontSize: 10,
                color: '#fff',
                fontWeight: 700,
              }}>
                + 拍照
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'productCode',
      title: '编码',
      width: 100,
      render: (p) => <span style={{ fontFamily: 'monospace', fontSize: fontSize.xs, color: colors.textSubtle }}>{p.productCode}</span>,
    },
    {
      key: 'name',
      title: '商品',
      render: (p: any) => (
        <div>
          <div style={{ fontWeight: fontWeight.semibold, fontSize: fontSize.base, display: 'flex', alignItems: 'center', gap: 6 }}>
            {p.shortName || p.name}
            {/* ⭐ 奕霖 2026-08-05 02:30 — 方案 B：待重拍徽章 */}
            {(p.retakeCount ?? 0) > 0 && (
              <span
                title={`该商品有 ${p.retakeCount} 张图需要重拍，点击查看`}
                onClick={(e) => { e.stopPropagation(); router.push('/admin/orphan-photos') }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 2,
                  padding: '2px 6px', borderRadius: 10,
                  background: 'linear-gradient(135deg, #b8860b, #f59e0b)',
                  color: '#0a0f0d', fontSize: 10, fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(245,158,11,0.3)',
                  whiteSpace: 'nowrap',
                }}
              >
                ⚠️ {p.retakeCount}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      title: '分类',
      render: (p) => p.categoryLabel
        ? <span style={{ padding: '2px 8px', borderRadius: radius.md, background: colors.primaryBgSubtle, color: colors.primary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold }}>{p.categoryLabel}</span>
        : <span style={{ fontSize: fontSize.xs, color: colors.textGhost }}>未分类</span>,
    },
    {
      key: 'supplier',
      title: '供应商',
      hideOnMobile: true,
      render: (p: any) => p.supplierName
        ? <span style={{ fontSize: fontSize.xs, color: colors.textMuted, fontWeight: fontWeight.medium }} title={`${p.supplierContact || ''} ${p.supplierPhone || ''} ${p.supplierNote || ''}`.trim() || '无备注'}>📦 {String(p.supplierName).slice(0, 8)}</span>
        : <span style={{ fontSize: fontSize.xs, color: colors.textFaint, fontStyle: 'italic' }}>未录</span>,
    },
    {
      key: 'price',
      title: '售价',
      align: 'right',
      render: (p) => <span style={{ fontWeight: fontWeight.bold, color: colors.primary }}>¥{p.price}</span>,
    },
    {
      key: 'stock',
      title: '库存',
      align: 'right',
      hideOnMobile: true,
      render: (p) => {
        // ⭐ P0 #4.6 奕霖 2026-07-20 16:48 — 库存分 4 色（与首页 TierCard 同色）
        const tier = p.stock === 0 ? 'critical_0'
          : p.stock < 5 ? 'critical_5'
          : p.stock < 20 ? 'warning'
          : 'normal'
        const tierStyle: Record<string, { bg: string; fg: string; label: string }> = {
          critical_0: { bg: 'linear-gradient(135deg, rgba(220,38,38,0.18) 0%, rgba(185,28,28,0.12) 100%)', fg: '#fca5a5', label: '售罄' },
          critical_5: { bg: 'linear-gradient(135deg, rgba(249,115,22,0.16) 0%, rgba(234,88,12,0.10) 100%)', fg: '#fdba74', label: '急' },
          warning: { bg: 'linear-gradient(135deg, rgba(234,179,8,0.14) 0%, rgba(202,138,4,0.08) 100%)', fg: '#fde047', label: '低' },
          normal: { bg: colors.primaryBgSubtle, fg: colors.primary, label: '正常' },
        }
        const t = tierStyle[tier]
        return (
          <span style={{
            padding: '4px 10px', borderRadius: radius.md,
            background: t.bg,
            color: t.fg,
            fontWeight: fontWeight.bold, fontSize: fontSize.sm, fontFamily: 'monospace',
            border: tier === 'critical_0' ? '1px solid rgba(220,38,38,0.4)' : 'none',
          }} title={t.label}>
            {p.stock} {p.unit || '件'}
          </span>
        )
      },
    },
    {
      key: 'status',
      title: '状态',
      render: (p) => (
        <span style={{
          padding: '3px 8px', borderRadius: radius.sm, fontSize: fontSize.xs, fontWeight: fontWeight.semibold,
          background: p.status === 'active' ? colors.primaryBgLight : colors.bgHover,
          color: p.status === 'active' ? colors.primary : colors.textGhost,
        }}>
          {p.status === 'active' ? '已上架' : '已下架'}
        </span>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (p) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => router.push(`/admin/products/${p.id}/photo`)} title="拍照或上传商品图">
            <Camera size={12} />
            拍照
          </Button>
          <Button size="sm" variant="success" onClick={() => setRestockTarget(p)} loading={busy[p.id]}>
            <Plus size={12} />
            补货
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditTarget(p)}>
            <Edit size={12} />
            编辑
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSupplierTarget(p)} title="录入进货价/供应商">
            📦 进货
          </Button>
          <Button size="sm" variant={p.status === 'active' ? 'ghost' : 'secondary'} onClick={() => setConfirmToggle(p)}>
            {p.status === 'active' ? '下架' : '上架'}
          </Button>
        </div>
      ),
    },
  ]

  const mobileCardRender = (p: Product) => {
    // ⭐ P0 #4.6 奕霖 2026-07-20 16:48 — 移动卡片库存分 4 色（与表格同色）
    const tier = p.stock === 0 ? 'critical_0'
      : p.stock < 5 ? 'critical_5'
      : p.stock < 20 ? 'warning'
      : 'normal'
    const tierStyle: Record<string, { bg: string; fg: string }> = {
      critical_0: { bg: 'linear-gradient(135deg, rgba(220,38,38,0.18) 0%, rgba(185,28,28,0.12) 100%)', fg: '#fca5a5' },
      critical_5: { bg: 'linear-gradient(135deg, rgba(249,115,22,0.16) 0%, rgba(234,88,12,0.10) 100%)', fg: '#fdba74' },
      warning: { bg: 'linear-gradient(135deg, rgba(234,179,8,0.14) 0%, rgba(202,138,4,0.08) 100%)', fg: '#fde047' },
      normal: { bg: colors.primaryBgSubtle, fg: colors.primary },
    }
    const t = tierStyle[tier]
    return (
      <div>
        <div style={{ fontWeight: fontWeight.semibold, fontSize: fontSize.base, marginBottom: 6 }}>
          {p.shortName || p.name}
        </div>
        <div style={{ display: 'flex', gap: spacing[3], fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: spacing[4] }}>
          <span>编码 {p.productCode}</span>
          {p.categoryLabel && <span>· {p.categoryLabel}</span>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[5] }}>
          <span style={{ fontWeight: fontWeight.bold, color: colors.primary, fontSize: fontSize.lg }}>¥{p.price}</span>
          <span style={{
            padding: '4px 10px', borderRadius: radius.md,
            background: t.bg,
            color: t.fg,
            fontWeight: fontWeight.bold, fontSize: fontSize.sm, fontFamily: 'monospace',
            border: tier === 'critical_0' ? '1px solid rgba(220,38,38,0.4)' : 'none',
          }}>
            库存 {p.stock}
          </span>
        </div>
        <div style={{ display: 'flex', gap: spacing[2] }}>
          <Button size="sm" variant="success" block onClick={() => setRestockTarget(p)}>
            <Plus size={14} /> 补货
          </Button>
          <Button size="sm" variant="secondary" block onClick={() => setConfirmToggle(p)}>
            {p.status === 'active' ? '下架' : '上架'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout title="商品管理" active="products">
      {ScannerGunBanner}
      {/* 顶部筛选区 */}
      <Card style={{ marginBottom: spacing[5] }} padding={spacing[5]}>
        <div style={{ display: 'flex', gap: spacing[3], flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: colors.textSubtle }} />
            <input
              type="search"
              placeholder="搜索商品名/编码…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="搜索商品"
              style={{
                width: '100%', minHeight: 44, padding: '10px 80px 10px 36px', borderRadius: radius.lg,
                background: colors.bgInput, border: `1px solid ${colors.borderMuted}`,
                color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={() => setShowScanner(true)}
              aria-label="扫描条码"
              title="扫描商品条码"
              style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                minHeight: 32, padding: '0 12px',
                background: colors.primaryBgSubtle,
                border: `1px solid ${colors.primaryBorder}`,
                borderRadius: radius.base,
                color: colors.primary,
                fontSize: fontSize.xs, fontWeight: fontWeight.semibold,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                fontFamily: 'inherit',
              }}
            >
              <ScanBarcode size={14} />
              扫码
            </button>
          </div>
          <Button variant={lowOnly ? 'danger' : 'secondary'} onClick={() => setLowOnly(!lowOnly)}>
            <AlertTriangle size={14} />
            低库存
          </Button>
          <Button
            variant={scannerGunMode ? 'primary' : 'secondary'}
            onClick={() => setScannerGunMode(!scannerGunMode)}
            title={scannerGunMode ? '扫描枪模式已开 · 扫商品条码直接跳拍照页' : '点击开启扫描枪模式'}
            style={scannerGunMode ? { boxShadow: '0 0 12px rgba(184, 134, 11, 0.5)' } : undefined}
          >
            {scannerGunMode ? <Zap size={14} /> : <ZapOff size={14} />}
            扫描枪 {scannerGunMode ? 'ON' : 'OFF'}
          </Button>
          <Button variant="primary" onClick={() => router.push('/admin/photo-batch')}>
            <Camera size={14} />
            批量拍照
          </Button>
          <Button variant="secondary" onClick={handleExport} loading={exporting}>
            <FileSpreadsheet size={14} />
            导出 Excel
          </Button>
          <Button variant="secondary" onClick={() => setShowImport(true)}>
            <Upload size={14} />
            表格导入
          </Button>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            新建商品
          </Button>
          <Button variant="secondary" onClick={load}>
            <RefreshCw size={14} />
            刷新
          </Button>
        </div>

        {/* 分类 chips — 桌面端 wrap，移动端横向滚动 */}
        <div
          className="qinghe-cat-chips"
          style={{
            marginTop: spacing[5],
            display: 'flex',
            gap: spacing[2],
            alignItems: 'center',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            overflowY: 'hidden',
            paddingRight: spacing[5],
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
          }}
        >
          <CategoryChip label="全部" count={categories.reduce((s, c) => s + c.count, 0)} active={!category} onClick={() => setCategory('')} />
          {categories.slice(0, 18).map((c) => (
            <CategoryChip key={c.label} label={c.label} count={c.count} active={category === c.label} onClick={() => setCategory(category === c.label ? '' : c.label)} />
          ))}
          {categories.length > 18 && (
            <span style={{ fontSize: fontSize.xs, color: colors.textFaint, padding: '10px 8px', whiteSpace: 'nowrap' }}>+{categories.length - 18} 更多</span>
          )}
        </div>
      </Card>

      {/* 数据 */}
      {loading ? (
        <Loading text="加载商品中…" />
      ) : error ? (
        <ErrorState error={error} onRetry={load} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Package size={48} strokeWidth={1.5} />}
          title="无匹配商品"
          description="试试调整筛选条件或搜索关键词"
          action={{ label: '清除筛选', onClick: () => { setQ(''); setCategory(''); setLowOnly(false) } }}
        />
      ) : (
        <>
          {/* 统计 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: spacing[3], marginBottom: spacing[5] }} className="qinghe-kpi-grid">
            <SummaryCard label="商品数" value={total} suffix=" 件" icon={<Package size={14} />} />
            <SummaryCard label="低库存" value={lowCount} color={lowCount > 0 ? colors.danger : colors.primary} icon={<AlertTriangle size={14} />} />
            <SummaryCard label="总价值" value={totalValue} prefix="¥" color={colors.primary} />
            <SummaryCard label="总库存" value={totalStock} suffix=" 件" />
          </div>

          {/* 表格 / 卡片 */}
          <ResponsiveTable
            columns={columns}
            data={list}
            rowKey={(p) => p.id}
            selectable
            selectedIds={Array.from(selected)}
            onSelectChange={(ids) => setSelected(new Set(ids))}
            mobileCardRender={mobileCardRender}
            emptyState={<EmptyState title="无匹配商品" />}
          />

          {/* 分页 */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[5], padding: `${spacing[3]} ${spacing[5]}`, background: colors.bgElevated, borderRadius: radius.lg, border: `1px solid ${colors.border}` }}>
              <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft size={14} /> 上一页
              </Button>
              <div style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
                第 <span style={{ color: colors.primary, fontWeight: fontWeight.bold }}>{page}</span> / {totalPages} 页 · 共 {total.toLocaleString()} 件
              </div>
              <Button size="sm" variant="secondary" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                下一页 <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </>
      )}

      {/* 批量操作栏 */}
      {selected.size > 0 && (
        <div role="toolbar" style={{ position: 'fixed', bottom: isMobileView() ? 80 : 24, left: '50%', transform: 'translateX(-50%)', background: colors.bgSecondary, border: `1px solid ${colors.primaryBorder}`, backdropFilter: 'blur(20px)', padding: `${spacing[4]} ${spacing[7]}`, borderRadius: radius.xxl, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', gap: spacing[4], alignItems: 'center' }}>
          <span style={{ fontSize: fontSize.base, color: colors.primary, fontWeight: fontWeight.bold }}>已选 {selected.size} 件</span>
          <Button size="sm" variant="primary" onClick={() => setShowBatchCat(true)}>
            <Tag size={14} /> 改分类
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>取消</Button>
        </div>
      )}

      {/* 弹窗 */}
      {showBatchCat && (
        <BatchCategoryModal
          count={selected.size}
          categories={categories}
          ids={Array.from(selected)}
          onClose={() => setShowBatchCat(false)}
          onDone={(label) => {
            setShowBatchCat(false)
            setSelected(new Set())
            toast.toast(`✅ ${selected.size} 件 →「${label}」`, 'ok')
            load()
            fetch('/api/admin/categories', { credentials: 'include' })
              .then((r) => r.json())
              .then((d) => { if (d.success) setCategories(d.categories || []) })
          }}
        />
      )}

      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); load() }} />
      )}

      {restockTarget && (
        <Modal
          open={true}
          onClose={() => setRestockTarget(null)}
          title={`补货「${restockTarget.shortName || restockTarget.name}」`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRestockTarget(null)}>取消</Button>
              <Button variant="primary" onClick={handleRestock} loading={busy[restockTarget.id]}>确认补货</Button>
            </>
          }
        >
          <div style={{ marginBottom: spacing[5], fontSize: fontSize.sm, color: colors.textSubtle }}>
            当前库存：<span style={{ color: colors.primary, fontWeight: fontWeight.bold }}>{restockTarget.stock} {restockTarget.unit || '件'}</span>
          </div>
          <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>补货数量</label>
          <input
            type="number"
            value={restockQty}
            onChange={(e) => setRestockQty(e.target.value)}
            min="1"
            autoFocus
            aria-label="补货数量"
            style={{
              width: '100%', minHeight: 48, padding: '12px 14px', borderRadius: radius.lg,
              background: colors.bgInput, border: `1px solid ${colors.borderStrong}`,
              color: colors.text, fontSize: fontSize.lg, fontFamily: 'inherit', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </Modal>
      )}


      {/* v3.0 — 新建商品 Modal */}
      {showCreate && (
        <Modal
          open={true}
          onClose={() => !createBusy && setShowCreate(false)}
          title="➕ 新建商品"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={createBusy}>取消</Button>
              <Button variant="primary" onClick={handleCreate} loading={createBusy}>创建</Button>
            </>
          }
        >
          <div style={{ fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: spacing[4] }}>
            标 <span style={{ color: colors.danger }}>*</span> 为必填;其余可后补
          </div>

          {/* 编码 + 名称 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: spacing[4], marginBottom: spacing[4] }}>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>商品编码</label>
              <input type="text" value={createForm.productCode} placeholder="留空自动生成"
                onChange={(e) => setCreateForm({ ...createForm, productCode: e.target.value })}
                style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>商品全称 <span style={{ color: colors.danger }}>*</span></label>
              <input type="text" value={createForm.name} autoFocus
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[4], marginBottom: spacing[4] }}>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>简称</label>
              <input type="text" value={createForm.shortName} onChange={(e) => setCreateForm({ ...createForm, shortName: e.target.value })} style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>规格</label>
              <input type="text" value={createForm.spec} onChange={(e) => setCreateForm({ ...createForm, spec: e.target.value })} placeholder="例:500g/份" style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing[4], marginBottom: spacing[4] }}>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>分类</label>
              <input type="text" value={createForm.categoryLabel} placeholder="例:时令鲜果" onChange={(e) => setCreateForm({ ...createForm, categoryLabel: e.target.value, category: e.target.value })} style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>单位</label>
              <select value={createForm.unit} onChange={(e) => setCreateForm({ ...createForm, unit: e.target.value })} style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">—</option>
                <option value="份">份</option><option value="斤">斤</option><option value="kg">kg</option>
                <option value="个">个</option><option value="盒">盒</option><option value="袋">袋</option>
                <option value="瓶">瓶</option><option value="提">提</option><option value="箱">箱</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>厂家/产地</label>
              <input type="text" value={createForm.manufacturer} onChange={(e) => setCreateForm({ ...createForm, manufacturer: e.target.value })} placeholder="例:云南楚雄" style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing[4], marginBottom: spacing[4] }}>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>售价 ¥ <span style={{ color: colors.danger }}>*</span></label>
              <input type="number" step="0.01" min="0" value={createForm.price} onChange={(e) => setCreateForm({ ...createForm, price: e.target.value })} style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>会员价 ¥</label>
              <input type="number" step="0.01" min="0" value={createForm.memberPrice} placeholder="选填" onChange={(e) => setCreateForm({ ...createForm, memberPrice: e.target.value })} style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>原价 ¥</label>
              <input type="number" step="0.01" min="0" value={createForm.totalAmount} placeholder="选填" onChange={(e) => setCreateForm({ ...createForm, totalAmount: e.target.value })} style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing[4], marginBottom: spacing[4] }}>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>库存</label>
              <input type="number" min="0" value={createForm.stock} onChange={(e) => setCreateForm({ ...createForm, stock: e.target.value })} style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>积分</label>
              <input type="number" min="0" value={createForm.points} onChange={(e) => setCreateForm({ ...createForm, points: e.target.value })} style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>重量(克)</label>
              <input type="number" min="0" value={createForm.weightGram} onChange={(e) => setCreateForm({ ...createForm, weightGram: e.target.value })} style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: spacing[3], marginBottom: spacing[4] }}>
            {(['active', 'inactive', 'draft'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setCreateForm({ ...createForm, status: s })}
                style={{ flex: 1, padding: '10px 12px', borderRadius: radius.md, cursor: 'pointer', fontFamily: 'inherit', fontSize: fontSize.sm,
                  background: createForm.status === s ? colors.primaryBg : colors.bgInput,
                  border: `1px solid ${createForm.status === s ? colors.primaryBorder : colors.borderStrong}`,
                  color: createForm.status === s ? colors.primary : colors.textMuted, fontWeight: fontWeight.semibold }}>
                {s === 'active' ? '✓ 上架' : s === 'inactive' ? '○ 下架' : '📝 草稿'}
              </button>
            ))}
          </div>

          <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>商品图(从本机选文件上传)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: spacing[3] }}>
            <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px dashed ${colors.borderStrong}`, color: imgUploading ? colors.textSubtle : colors.primary, fontSize: fontSize.sm, cursor: imgUploading ? 'wait' : 'pointer', boxSizing: 'border-box' }}>
              {imgUploading ? '⏳ 上传中…' : '📁  选择图片文件'}
              <input type="file" accept="image/*" disabled={imgUploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'create'); e.target.value = '' }} style={{ display: 'none' }} />
            </label>
            {createForm.image && <img src={createForm.image} alt="预览" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: radius.md, border: `1px solid ${colors.borderMuted}` }} />}
          </div>
          <input type="text" value={createForm.image} placeholder="或粘贴 URL(/uploads/... 或 https://...)" onChange={(e) => setCreateForm({ ...createForm, image: e.target.value })} style={{ width: '100%', minHeight: 36, padding: '8px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderMuted}`, color: colors.textSubtle, fontSize: fontSize.xs, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: spacing[4] }} />

          <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>描述</label>
          <textarea value={createForm.description} rows={3} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="产地、口感、储存方式…" style={{ width: '100%', minHeight: 80, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
        </Modal>
      )}

      {editTarget && (
        <Modal
          open={true}
          onClose={() => setEditTarget(null)}
          title={`✏️ 编辑「${editTarget.shortName || editTarget.name}」`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditTarget(null)}>取消</Button>
              <Button variant="primary" onClick={handleSaveEdit} loading={busy[editTarget.id]}>保存</Button>
            </>
          }
        >
          <div style={{ marginBottom: spacing[4], fontSize: fontSize.xs, color: colors.textSubtle }}>
            编码：<span style={{ fontFamily: 'monospace' }}>{editTarget.productCode}</span>
            {editTarget.categoryLabel && <> · 分类：{editTarget.categoryLabel}</>}
          </div>

          <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>商品全称 <span style={{ color: colors.danger }}>*</span></label>
          <input
            type="text"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            autoFocus
            style={{
              width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md,
              background: colors.bgInput, border: `1px solid ${colors.borderStrong}`,
              color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none',
              boxSizing: 'border-box', marginBottom: spacing[4],
            }}
          />

          <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>商品简称</label>
          <input
            type="text"
            value={editForm.shortName}
            onChange={(e) => setEditForm({ ...editForm, shortName: e.target.value })}
            placeholder="如：氨咖黄敏胶囊"
            style={{
              width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md,
              background: colors.bgInput, border: `1px solid ${colors.borderStrong}`,
              color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none',
              boxSizing: 'border-box', marginBottom: spacing[4],
            }}
          />

          <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>规格</label>
          <input
            type="text"
            value={editForm.spec}
            onChange={(e) => setEditForm({ ...editForm, spec: e.target.value })}
            placeholder="如：10粒/盒"
            style={{
              width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md,
              background: colors.bgInput, border: `1px solid ${colors.borderStrong}`,
              color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none',
              boxSizing: 'border-box', marginBottom: spacing[4],
            }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[4], marginBottom: spacing[4] }}>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>售价 ¥</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editForm.price}
                onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                style={{
                  width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md,
                  background: colors.bgInput, border: `1px solid ${colors.borderStrong}`,
                  color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>库存</label>
              <input
                type="number"
                min="0"
                value={editForm.stock}
                onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                style={{
                  width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md,
                  background: colors.bgInput, border: `1px solid ${colors.borderStrong}`,
                  color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>状态</label>
          <div style={{ display: 'flex', gap: spacing[3] }}>
            <button
              type="button"
              onClick={() => setEditForm({ ...editForm, status: 'active' })}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: radius.md, cursor: 'pointer', fontFamily: 'inherit', fontSize: fontSize.sm,
                background: editForm.status === 'active' ? colors.primaryBg : colors.bgInput,
                border: `1px solid ${editForm.status === 'active' ? colors.primaryBorder : colors.borderStrong}`,
                color: editForm.status === 'active' ? colors.primary : colors.textMuted, fontWeight: fontWeight.semibold,
              }}
            >✓ 上架中</button>
            <button
              type="button"
              onClick={() => setEditForm({ ...editForm, status: 'inactive' })}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: radius.md, cursor: 'pointer', fontFamily: 'inherit', fontSize: fontSize.sm,
                background: editForm.status === 'inactive' ? colors.dangerBg : colors.bgInput,
                border: `1px solid ${editForm.status === 'inactive' ? colors.dangerBorder : colors.borderStrong}`,
                color: editForm.status === 'inactive' ? colors.danger : colors.textMuted, fontWeight: fontWeight.semibold,
              }}
            >⏸ 已下架</button>
            <button
              type="button"
              onClick={() => setEditForm({ ...editForm, status: 'draft' })}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: radius.md, cursor: 'pointer', fontFamily: 'inherit', fontSize: fontSize.sm,
                background: editForm.status === 'draft' ? 'rgba(156,163,175,0.18)' : colors.bgInput,
                border: `1px solid ${editForm.status === 'draft' ? 'rgba(156,163,175,0.4)' : colors.borderStrong}`,
                color: editForm.status === 'draft' ? '#9ca3af' : colors.textMuted, fontWeight: fontWeight.semibold,
              }}
            >📝 草稿</button>
          </div>

          {/* v3.0 — 扩展编辑字段 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[4], marginTop: spacing[5], marginBottom: spacing[4] }}>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>商品编码</label>
              <input type="text" value={editForm.productCode}
                onChange={(e) => setEditForm({ ...editForm, productCode: e.target.value })}
                style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>厂家 / 产地</label>
              <input type="text" value={editForm.manufacturer}
                onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })}
                style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing[4], marginBottom: spacing[4] }}>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>分类</label>
              <input type="text" value={editForm.categoryLabel}
                onChange={(e) => setEditForm({ ...editForm, categoryLabel: e.target.value, category: e.target.value })}
                placeholder="例:时令鲜果"
                style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>单位</label>
              <select value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}>
                <option value="">—</option>
                <option value="份">份</option><option value="斤">斤</option><option value="kg">kg</option>
                <option value="个">个</option><option value="盒">盒</option><option value="袋">袋</option>
                <option value="瓶">瓶</option><option value="提">提</option><option value="箱">箱</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>条码</label>
              <input type="text" value={editForm.barcode}
                onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing[4], marginBottom: spacing[4] }}>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>原价 ¥</label>
              <input type="number" step="0.01" min="0" value={editForm.totalAmount}
                onChange={(e) => setEditForm({ ...editForm, totalAmount: e.target.value })}
                style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>会员价 ¥</label>
              <input type="number" step="0.01" min="0" value={editForm.memberPrice}
                onChange={(e) => setEditForm({ ...editForm, memberPrice: e.target.value })}
                style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>积分</label>
              <input type="number" min="0" value={editForm.points}
                onChange={(e) => setEditForm({ ...editForm, points: e.target.value })}
                style={{ width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>商品图(从本机选文件上传)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: spacing[3] }}>
            <label style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px dashed ${colors.borderStrong}`, color: imgUploading ? colors.textSubtle : colors.primary, fontSize: fontSize.sm, cursor: imgUploading ? 'wait' : 'pointer', boxSizing: 'border-box' }}>
              {imgUploading ? '⏳ 上传中…' : (editForm.image ? '🔄 换一张' : '📁 选择图片文件')}
              <input type="file" accept="image/*" disabled={imgUploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'edit'); e.target.value = '' }} style={{ display: 'none' }} />
            </label>
            {editForm.image && <img src={editForm.image} alt="预览" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: radius.md, border: `1px solid ${colors.borderMuted}` }} />}
          </div>
          <input type="text" value={editForm.image}
            onChange={(e) => setEditForm({ ...editForm, image: e.target.value })}
            placeholder="或粘贴 URL(/uploads/... 或 https://...)"
            style={{ width: '100%', minHeight: 36, padding: '8px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderMuted}`, color: colors.textSubtle, fontSize: fontSize.xs, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: spacing[4] }} />

          <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>描述</label>
          <textarea value={editForm.description} rows={3}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            placeholder="产地、口感、储存方式…"
            style={{ width: '100%', minHeight: 80, padding: '10px 12px', borderRadius: radius.md, background: colors.bgInput, border: `1px solid ${colors.borderStrong}`, color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
        </Modal>
      )}

      {/* ⭐ P0 #7.5 — 进货信息 Modal */}
      {supplierTarget && (
        <Modal
          open={true}
          onClose={() => setSupplierTarget(null)}
          title={`📦 进货信息「${supplierTarget.shortName || supplierTarget.name}」`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setSupplierTarget(null)}>取消</Button>
              <Button variant="primary" onClick={handleSaveSupplier} loading={busy[supplierTarget.id]}>保存进货信息</Button>
            </>
          }
        >
          <div style={{ marginBottom: spacing[4], fontSize: fontSize.xs, color: colors.textSubtle }}>
            编码：<span style={{ fontFamily: 'monospace' }}>{supplierTarget.productCode}</span>
            {' · '}售价：<span style={{ color: colors.primary, fontWeight: fontWeight.bold }}>¥{supplierTarget.price}</span>
          </div>

          <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>进货价 ¥ <span style={{ color: colors.danger }}>*</span></label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={supplierForm.costPrice}
            onChange={(e) => setSupplierForm({ ...supplierForm, costPrice: e.target.value })}
            autoFocus
            style={{
              width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md,
              background: colors.bgInput, border: `1px solid ${colors.borderStrong}`,
              color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none',
              boxSizing: 'border-box', marginBottom: spacing[4],
            }}
          />

          {supplierForm.costPrice && Number(supplierForm.costPrice) > 0 && supplierTarget.price > 0 && (
            <div style={{ marginBottom: spacing[4], padding: spacing[3], borderRadius: radius.md, background: colors.primaryBgSubtle, border: `1px solid ${colors.primaryBorder}`, fontSize: fontSize.xs, color: colors.primary }}>
              💡 预估毛利率：<span style={{ fontWeight: fontWeight.bold }}>{Math.round(((supplierTarget.price - Number(supplierForm.costPrice)) / supplierTarget.price) * 1000) / 10}%</span>
              （售价 ¥{supplierTarget.price} − 进货 ¥{supplierForm.costPrice}）
            </div>
          )}

          <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>供应商名称</label>
          <input
            type="text"
            value={supplierForm.supplierName}
            onChange={(e) => setSupplierForm({ ...supplierForm, supplierName: e.target.value })}
            placeholder="例：国药控股铜仁公司"
            style={{
              width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md,
              background: colors.bgInput, border: `1px solid ${colors.borderStrong}`,
              color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none',
              boxSizing: 'border-box', marginBottom: spacing[4],
            }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[4], marginBottom: spacing[4] }}>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>联系电话</label>
              <input
                type="tel"
                value={supplierForm.supplierPhone}
                onChange={(e) => setSupplierForm({ ...supplierForm, supplierPhone: e.target.value })}
                placeholder="0856-12345678"
                style={{
                  width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md,
                  background: colors.bgInput, border: `1px solid ${colors.borderStrong}`,
                  color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>联系人</label>
              <input
                type="text"
                value={supplierForm.supplierContact}
                onChange={(e) => setSupplierForm({ ...supplierForm, supplierContact: e.target.value })}
                placeholder="张经理"
                style={{
                  width: '100%', minHeight: 40, padding: '10px 12px', borderRadius: radius.md,
                  background: colors.bgInput, border: `1px solid ${colors.borderStrong}`,
                  color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <label style={{ display: 'block', fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 }}>备注</label>
          <textarea
            value={supplierForm.supplierNote}
            onChange={(e) => setSupplierForm({ ...supplierForm, supplierNote: e.target.value })}
            placeholder="例：每周二送货 / 货到付款 / 起订量 50 件"
            rows={3}
            style={{
              width: '100%', minHeight: 80, padding: '10px 12px', borderRadius: radius.md,
              background: colors.bgInput, border: `1px solid ${colors.borderStrong}`,
              color: colors.text, fontSize: fontSize.sm, fontFamily: 'inherit', outline: 'none',
              boxSizing: 'border-box', resize: 'vertical',
            }}
          />
        </Modal>
      )}

      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle ? (confirmToggle.status === 'active' ? `下架「${confirmToggle.shortName || confirmToggle.name}」？` : `上架「${confirmToggle.shortName || confirmToggle.name}」？`) : ''}
        description={confirmToggle?.status === 'active' ? '下架后用户在前台看不到这个商品' : '上架后用户可在前台购买'}
        confirmText={confirmToggle?.status === 'active' ? '下架' : '上架'}
        onConfirm={() => confirmToggle && handleToggleStatus(confirmToggle)}
        onCancel={() => setConfirmToggle(null)}
        danger={confirmToggle?.status === 'active'}
      />

      {showScanner && (
        <BarcodeScanner
          onDetected={(code) => {
            setShowScanner(false)
            setQ(code)
            toast.toast(`条码 ${code} 已填入搜索框`, 'ok')
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
      <style>{`
        @keyframes scannerGunPulse {
          0%, 100% { transform: translateX(-50%) scale(1); }
          50% { transform: translateX(-50%) scale(1.04); box-shadow: 0 4px 24px rgba(184, 134, 11, 0.7), 0 0 0 4px rgba(184, 134, 11, 0.3); }
        }
      `}</style>
    </AdminLayout>
  )
}
export default function ProductsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>加载中…</div>}>
      <ProductsPageInner />
    </Suspense>
  )
}