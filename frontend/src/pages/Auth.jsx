import React from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { money } from '../data';
import { authApi, orderApi, ORDER_STATUS_LABELS } from '../api';
import { useStore } from '../context/StoreContext.jsx';

export default function Auth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'profile';
  const [mode, setMode] = useState('signin');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  const { account, login, register, logout } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (account && activeTab === 'orders') {
      orderApi.getMyOrders().then((res) => {
        setMyOrders(res || []);
      });
    }
  }, [account, activeTab]);

  useEffect(() => {
    if (otpCooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setOtpCooldown((remaining) => remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [otpCooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (mode === 'signup') {
      if (!fullName.trim()) return setError('Vui lòng nhập họ và tên.');
      if (password !== confirm) return setError('Mật khẩu xác nhận không khớp.');
    }

    try {
      setLoading(true);
      if (mode === 'signin') {
        const u = await login(email, password);
        if (u.role === 'ADMIN') navigate('/admin');
      } else if (!otpSent) {
        const result = await authApi.requestRegistrationOtp({ fullName, email, phone, password });
        setOtpSent(true);
        setOtpCooldown(result.resendAfter || 60);
        setNotice(result.message || 'Mã xác minh đã được gửi tới email của bạn.');
      } else {
        const user = await register({ email, code: verificationCode });
        if (user.role === 'ADMIN') navigate('/admin');
      }
    } catch (err) {
      setError(err.message || 'Lỗi xác thực.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setNotice('');
    try {
      setLoading(true);
      const result = await authApi.requestRegistrationOtp({ fullName, email, phone, password });
      setOtpCooldown(result.resendAfter || 60);
      setVerificationCode('');
      setNotice(result.message || 'Mã xác minh đã được gửi lại tới email của bạn.');
    } catch (err) {
      setError(err.message || 'Không thể gửi lại mã xác minh.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    const reason = prompt('Vui lòng nhập lý do hủy đơn:');
    if (!reason) return;
    try {
      await orderApi.cancelOrder(orderId, reason);
      const updated = await orderApi.getMyOrders();
      setMyOrders(updated || []);
      alert('Đã hủy đơn hàng thành công.');
    } catch (err) {
      alert(err.message || 'Không thể hủy đơn hàng.');
    }
  };

  return (
    <div className="auth-layout">
      <aside className="auth-art">
        <Link to="/" className="auth-brand">
          HAVIE.
        </Link>
        <div>
          <span className="eyebrow">WELCOME TO THE CLUB</span>
          <h1>
            PLAY
            <br />
            BEYOND
            <br />
            LIMITS<span>.</span>
          </h1>
          <p>Hệ thống tài khoản và đơn hàng theo chuẩn API Contract v1.</p>
        </div>
        <span>HAVIE ARCHITECTURE / 2026</span>
      </aside>
      <section className="auth-panel">
        <div className="auth-box">
          {account ? (
            <>
              <div className="account-tabs">
                <button
                  className={activeTab === 'profile' ? 'active' : ''}
                  onClick={() => setSearchParams({ tab: 'profile' })}
                >
                  HỒ SƠ TÀI KHOẢN
                </button>
                <button
                  className={activeTab === 'orders' ? 'active' : ''}
                  onClick={() => setSearchParams({ tab: 'orders' })}
                >
                  ĐƠN HÀNG CỦA TÔI
                </button>
              </div>

              {activeTab === 'profile' ? (
                <>
                  <span className="eyebrow">ROLE: {account.role}</span>
                  <h2>Xin chào, {account.fullName}.</h2>
                  <p>Email: {account.email}</p>
                  <p>Số điện thoại: {account.phone || 'Chưa cập nhật'}</p>

                  {account.role === 'ADMIN' && (
                    <div className="my-[18px]">
                      <Link to="/admin" className="btn btn-primary full">
                        TRUY CẬP ADMIN STUDIO →
                      </Link>
                    </div>
                  )}

                  <div className="mt-5 flex gap-[10px]">
                    <button className="btn btn-outline full" onClick={logout}>
                      ĐĂNG XUẤT
                    </button>
                    <Link to="/products" className="btn btn-primary full">
                      TIẾP TỤC MUA SẮM
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2>LỊCH SỬ ĐƠN HÀNG</h2>
                  {myOrders.length ? (
                    <div className="orders-list">
                      {myOrders.map((ord) => (
                        <div key={ord.id} className="order-card">
                          <div className="order-card-header">
                            <div>
                              <strong>{ord.orderCode}</strong>
                              <small className="block text-[var(--muted)]">
                                {new Date(ord.createdAt).toLocaleDateString('vi-VN')}
                              </small>
                            </div>
                            <span className={'status-badge ' + ord.status}>
                              {ORDER_STATUS_LABELS[ord.status] || ord.status}
                            </span>
                          </div>
                          <div className="order-card-items">
                            {ord.items.map((it) => (
                              <div key={it.id} className="order-item-row">
                                <span>
                                  {it.productName} ({it.variantName}) × {it.quantity}
                                </span>
                                <strong>{money(it.unitPrice * it.quantity)}</strong>
                              </div>
                            ))}
                          </div>
                          <div className="order-card-footer">
                            <span>
                              Tổng: <strong>{money(ord.totalAmount)}</strong>
                            </span>
                            {['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED'].includes(
                              ord.status,
                            ) && (
                              <button
                                className="btn-mini border-[#b91c1c] text-[#b91c1c]"
                                onClick={() => handleCancelOrder(ord.id)}
                              >
                                Hủy đơn
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Bạn chưa có đơn hàng nào.</p>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <span className="eyebrow">YOUR HAVIE ACCOUNT</span>
              <h2>{mode === 'signin' ? 'Welcome back.' : 'Join the game.'}</h2>

              <div className="auth-tabs">
                <button
                  className={mode === 'signin' ? 'active' : ''}
                  onClick={() => {
                    setMode('signin');
                    setError('');
                    setNotice('');
                    setOtpSent(false);
                    setOtpCooldown(0);
                    setVerificationCode('');
                  }}
                >
                  SIGN IN
                </button>
                <button
                  className={mode === 'signup' ? 'active' : ''}
                  onClick={() => {
                    setMode('signup');
                    setError('');
                    setNotice('');
                    setOtpSent(false);
                    setOtpCooldown(0);
                    setVerificationCode('');
                  }}
                >
                  SIGN UP
                </button>
              </div>

              <form onSubmit={handleSubmit} className="auth-form">
                {mode === 'signup' && (
                  <>
                    <label>
                      HỌ VÀ TÊN
                      <input
                        required
                        value={fullName}
                        disabled={otpSent}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Nguyễn Hoàng Việt"
                      />
                    </label>
                    <label>
                      SỐ ĐIỆN THOẠI
                      <input
                        type="tel"
                        value={phone}
                        disabled={otpSent}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0900000000"
                      />
                    </label>
                  </>
                )}
                <label>
                  EMAIL ADDRESS
                  <input
                    required
                    type="email"
                    value={email}
                    disabled={mode === 'signup' && otpSent}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ten@email.com"
                  />
                </label>
                <label>
                  PASSWORD
                  <input
                    required
                    type="password"
                    value={password}
                    disabled={mode === 'signup' && otpSent}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    minLength={6}
                  />
                </label>
                {mode === 'signup' && (
                  <label>
                    XÁC NHẬN MẬT KHẨU
                    <input
                      required
                      type="password"
                      value={confirm}
                      disabled={otpSent}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </label>
                )}
                {mode === 'signup' && otpSent && (
                  <>
                    <p role="status">
                      Mã xác minh đã gửi tới {email}. Mã có hiệu lực trong 10 phút.
                    </p>
                    <label>
                      MÃ XÁC MINH EMAIL
                      <input
                        required
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) =>
                          setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        placeholder="Nhập mã 6 chữ số"
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-mini"
                      disabled={loading || otpCooldown > 0}
                      onClick={handleResendOtp}
                    >
                      {otpCooldown > 0 ? `GỬI LẠI MÃ SAU ${otpCooldown} GIÂY` : 'GỬI LẠI MÃ'}
                    </button>
                    <button
                      type="button"
                      className="btn-mini"
                      disabled={loading}
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCooldown(0);
                        setVerificationCode('');
                        setError('');
                        setNotice('');
                      }}
                    >
                      ĐỔI EMAIL HOẶC THÔNG TIN ĐĂNG KÝ
                    </button>
                  </>
                )}
                {notice && (
                  <p role="status" className="text-[13px] text-[var(--forest)]">
                    {notice}
                  </p>
                )}
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <button className="btn btn-primary full" type="submit" disabled={loading}>
                  {loading
                    ? 'ĐANG XỬ LÝ...'
                    : mode === 'signin'
                      ? 'ĐĂNG NHẬP'
                      : otpSent
                        ? 'XÁC MINH & TẠO TÀI KHOẢN'
                        : 'GỬI MÃ XÁC MINH'}{' '}
                  <ArrowRight size={18} />
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
