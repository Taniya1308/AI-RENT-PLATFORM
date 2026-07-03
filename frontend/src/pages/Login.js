import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../utils/api';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) navigate(location.state?.from?.pathname || '/', { replace: true });
  }, [user, navigate, location]);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api.post('/auth/login', form);
      login(data.user, data.token);
      addToast(`Welcome back, ${data.user.name}!`, 'success');
      const from = location.state?.from?.pathname;
      if (from) navigate(from, { replace: true });
      else if (data.user.role === 'admin') navigate('/admin');
      else if (data.user.role === 'owner') navigate('/owner/listings');
      else navigate('/listings');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>🏠 Welcome Back</h1>
          <p>Sign in to your Rent Finder account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Your password"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-hint">
          <p><strong>Demo accounts:</strong></p>
          <p>Admin: admin@rentfinder.com / admin123</p>
        </div>

        <p className="auth-footer">
          Don't have an account? <Link to="/register">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
