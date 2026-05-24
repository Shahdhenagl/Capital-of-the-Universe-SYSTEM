import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, LogIn, Loader2 } from 'lucide-react';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user, login, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('يرجى إدخال البريد الإلكتروني');
      return;
    }
    if (!password.trim()) {
      setError('يرجى إدخال كلمة المرور');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err.message === 'Invalid login credentials') {
        setError('بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.');
      } else if (err.message === 'Email not confirmed') {
        setError('لم يتم تأكيد البريد الإلكتروني بعد.');
      } else {
        setError('حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-circle">
            🏗️
          </div>
          <h1>عاصمة الكون</h1>
          <p>نظام إدارة المصاعد</p>
        </div>

        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              <Mail size={16} />
              {' '}البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="أدخل البريد الإلكتروني"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              <Lock size={16} />
              {' '}كلمة المرور
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="أدخل كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={isSubmitting}
            style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={20} className="spin-icon" />
                جاري تسجيل الدخول...
              </>
            ) : (
              <>
                <LogIn size={20} />
                تسجيل الدخول
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-24">
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>
            © {new Date().getFullYear()} عاصمة الكون - جميع الحقوق محفوظة
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
