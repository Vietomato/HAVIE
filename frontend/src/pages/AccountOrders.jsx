import React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, RotateCw, ShieldCheck } from 'lucide-react';
import { formatDate, money } from '../data';
import { ORDER_STATUS_LABELS, orderApi } from '../api';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import OrderProgress from '../components/OrderProgress.jsx';
import ReasonDialog from '../components/ReasonDialog.jsx';
import { BlockSkeleton } from '../components/Skeleton.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { localizeVariantName } from '../utils/product.js';

const ORDER_TABS = [
  { key: 'all', label: 'Tất cả', statuses: null },
  {
    key: 'active',
    label: 'Đang xử lý',
    statuses: ['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'SHIPPING'],
  },
  { key: 'completed', label: 'Hoàn thành', statuses: ['COMPLETED'] },
  { key: 'cancelled', label: 'Đã hủy', statuses: ['CANCELLED', 'REFUND_PENDING'] },
];

export default function AccountOrders() {
  usePageTitle('Đơn hàng của tôi');
  const { account, authLoading } = useStore();
  const { notify } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [cancelTarget, setCancelTarget] = useState(null);

  const refreshOrders = useCallback(async (background = false) => {
    try {
      if (background) setRefreshing(true);
      else setLoading(true);
      setError('');
      const result = await orderApi.getMyOrders();
      setOrders(result || []);
    } catch (requestError) {
      setError(requestError.message || 'Không thể tải lịch sử đơn hàng.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || account?.role !== 'CUSTOMER') return undefined;

    refreshOrders();
    const intervalId = window.setInterval(() => refreshOrders(true), 30000);
    return () => window.clearInterval(intervalId);
  }, [account, authLoading, refreshOrders]);

  const confirmCancel = async (reason) => {
    await orderApi.cancelOrder(cancelTarget.id, reason);
    await refreshOrders(true);
    notify({ message: `Đã hủy đơn ${cancelTarget.orderCode}.` });
  };

  const statuses = ORDER_TABS.find((tab) => tab.key === activeTab).statuses;
  const visibleOrders = statuses
    ? orders.filter((order) => statuses.includes(order.status))
    : orders;

  return (
    <div className="container page-pad account-orders-page">
      <Breadcrumbs items={[{ label: 'Tài khoản', to: '/auth' }, { label: 'Đơn hàng' }]} />
      <div className="account-orders-heading">
        <div>
          <span className="eyebrow">THEO DÕI ĐƠN HÀNG</span>
          <h1>
            ĐƠN HÀNG CỦA TÔI<span className="dot">.</span>
          </h1>
          <p>Trạng thái đơn tự cập nhật mỗi 30 giây.</p>
        </div>
        {account?.role === 'CUSTOMER' && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => refreshOrders(true)}
            disabled={refreshing}
          >
            <RotateCw size={16} className={refreshing ? 'spin' : ''} aria-hidden="true" />
            {refreshing ? 'ĐANG CẬP NHẬT...' : 'CẬP NHẬT'}
          </button>
        )}
      </div>

      {authLoading ? (
        <BlockSkeleton label="Đang kiểm tra tài khoản..." />
      ) : !account ? (
        <section className="empty-state">
          <ClipboardList size={54} aria-hidden="true" />
          <h2>Đăng nhập để xem đơn hàng</h2>
          <p>Lịch sử đơn hàng chỉ hiển thị cho tài khoản đã đặt đơn.</p>
          <Link className="btn btn-primary" to="/auth?returnTo=%2Faccount%2Forders">
            ĐĂNG NHẬP
          </Link>
        </section>
      ) : account.role !== 'CUSTOMER' ? (
        <section className="empty-state">
          <ShieldCheck size={54} aria-hidden="true" />
          <h2>Trang dành cho khách hàng</h2>
          <p>Quản trị viên quản lý đơn hàng tại trang quản trị.</p>
          <Link className="btn btn-primary" to="/admin">
            ĐẾN TRANG QUẢN TRỊ
          </Link>
        </section>
      ) : (
        <>
          {error && (
            <div className="inline-alert" role="alert">
              <span>{error}</span>
              <button type="button" className="btn-mini" onClick={() => refreshOrders()}>
                Thử tải lại
              </button>
            </div>
          )}
          {loading && <BlockSkeleton label="Đang tải đơn hàng..." />}
          {!loading && !error && !orders.length && (
            <section className="empty-state">
              <ClipboardList size={54} aria-hidden="true" />
              <h2>Bạn chưa có đơn hàng nào</h2>
              <p>Đơn hàng bạn đặt sẽ xuất hiện tại đây.</p>
              <Link className="btn btn-primary" to="/products">
                BẮT ĐẦU MUA SẮM
              </Link>
            </section>
          )}
          {orders.length > 0 && (
            <>
              <div className="segmented" role="group" aria-label="Lọc đơn hàng">
                {ORDER_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={activeTab === tab.key ? 'active' : ''}
                    aria-pressed={activeTab === tab.key}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {!visibleOrders.length && (
                <p className="muted-text orders-empty-filter">Không có đơn hàng ở mục này.</p>
              )}
              <div className="orders-list">
                {visibleOrders.map((order) => (
                  <article key={order.id} className="order-card">
                    <div className="order-card-header">
                      <div>
                        <h2>{order.orderCode}</h2>
                        <small>Đặt ngày {formatDate(order.createdAt)}</small>
                      </div>
                      <span className={'status-badge ' + order.status}>
                        {ORDER_STATUS_LABELS[order.status] || order.status}
                      </span>
                    </div>
                    <div className="order-card-items">
                      {order.items.map((item) => (
                        <div key={item.id} className="order-item-row">
                          <span>
                            {item.productName} ({localizeVariantName(item.variantName)}) ×{' '}
                            {item.quantity}
                          </span>
                          <strong>{money(item.price * item.quantity)}</strong>
                        </div>
                      ))}
                    </div>
                    <OrderProgress order={order} />
                    <div className="order-card-footer">
                      <span>
                        Tổng cộng <strong>{money(order.totalAmount)}</strong>
                      </span>
                      {['PENDING_CONFIRMATION', 'CONFIRMED'].includes(order.status) && (
                        <button
                          type="button"
                          className="btn-mini btn-mini-danger"
                          aria-label={'Hủy đơn ' + order.orderCode}
                          onClick={() => setCancelTarget(order)}
                        >
                          Hủy đơn
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <ReasonDialog
        open={Boolean(cancelTarget)}
        title="Hủy đơn hàng"
        description={cancelTarget ? `Bạn sắp hủy đơn ${cancelTarget.orderCode}.` : ''}
        confirmLabel="XÁC NHẬN HỦY"
        onClose={() => setCancelTarget(null)}
        onConfirm={confirmCancel}
      />
    </div>
  );
}
