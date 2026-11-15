import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, CircleX } from 'lucide-react';
import { orderApi } from '../api';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import QrPayment from '../components/QrPayment.jsx';
import { BlockSkeleton } from '../components/Skeleton.jsx';
import { useStore } from '../context/StoreContext.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

// Mở lại mã QR của một đơn chuyển khoản đang chờ thanh toán (khách quay lại từ "Đơn hàng của tôi"
// hoặc từ trang payOS).
export default function PayOrder() {
  usePageTitle('Thanh toán đơn hàng');
  const { id } = useParams();
  const { account, authLoading } = useStore();
  const [state, setState] = useState({ loading: true, order: null, payment: null, error: '' });

  const load = useCallback(async () => {
    try {
      setState((current) => ({ ...current, loading: true, error: '' }));
      const result = await orderApi.getOrderPayment(id);
      setState({ loading: false, order: result.order, payment: result.payment, error: '' });
    } catch (error) {
      setState({
        loading: false,
        order: null,
        payment: null,
        error: error.message || 'Không tải được đơn hàng.',
      });
    }
  }, [id]);

  useEffect(() => {
    if (!authLoading && account) load();
  }, [authLoading, account, load]);

  const setOrder = (order) => setState((current) => ({ ...current, order }));

  let body;
  if (authLoading || (account && state.loading)) {
    body = <BlockSkeleton label="Đang tải thông tin thanh toán..." rows={4} />;
  } else if (!account) {
    body = (
      <div className="empty-state">
        <h1>Đăng nhập để thanh toán</h1>
        <Link
          to={'/auth?returnTo=' + encodeURIComponent('/account/orders/' + id + '/pay')}
          className="btn btn-primary"
        >
          ĐĂNG NHẬP
        </Link>
      </div>
    );
  } else if (state.error) {
    body = (
      <div className="empty-state">
        <CircleX size={54} aria-hidden="true" />
        <h1>Không mở được trang thanh toán</h1>
        <p>{state.error}</p>
        <Link to="/account/orders" className="btn btn-primary">
          VỀ ĐƠN HÀNG CỦA TÔI
        </Link>
      </div>
    );
  } else if (state.order.status !== 'PENDING_PAYMENT') {
    const paid = state.order.paymentStatus === 'PAID';
    body = (
      <div className="empty-state">
        {paid ? <CheckCircle2 size={54} aria-hidden="true" /> : <CircleX size={54} aria-hidden="true" />}
        <h1>{paid ? 'Thanh toán thành công!' : 'Đơn hàng không còn chờ thanh toán'}</h1>
        <p>
          Mã đơn {state.order.orderCode}.{' '}
          {paid ? 'Shop sẽ xác nhận đơn của bạn trong thời gian sớm nhất.' : 'Đơn đã hết hạn hoặc đã bị hủy.'}
        </p>
        <Link to="/account/orders" className="btn btn-primary">
          XEM ĐƠN HÀNG CỦA TÔI
        </Link>
      </div>
    );
  } else {
    body = (
      <QrPayment order={state.order} payment={state.payment} onPaid={setOrder} onClosed={setOrder} />
    );
  }

  return (
    <div className="container page-pad checkout-page">
      <Breadcrumbs
        items={[
          { label: 'Trang chủ', to: '/' },
          { label: 'Đơn hàng', to: '/account/orders' },
          { label: 'Thanh toán' },
        ]}
      />
      {body}
    </div>
  );
}
