import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Package, ClipboardList, Users, Settings, LogOut, ShieldAlert } from 'lucide-react';
import { money } from '../../data';
import { adminApi, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '../../api';
import { useStore } from '../../context/StoreContext.jsx';

export default function Admin() {
  const { account } = useStore();
  const [tab, setTab] = useState('Overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminProducts, setAdminProducts] = useState([]);
  const [adminInventory, setAdminInventory] = useState([]);
  const [adminCustomers, setAdminCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVariantForAdjust, setSelectedVariantForAdjust] = useState(null);
  const [deltaQty, setDeltaQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState('Kiểm kê thực tế');

  const reloadData = async () => {
    try {
      setLoading(true);
      const [dash, ords, prods, inv, custs] = await Promise.all([
        adminApi.getDashboard(),
        adminApi.getOrders(),
        adminApi.getProducts(),
        adminApi.getInventory(),
        adminApi.getCustomers(),
      ]);
      setDashboardData(dash);
      setAdminOrders(ords || []);
      setAdminProducts(prods || []);
      setAdminInventory(inv || []);
      setAdminCustomers(custs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account?.role === 'ADMIN') {
      reloadData();
    }
  }, [account]);

  if (!account || account.role !== 'ADMIN') {
    return (
      <div className="container page-pad empty-state">
        <ShieldAlert size={56} color="var(--danger)" />
        <h1>Yêu cầu quyền Quản trị viên (ADMIN)</h1>
        <p>Tài khoản Admin chỉ được tạo cho email nằm trong danh sách được cho phép.</p>
        <div className="mt-5">
          <Link to="/auth" className="btn btn-primary">
            ĐẾN TRANG ĐĂNG NHẬP
          </Link>
        </div>
      </div>
    );
  }

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await adminApi.updateOrderStatus(orderId, newStatus);
      await reloadData();
    } catch (err) {
      alert(err.message || 'Lỗi cập nhật trạng thái đơn.');
    }
  };

  const handleRecordCod = async (orderId) => {
    try {
      await adminApi.recordCodPayment(orderId);
      await reloadData();
      alert('Đã ghi nhận thu tiền COD thành công!');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    if (!selectedVariantForAdjust) return;
    try {
      await adminApi.adjustStock({
        variantId: selectedVariantForAdjust.variantId,
        quantityDelta: Number(deltaQty),
        reason: adjustReason,
      });
      setSelectedVariantForAdjust(null);
      await reloadData();
      alert('Điều chỉnh tồn kho thành công!');
    } catch (err) {
      alert(err.message || 'Lỗi điều chỉnh tồn kho.');
    }
  };

  const handleToggleCustomer = async (customerId, currentStatus) => {
    const reason = prompt('Lý do thay đổi trạng thái tài khoản:');
    if (reason === null) return;
    try {
      await adminApi.updateCustomerStatus(customerId, !currentStatus, reason);
      await reloadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const nav = [
    ['Overview', LayoutDashboard],
    ['Orders', ClipboardList],
    ['Products', Package],
    ['Inventory', Settings],
    ['Customers', Users],
  ];

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <Link to="/" className="admin-brand">
          HAVIE.<small>ADMIN STUDIO v1</small>
        </Link>
        <nav aria-label="Điều hướng quản trị">
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={tab === label ? 'active' : ''}
              onClick={() => setTab(label)}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </nav>
        <Link to="/" className="admin-exit">
          <LogOut size={19} /> Về trang bán hàng
        </Link>
      </aside>

      <main className="admin-main">
        <header className="admin-top">
          <span>STORE MANAGEMENT / {tab.toUpperCase()}</span>
          <strong>
            {account.fullName} <span className="admin-avatar">A</span>
          </strong>
        </header>

        <div className="admin-content">
          <div className="admin-title">
            <div>
              <span className="eyebrow">API CONTRACT V1 BACKOFFICE</span>
              <h1>
                {tab === 'Overview' ? 'Dashboard' : tab}
                <span className="dot">.</span>
              </h1>
            </div>
            <span className="demo-pill">CONTRACT PERSISTENT</span>
          </div>

          {/* Adjust Stock Modal */}
          {selectedVariantForAdjust && (
            <div className="qr-overlay">
              <div className="qr-modal text-left">
                <h2>ĐIỀU CHỈNH TỒN KHO (CONTRACT 4.4)</h2>
                <p>
                  Sản phẩm: <strong>{selectedVariantForAdjust.productName}</strong> (
                  {selectedVariantForAdjust.variantName})
                </p>
                <p>SKU: <strong>{selectedVariantForAdjust.sku}</strong></p>
                <p>Tồn kho hiện tại: <strong>{selectedVariantForAdjust.stockQuantity}</strong></p>
                <form onSubmit={handleAdjustStock}>
                  <label className="mt-[10px] mb-[5px] block">
                    SỐ LƯỢNG THAY ĐỔI (+ HOẶC -):
                    <input
                      type="number"
                      required
                      value={deltaQty}
                      onChange={(e) => setDeltaQty(e.target.value)}
                      placeholder="+5 hoặc -2"
                    />
                  </label>
                  <label className="mt-[10px] mb-[15px] block">
                    LÝ DO ĐIỀU CHỈNH:
                    <input
                      required
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                    />
                  </label>
                  <div className="flex gap-[10px]">
                    <button type="submit" className="btn btn-primary full">
                      XÁC NHẬN GHI SỔ
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setSelectedVariantForAdjust(null)}
                    >
                      HỦY
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {tab === 'Overview' && dashboardData && (
            <>
              <div className="stat-grid">
                <article className="stat-card">
                  <span>TỔNG DOANH THU (ĐÃ THU)</span>
                  <strong>{money(dashboardData.totalRevenue || 0)}</strong>
                  <small>Đơn COMPLETED & PAID</small>
                </article>
                <article className="stat-card">
                  <span>TỔNG ĐƠN HÀNG</span>
                  <strong>{dashboardData.totalOrders || 0}</strong>
                  <small>{dashboardData.pendingOrdersCount || 0} đơn đang chờ xử lý</small>
                </article>
                <article className="stat-card">
                  <span>CẢNH BÁO TỒN KHO</span>
                  <strong
                    className={
                      dashboardData.lowStockCount ? 'text-[var(--danger)]' : 'text-[inherit]'
                    }
                  >
                    {dashboardData.lowStockCount || 0}
                  </strong>
                  <small>Biến thể dưới ngưỡng an toàn (≤ 8)</small>
                </article>
                <article className="stat-card">
                  <span>KHÁCH HÀNG</span>
                  <strong>{dashboardData.totalCustomers || 0}</strong>
                  <small>Tài khoản khách hàng</small>
                </article>
              </div>

              <section className="admin-panel orders-panel mt-6">
                <div className="panel-title">
                  <h2>Đơn hàng gần đây</h2>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>MÃ ĐƠN</th>
                        <th>KHÁCH HÀNG</th>
                        <th>THANH TOÁN</th>
                        <th>TỔNG TIỀN</th>
                        <th>TRẠNG THÁI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminOrders.slice(0, 5).map((o) => (
                        <tr key={o.id}>
                          <td><strong>{o.orderCode}</strong></td>
                          <td>{o.recipientName}</td>
                          <td>
                            {PAYMENT_METHOD_LABELS[o.paymentMethod] || o.paymentMethod} •{' '}
                            <span className={'status-badge ' + o.paymentStatus}>
                              {o.paymentStatus}
                            </span>
                          </td>
                          <td>{money(o.totalAmount)}</td>
                          <td>
                            <span className={'status-badge ' + o.status}>
                              {ORDER_STATUS_LABELS[o.status] || o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {tab === 'Orders' && (
            <section className="admin-panel orders-panel">
              <div className="panel-title">
                <h2>Quản lý toàn bộ đơn hàng</h2>
                <span>{adminOrders.length} ĐƠN HÀNG</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>MÃ ĐƠN</th>
                      <th>NGÀY</th>
                      <th>KHÁCH HÀNG</th>
                      <th>ĐỊA CHỈ</th>
                      <th>TỔNG TIỀN</th>
                      <th>THANH TOÁN</th>
                      <th>CHUYỂN TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminOrders.map((o) => (
                      <tr key={o.id}>
                        <td><strong>{o.orderCode}</strong></td>
                        <td>{new Date(o.createdAt).toLocaleDateString('vi-VN')}</td>
                        <td>{o.recipientName}<br /><small>{o.recipientPhone}</small></td>
                        <td className="max-w-[200px] text-xs">{o.shippingAddress}</td>
                        <td><strong>{money(o.totalAmount)}</strong></td>
                        <td>
                          {PAYMENT_METHOD_LABELS[o.paymentMethod] || o.paymentMethod} •{' '}
                          <span className={'status-badge ' + o.paymentStatus}>
                            {o.paymentStatus}
                          </span>
                        </td>
                        <td>
                          <select
                            value={o.status}
                            onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                          >
                            <option value="PENDING_PAYMENT">Chờ thanh toán</option>
                            <option value="PENDING_CONFIRMATION">Chờ xác nhận</option>
                            <option value="CONFIRMED">Đã xác nhận</option>
                            <option value="SHIPPING">Đang giao</option>
                            <option value="COMPLETED">Hoàn thành</option>
                            <option value="CANCELLED">Đã hủy</option>
                          </select>
                        </td>
                        <td>
                          {o.paymentMethod === 'COD' && o.paymentStatus !== 'PAID' && (
                            <button className="btn-mini" onClick={() => handleRecordCod(o.id)}>
                              Thu COD
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'Products' && (
            <section className="admin-panel">
              <div className="panel-title">
                <h2>Danh mục sản phẩm & biến thể</h2>
                <span>{adminProducts.length} SẢN PHẨM</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>SẢN PHẨM</th>
                      <th>DANH MỤC</th>
                      <th>BIẾN THỂ (VARIANTS)</th>
                      <th>ĐÁNH GIÁ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminProducts.map((p) => (
                      <tr key={p.id}>
                        <td><strong>{p.name}</strong></td>
                        <td>{p.category.name}</td>
                        <td>
                          {p.variants.map((v) => (
                            <div key={v.id} className="my-0.5 text-xs">
                              • {v.name} ({v.sku}): <strong>{money(v.price)}</strong> (Kho: {v.stockQuantity})
                            </div>
                          ))}
                        </td>
                        <td>★ {p.ratingAverage} ({p.reviewCount})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'Inventory' && (
            <section className="admin-panel">
              <div className="panel-title">
                <h2>Quản lý tồn kho & Điều chỉnh kho (Inventory)</h2>
                <span>{adminInventory.length} BIẾN THỂ HÀNG</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>SẢN PHẨM</th>
                      <th>BIẾN THỂ</th>
                      <th>GIÁ BÁN</th>
                      <th>TỒN KHO</th>
                      <th>CẢNH BÁO</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminInventory.map((item) => (
                      <tr key={item.sku}>
                        <td><code>{item.sku}</code></td>
                        <td>{item.productName}</td>
                        <td>{item.variantName}</td>
                        <td>{money(item.price)}</td>
                        <td><strong>{item.stockQuantity}</strong></td>
                        <td>
                          {item.isLowStock ? (
                            <span className="status-badge CANCELLED">Sắp hết hàng (≤ 8)</span>
                          ) : (
                            <span className="status-badge COMPLETED">An toàn</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn-mini"
                            onClick={() => {
                              setSelectedVariantForAdjust(item);
                              setDeltaQty(0);
                            }}
                          >
                            Điều chỉnh tồn
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'Customers' && (
            <section className="admin-panel">
              <div className="panel-title">
                <h2>Danh sách khách hàng</h2>
                <span>{adminCustomers.length} TÀI KHOẢN</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>HỌ TÊN</th>
                      <th>EMAIL</th>
                      <th>SỐ ĐIỆN THOẠI</th>
                      <th>SỐ ĐƠN ĐÃ ĐẶT</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminCustomers.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.fullName}</strong></td>
                        <td>{c.email}</td>
                        <td>{c.phone || 'Chưa có'}</td>
                        <td>{c.orderCount} đơn</td>
                        <td>
                          <span className={'status-badge ' + (c.isActive ? 'COMPLETED' : 'CANCELLED')}>
                            {c.isActive ? 'Hoạt động' : 'Đã khóa'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn-mini"
                            onClick={() => handleToggleCustomer(c.id, c.isActive)}
                          >
                            {c.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
