import React from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LogOut } from 'lucide-react';
import { authApi } from '../api';
import { useStore } from '../context/StoreContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import TextField from '../components/TextField.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

// Only same-site paths are accepted, so a crafted link cannot redirect off the store.
const getSafeReturnPath = (value) =>
  value && /^\/(?![/\\])/.test(value) && !value.startsWith('/auth') ? value : null;

function PasswordField({ id, label, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      id={id}
      label={label}
      type={visible ? 'text' : 'password'}
      action={
        <button
          type="button"
          className="field-action"
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      }
      {...props}
    />
  );
}

export default function Auth() {
  const [searchParams] = useSearchParams();
  const returnTo = getSafeReturnPath(searchParams.get('returnTo'));
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
  const { account, login, loginMockAdmin, register, logout } = useStore();
  const { notify } = useToast();
  const navigate = useNavigate();
  usePageTitle(account ? 'Tài khoản' : mode === 'signin' ? 'Đăng nhập' : 'Đăng ký');

  useEffect(() => {
    if (otpCooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setOtpCooldown((remaining) => remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [otpCooldown]);

  const finishAuth = (user) => {
    notify({ message: `Xin chào, ${user.fullName}!` });
    if (user.role === 'ADMIN') navigate('/admin');
    else navigate(returnTo || '/');
  };

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
        finishAuth(await login(email, password));
      } else if (!otpSent) {
        const result = await authApi.requestRegistrationOtp({ fullName, email, phone, password });
        setOtpSent(true);
        setOtpCooldown(result.resendAfter || 60);
        setNotice(result.message || 'Mã xác minh đã được gửi tới email của bạn.');
      } else {
        finishAuth(await register({ email, code: verificationCode }));
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

  const handleMockAdminLogin = async () => {
    setError('');
    setNotice('');
    try {
      setLoading(true);
      await loginMockAdmin(email, password);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Không thể đăng nhập Admin thử nghiệm.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setNotice('');
    setOtpSent(false);
    setOtpCooldown(0);
    setVerificationCode('');
  };

  const handleLogout = async () => {
    await logout();
    notify({ message: 'Bạn đã đăng xuất.' });
  };

  const submitLabel =
    mode === 'signin' ? 'ĐĂNG NHẬP' : otpSent ? 'XÁC MINH & TẠO TÀI KHOẢN' : 'GỬI MÃ XÁC MINH';

  return (
    <div className="auth-layout">
      <aside className="auth-art">
        <span className="auth-brand" aria-hidden="true">
          HAVIE<span>.</span>
        </span>
        <div>
          <span className="eyebrow">CHÀO MỪNG BẠN ĐẾN VỚI HAVIE</span>
          <p className="auth-slogan">
            CHƠI
            <br />
            VƯỢT
            <br />
            GIỚI HẠN<span>.</span>
          </p>
          <p>Đồng hành cùng bạn trên từng trận đấu và hành trình cầu lông.</p>
        </div>
      </aside>
      <section className="auth-panel">
        <div className="auth-box">
          {account ? (
            <>
              <span className="eyebrow">TÀI KHOẢN CỦA BẠN</span>
              <h1>Xin chào, {account.fullName}.</h1>
              <dl className="account-details">
                <div>
                  <dt>Email</dt>
                  <dd>{account.email}</dd>
                </div>
                <div>
                  <dt>Số điện thoại</dt>
                  <dd>{account.phone || 'Chưa cập nhật'}</dd>
                </div>
              </dl>

              <div className="auth-actions">
                {account.role === 'ADMIN' ? (
                  <Link to="/admin" className="btn btn-primary full">
                    TRANG QUẢN TRỊ <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                ) : (
                  <Link to="/account/orders" className="btn btn-primary full">
                    ĐƠN HÀNG CỦA TÔI <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                )}
                <Link to="/products" className="btn btn-outline full">
                  TIẾP TỤC MUA SẮM
                </Link>
                <button type="button" className="logout-link" onClick={handleLogout}>
                  <LogOut size={16} aria-hidden="true" /> Đăng xuất
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="eyebrow">TÀI KHOẢN HAVIE</span>
              <h1>{mode === 'signin' ? 'Chào mừng trở lại.' : 'Bắt đầu hành trình.'}</h1>

              <div className="auth-tabs" role="group" aria-label="Chọn đăng nhập hoặc đăng ký">
                <button
                  type="button"
                  className={mode === 'signin' ? 'active' : ''}
                  aria-pressed={mode === 'signin'}
                  onClick={() => switchMode('signin')}
                >
                  ĐĂNG NHẬP
                </button>
                <button
                  type="button"
                  className={mode === 'signup' ? 'active' : ''}
                  aria-pressed={mode === 'signup'}
                  onClick={() => switchMode('signup')}
                >
                  ĐĂNG KÝ
                </button>
              </div>

              <form onSubmit={handleSubmit} className="auth-form">
                {mode === 'signup' && (
                  <>
                    <TextField
                      id="auth-name"
                      label="Họ và tên"
                      required
                      autoComplete="name"
                      value={fullName}
                      disabled={otpSent}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                    <TextField
                      id="auth-phone"
                      label="Số điện thoại (không bắt buộc)"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      disabled={otpSent}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0901234567"
                    />
                  </>
                )}
                <TextField
                  id="auth-email"
                  label="Địa chỉ email"
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  disabled={mode === 'signup' && otpSent}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ten@email.com"
                />
                <PasswordField
                  id="auth-password"
                  label="Mật khẩu"
                  required
                  minLength={6}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  hint={mode === 'signup' ? 'Tối thiểu 6 ký tự.' : undefined}
                  value={password}
                  disabled={mode === 'signup' && otpSent}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {mode === 'signup' && (
                  <PasswordField
                    id="auth-confirm"
                    label="Xác nhận mật khẩu"
                    required
                    autoComplete="new-password"
                    value={confirm}
                    disabled={otpSent}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                )}
                {mode === 'signup' && otpSent && (
                  <>
                    <TextField
                      id="auth-otp"
                      label="Mã xác minh email"
                      required
                      autoFocus
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      hint={`Mã gồm 6 chữ số, đã gửi tới ${email}, có hiệu lực 10 phút.`}
                      value={verificationCode}
                      onChange={(e) =>
                        setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                    />
                    <div className="otp-actions">
                      <button
                        type="button"
                        className="btn-mini"
                        disabled={loading || otpCooldown > 0}
                        onClick={handleResendOtp}
                      >
                        {otpCooldown > 0 ? `Gửi lại mã sau ${otpCooldown}s` : 'Gửi lại mã'}
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
                        Đổi thông tin đăng ký
                      </button>
                    </div>
                  </>
                )}
                {notice && (
                  <p className="form-notice" role="status">
                    {notice}
                  </p>
                )}
                {error && (
                  <p className="inline-alert" role="alert">
                    {error}
                  </p>
                )}
                <button className="btn btn-primary full" type="submit" disabled={loading}>
                  {loading ? 'ĐANG XỬ LÝ...' : submitLabel}
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </form>
              {import.meta.env.DEV && mode === 'signin' && !otpSent && (
                <div className="mt-4">
                  <button
                    type="button"
                    className="btn btn-outline full"
                    disabled={loading}
                    onClick={handleMockAdminLogin}
                  >
                    {loading ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP ADMIN THỬ NGHIỆM'}
                  </button>
                  <p className="mt-2 text-center text-xs text-[var(--muted)]">
                    Dùng email và mật khẩu MOCK_ADMIN đã cấu hình ở backend/.env.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
