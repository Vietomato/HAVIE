import React from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { authApi } from '../api';
import { useStore } from '../context/StoreContext.jsx';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') === '/account/orders' ? '/account/orders' : null;
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
  const { account, login, register, logout } = useStore();
  const navigate = useNavigate();

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
        else if (returnTo) navigate(returnTo);
      } else if (!otpSent) {
        const result = await authApi.requestRegistrationOtp({ fullName, email, phone, password });
        setOtpSent(true);
        setOtpCooldown(result.resendAfter || 60);
        setNotice(result.message || 'Mã xác minh đã được gửi tới email của bạn.');
      } else {
        const user = await register({ email, code: verificationCode });
        if (user.role === 'ADMIN') navigate('/admin');
        else if (returnTo) navigate(returnTo);
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

  return (
    <div className="auth-layout">
      <aside className="auth-art">
        <Link to="/" className="auth-brand">
          HAVIE.
        </Link>
        <div>
          <span className="eyebrow">CHÀO MỪNG BẠN ĐẾN VỚI HAVIE</span>
          <h1>
            CHƠI
            <br />
            VƯỢT
            <br />
            GIỚI HẠN<span>.</span>
          </h1>
          <p>Đồng hành cùng bạn trên từng trận đấu và hành trình cầu lông.</p>
        </div>
        <span>HAVIE / 2026</span>
      </aside>
      <section className="auth-panel">
        <div className="auth-box">
          {account ? (
            <>
              <span className="eyebrow">ROLE: {account.role}</span>
              <h2>Xin chào, {account.fullName}.</h2>
              <p>Email: {account.email}</p>
              <p>Số điện thoại: {account.phone || 'Chưa cập nhật'}</p>

              {account.role === 'ADMIN' ? (
                <div className="my-[18px]">
                  <Link to="/admin" className="btn btn-primary full">
                    TRUY CẬP TRANG QUẢN TRỊ →
                  </Link>
                </div>
              ) : (
                <div className="my-[18px]">
                  <Link to="/account/orders" className="btn btn-outline full">
                    XEM LỊCH SỬ VÀ THEO DÕI ĐƠN HÀNG
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
              <span className="eyebrow">YOUR HAVIE ACCOUNT</span>
              <h2>{mode === 'signin' ? 'Chào mừng trở lại.' : 'Bắt đầu hành trình.'}</h2>

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
                  ĐỊA CHỈ EMAIL
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
                  MẬT KHẨU
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
                  <p role="status" className="text-[13px] text-[var(--ink)]">
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
