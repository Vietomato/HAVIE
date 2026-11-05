import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, ClipboardList, LogOut, Plus, RotateCw, Search, ShieldAlert } from 'lucide-react';
import { formatDate, money } from '../../data';
import {
  adminApi,
  catalogApi,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../../api';
import ReasonDialog from '../../components/ReasonDialog.jsx';
import { BlockSkeleton } from '../../components/Skeleton.jsx';
import { useStore } from '../../context/StoreContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import usePageTitle from '../../hooks/usePageTitle.js';
import { localizeVariantName } from '../../utils/product';
import ProductFormModal from './ProductFormModal.jsx';

const ORDER_NEXT_STATUSES = {
  PENDING_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['COMPLETED'],
};

const LOW_STOCK_LIMIT = 5;

const TABS = [
  { key: 'orders', label: 'Đơn hàng', icon: ClipboardList },
  { key: 'products', label: 'Sản phẩm', icon: Package },
];

const includesText = (value, term) => (value || '').toLowerCase().includes(term);

export default function Admin() {
  const { account, authLoading } = useStore();
  const { notify } = useToast();
  const [tab, setTab] = useState('orders');
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminProducts, setAdminProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [pageError, setPageError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [updatingOrder, setUpdatingOrder] = useState(null);
  const activeTab = TABS.find(({ key }) => key === tab);
  usePageTitle('Quản trị: ' + activeTab.label);

  const reloadData = async ({ background = false } = {}) => {
    try {
      if (!background) setLoading(true);
      setPageError('');
      const [ords, prods, categoryList, brandList] = await Promise.all([
        adminApi.getOrders(),
        adminApi.getProducts(),
        catalogApi.getCategories(),
        catalogApi.getBrands(),
      ]);
      setAdminOrders(ords || []);
      setAdminProducts(prods || []);
      setCategories(categoryList || []);
      setBrands(brandList || []);
    } catch (e) {
      setPageError(e.message || 'Không thể tải dữ liệu quản trị.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account?.role === 'ADMIN') {
      reloadData();
    }
  }, [account]);

  if (authLoading) {
    return (
      <div className="container page-pad">
        <BlockSkeleton label="Đang kiểm tra quyền truy cập..." rows={4} />
      </div>
    );
  }

  if (!account || account.role !== 'ADMIN') {
    return (
      <div className="container page-pad empty-state">
        <ShieldAlert size={56} aria-hidden="true" />
        <h1>Trang dành cho quản trị viên</h1>
        <p>Vui lòng đăng nhập bằng tài khoản quản trị để tiếp tục.</p>
        <div className="empty-actions">
          <Link to="/auth?returnTo=%2Fadmin" className="btn btn-primary">
            ĐĂNG NHẬP
          </Link>
          <Link to="/" className="btn btn-outline">
            VỀ TRANG CHỦ
          </Link>
        </div>
      </div>
    );
  }

  const changeTab = (nextTab) => {
    setTab(nextTab);
    setSearchTerm('');
    setStatusFilter('ALL');
  };

  const applyStatus = async (order, newStatus, reason) => {
    await adminApi.updateOrderStatus(order.id, newStatus, reason);
    await reloadData({ background: true });
    notify({
      message: `Đơn ${order.orderCode}: ${ORDER_STATUS_LABELS[newStatus] || newStatus}.`,
    });
  };

  const handleUpdateStatus = async (order, newStatus) => {
    if (newStatus === 'CANCELLED') {
      setCancelTarget(order);
      return;
    }
    try {
      setUpdatingOrder(order.id);
      await applyStatus(order, newStatus);
    } catch (err) {
      notify({ type: 'error', message: err.message || 'Lỗi cập nhật trạng thái đơn.' });
    } finally {
      setUpdatingOrder(null);
    }
  };

  const openProductForm = (product = null) => {
    setEditingProduct(product);
    setProductModalOpen(true);
  };

  const term = searchTerm.trim().toLowerCase();
  const visibleOrders = adminOrders.filter(
    (order) =>
      (statusFilter === 'ALL' || order.status === statusFilter) &&
      (!term ||
        includesText(order.orderCode, term) ||
        includesText(order.recipientName, term) ||
        includesText(order.recipientPhone, term)),
  );
  const visibleProducts = adminProducts.filter(
    (product) =>
      !term ||
      includesText(product.name, term) ||
      includesText(product.slug, term) ||
      product.variants.some((variant) => includesText(variant.sku, term)),
  );

  const countByStatus = (status) => adminOrders.filter((order) => order.status === status).length;
  const lowStockCount = adminProducts.filter((product) =>
    product.variants.some((variant) => variant.stockQuantity <= LOW_STOCK_LIMIT),
  ).length;
  const stats =
    tab === 'orders'
      ? [
          ['Tổng đơn hàng', adminOrders.length],
          ['Chờ xác nhận', countByStatus('PENDING_CONFIRMATION')],
          ['Đang giao', countByStatus('SHIPPING')],
          ['Hoàn thành', countByStatus('COMPLETED')],
        ]
      : [
          ['Tổng sản phẩm', adminProducts.length],
          ['Đang kinh doanh', adminProducts.filter((product) => product.isActive).length],
          ['Đã ẩn', adminProducts.filter((product) => !product.isActive).length],
          ['Sắp hết hàng', lowStockCount],
        ];

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-brand">
          HAVIE<span className="dot">.</span>
          <small>QUẢN TRỊ CỬA HÀNG</small>
        </Link>
        <nav aria-label="Điều hướng quản trị">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={tab === key ? 'active' : ''}
              aria-current={tab === key ? 'page' : undefined}
              onClick={() => changeTab(key)}
            >
              <Icon size={20} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <Link to="/" className="admin-exit">
          <LogOut size={19} aria-hidden="true" /> Về trang bán hàng
        </Link>
      </aside>

      <main className="admin-main">
        <header className="admin-top">
          <span className="admin-crumb">Quản trị / {activeTab.label}</span>
          <Link to="/" className="admin-brand-mobile">
            HAVIE<span className="dot">.</span>
          </Link>
          <strong>
            <span className="admin-name">{account.fullName}</span>
            <span className="admin-avatar" aria-hidden="true">
              {account.fullName?.charAt(0).toUpperCase() || 'A'}
            </span>
          </strong>
        </header>
        <nav className="admin-mobile-nav" aria-label="Điều hướng quản trị trên di động">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={tab === key ? 'active' : ''}
              aria-current={tab === key ? 'page' : undefined}
              onClick={() => changeTab(key)}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>

        <div className="admin-content">
          <div className="admin-title">
            <h1>
              {activeTab.label}
              <span className="dot">.</span>
            </h1>
            <div className="admin-title-actions">
              <button
                type="button"
                className="btn btn-outline"
                aria-label="Tải lại dữ liệu"
                disabled={loading}
                onClick={() => reloadData()}
              >
                <RotateCw size={16} className={loading ? 'spin' : ''} aria-hidden="true" />
              </button>
              {tab === 'products' && (
                <button type="button" className="btn btn-primary" onClick={() => openProductForm()}>
                  <Plus size={18} aria-hidden="true" /> THÊM SẢN PHẨM
                </button>
              )}
            </div>
          </div>

          {pageError && (
            <div className="inline-alert" role="alert">
              <span>{pageError}</span>
              <button type="button" className="btn-mini" onClick={() => reloadData()}>
                Thử tải lại
              </button>
            </div>
          )}

          <div className="stat-grid">
            {stats.map(([label, value]) => (
              <div className="stat-card" key={label}>
                <span>{label}</span>
                <strong>{loading ? '–' : value}</strong>
              </div>
            ))}
          </div>

          <div className="admin-filters">
            <div className="admin-search">
              <Search size={17} aria-hidden="true" />
              <label className="sr-only" htmlFor="admin-search">
                {tab === 'orders' ? 'Tìm đơn hàng' : 'Tìm sản phẩm'}
              </label>
              <input
                id="admin-search"
                type="search"
                value={searchTerm}
                placeholder={
                  tab === 'orders' ? 'Mã đơn, tên khách, số điện thoại' : 'Tên sản phẩm, slug, SKU'
                }
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            {tab === 'orders' && (
              <>
                <label className="sr-only" htmlFor="admin-status-filter">
                  Lọc theo trạng thái
                </label>
                <select
                  id="admin-status-filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="ALL">Mọi trạng thái</option>
                  {Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => (
                    <option key={status} value={status}>
                      {label}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          {loading ? (
            <BlockSkeleton label="Đang tải dữ liệu quản trị..." rows={5} />
          ) : tab === 'orders' ? (
            <section className="admin-panel" aria-label="Danh sách đơn hàng">
              {visibleOrders.length ? (
                <div className="table-scroll" tabIndex={0} aria-label="Bảng đơn hàng, có thể cuộn ngang">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Mã đơn</th>
                        <th scope="col">Khách hàng</th>
                        <th scope="col">Địa chỉ</th>
                        <th scope="col">Tổng tiền</th>
                        <th scope="col">Thanh toán</th>
                        <th scope="col">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOrders.map((o) => {
                        const nextStatuses = ORDER_NEXT_STATUSES[o.status] || [];
                        return (
                          <tr key={o.id}>
                            <td>
                              <strong>{o.orderCode}</strong>
                              <small>{formatDate(o.createdAt)}</small>
                            </td>
                            <td>
                              {o.recipientName}
                              <small>{o.recipientPhone}</small>
                            </td>
                            <td className="table-address">{o.shippingAddress}</td>
                            <td>
                              <strong>{money(o.totalAmount)}</strong>
                            </td>
                            <td>
                              <span className={'status-badge ' + o.paymentStatus}>
                                {PAYMENT_STATUS_LABELS[o.paymentStatus] || o.paymentStatus}
                              </span>
                              <small>
                                {o.paymentMethod === 'COD'
                                  ? 'COD'
                                  : PAYMENT_METHOD_LABELS[o.paymentMethod] || o.paymentMethod}
                              </small>
                            </td>
                            <td>
                              {nextStatuses.length ? (
                                <select
                                  className="table-select"
                                  value={o.status}
                                  disabled={updatingOrder === o.id}
                                  aria-label={`Trạng thái đơn ${o.orderCode}`}
                                  onChange={(e) => handleUpdateStatus(o, e.target.value)}
                                >
                                  <option value={o.status}>
                                    {ORDER_STATUS_LABELS[o.status] || o.status}
                                  </option>
                                  {nextStatuses.map((status) => (
                                    <option key={status} value={status}>
                                      Chuyển sang: {ORDER_STATUS_LABELS[status] || status}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className={'status-badge ' + o.status}>
                                  {ORDER_STATUS_LABELS[o.status] || o.status}
                                </span>
                              )}
                              {o.cancelReason && <small>Lý do: {o.cancelReason}</small>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="admin-empty">
                  {adminOrders.length ? 'Không có đơn hàng phù hợp.' : 'Chưa có đơn hàng nào.'}
                </p>
              )}
            </section>
          ) : (
            <section className="admin-panel" aria-label="Danh sách sản phẩm">
              {visibleProducts.length ? (
                <div className="table-scroll" tabIndex={0} aria-label="Bảng sản phẩm, có thể cuộn ngang">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Sản phẩm</th>
                        <th scope="col">Danh mục</th>
                        <th scope="col">Biến thể</th>
                        <th scope="col">Trạng thái</th>
                        <th scope="col">
                          <span className="sr-only">Thao tác</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProducts.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div className="table-product">
                              {p.imageUrls?.[0] && (
                                <img src={p.imageUrls[0]} alt="" width="44" height="44" loading="lazy" />
                              )}
                              <div>
                                <strong>{p.name}</strong>
                                <small>{p.slug}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            {p.category?.name}
                            <small>{p.brand?.name}</small>
                          </td>
                          <td>
                            <ul className="table-variants">
                              {p.variants.map((v) => (
                                <li key={v.id}>
                                  <span>
                                    {localizeVariantName(v.name)} · <strong>{money(v.price)}</strong>
                                  </span>
                                  <span
                                    className={
                                      v.stockQuantity <= LOW_STOCK_LIMIT ? 'stock-low' : 'stock-ok'
                                    }
                                  >
                                    Kho: {v.stockQuantity}
                                    {v.isAvailable ? '' : ' · Ngừng bán'}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td>
                            <span
                              className={'status-badge ' + (p.isActive ? 'COMPLETED' : 'CANCELLED')}
                            >
                              {p.isActive ? 'Đang bán' : 'Đã ẩn'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-mini"
                              aria-label={'Sửa ' + p.name}
                              onClick={() => openProductForm(p)}
                            >
                              Sửa
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="admin-empty">
                  {adminProducts.length ? 'Không có sản phẩm phù hợp.' : 'Chưa có sản phẩm nào.'}
                </p>
              )}
            </section>
          )}
        </div>
      </main>

      <ProductFormModal
        open={productModalOpen}
        product={editingProduct}
        categories={categories}
        brands={brands}
        onClose={() => setProductModalOpen(false)}
        onSaved={() => reloadData({ background: true })}
      />
      <ReasonDialog
        open={Boolean(cancelTarget)}
        title="Hủy đơn hàng"
        description={cancelTarget ? `Khách hàng sẽ thấy lý do hủy đơn ${cancelTarget.orderCode}.` : ''}
        confirmLabel="XÁC NHẬN HỦY"
        onClose={() => setCancelTarget(null)}
        onConfirm={(reason) => applyStatus(cancelTarget, 'CANCELLED', reason)}
      />
    </div>
  );
}
