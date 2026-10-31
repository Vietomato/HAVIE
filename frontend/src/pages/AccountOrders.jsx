import React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { money } from '../data';
import { ORDER_STATUS_LABELS, orderApi } from '../api';
import OrderProgress from '../components/OrderProgress.jsx';
import { useStore } from '../context/StoreContext.jsx';

export default function AccountOrders() {
  const { account, authLoading } = useStore();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

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

  const cancelOrder = async (orderId) => {
    const reason = window.prompt('Vui lòng nhập lý do hủy đơn:');
    if (!reason?.trim()) return;

    try {
      await orderApi.cancelOrder(orderId, reason.trim());
      await refreshOrders(true);
      window.alert('Đã hủy đơn hàng thành công.');
    } catch (requestError) {
      window.alert(requestError.message || 'Không thể hủy đơn hàng.');
    }
  };

  return (
    <div className="container page-pad account-orders-page">
      <div className="account-orders-heading">
        <div>
          <p className="breadcrumbs">
            <Link to="/auth">TÀI KHOẢN</Link> / ĐƠN HÀNG
          </p>
          <span className="eyebrow">THEO DÕI ĐƠN HÀNG</span>
          <h1>
            LỊCH SỬ ĐƠN HÀNG<span className="dot">.</span>
          </h1>
          <p>Trạng thái đơn tự cập nhật sau mỗi 30 giây khi bạn đang mở trang này.</p>
        </div>
        {account?.role === 'CUSTOMER' && (
          <button
            className="btn btn-outline"
            onClick={() => refreshOrders(true)}
            disabled={refreshing}
          >
            {refreshing ? 'ĐANG CẬP NHẬT...' : 'CẬP NHẬT TRẠNG THÁI'}
          </button>
        )}
      </div>

      {authLoading ? (
        <p role="status">Đang kiểm tra tài khoản...</p>
      ) : !account ? (
        <section className="account-orders-empty">
          <h2>Đăng nhập để xem đơn hàng</h2>
          <p>Lịch sử đơn hàng chỉ hiển thị cho tài khoản đã đặt đơn.</p>
          <Link className="btn btn-primary" to="/auth?returnTo=%2Faccount%2Forders">
            ĐĂNG NHẬP
          </Link>
        </section>
      ) : account.role !== 'CUSTOMER' ? (
        <section className="account-orders-empty">
          <h2>Trang dành cho khách hàng</h2>
          <p>Admin quản lý đơn hàng tại trang quản trị.</p>
          <Link className="btn btn-primary" to="/admin">
            ĐẾN TRANG QUẢN TRỊ
          </Link>
        </section>
      ) : (
        <>
          {error && (
            <p className="my-4 text-[var(--danger)]" role="alert">
              {error}{' '}
              <button className="btn-mini" onClick={() => refreshOrders()}>
                Thử tải lại
              </button>
            </p>
          )}
          {loading && <p role="status">Đang tải đơn hàng...</p>}
          {!loading && !error && !orders.length && (
            <section className="account-orders-empty">
              <h2>Bạn chưa có đơn hàng nào</h2>
              <p>Đơn hàng bạn đặt sẽ xuất hiện tại đây.</p>
              <Link className="btn btn-primary" to="/products">
                TIẾP TỤC MUA SẮM
              </Link>
            </section>
          )}
          {orders.length > 0 && (
            <div className="orders-list">
              {orders.map((order) => (
                <article key={order.id} className="order-card">
                  <div className="order-card-header">
                    <div>
                      <strong>{order.orderCode}</strong>
                      <small className="block text-[var(--muted)]">
                        Đặt ngày: {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                      </small>
                      <small className="block text-[var(--muted)]">
                        Cập nhật:{' '}
                        {new Date(order.updatedAt || order.createdAt).toLocaleString('vi-VN')}
                      </small>
                    </div>
                    <span className={'status-badge ' + order.status}>
                      {ORDER_STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                  <div className="order-card-items">
                    {order.items.map((item) => (
                      <div key={item.id} className="order-item-row">
                        <span>
                          {item.productName} ({item.variantName}) × {item.quantity}
                        </span>
                        <strong>{money(item.price * item.quantity)}</strong>
                      </div>
                    ))}
                  </div>
                  <OrderProgress order={order} />
                  <div className="order-card-footer">
                    <span>
                      Tổng: <strong>{money(order.totalAmount)}</strong>
                    </span>
                    {['PENDING_CONFIRMATION', 'CONFIRMED'].includes(order.status) && (
                      <button
                        className="btn-mini border-[var(--danger)] text-[var(--danger)]"
                        onClick={() => cancelOrder(order.id)}
                      >
                        HỦY ĐƠN
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
