import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../utils/api';

export default function Register() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: searchParams.get('role') || 'tenant'
  });
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      addToast('Passwords do not match', 'error');
      return;
    }
    setLoading(true);
    try {
      const data = await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role
      });
      login(data.user, data.token);
      addToast(`Welcome to Rent Finder, ${data.user.name}!`, 'success');
      if (data.user.role === 'tenant') navigate('/tenant/profile');
      else if (data.user.role === 'owner') navigate('/owner/listings');
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
          <h1>🏠 Create Account</h1>
          <p>Join Rent Finder to find your perfect room</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="John Smith"
              required
              autoComplete="name"
            />
          </div>

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
              placeholder="At least 6 characters"
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat your password"
              required
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label>I am a</label>
            <div className="role-selector">
              <label className={`role-option ${form.role === 'tenant' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="tenant"
                  checked={form.role === 'tenant'}
                  onChange={handleChange}
                />
                <span className="role-icon">🔍</span>
                <span>Tenant</span>
                <small>Looking for a room</small>
              </label>
              <label className={`role-option ${form.role === 'owner' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="owner"
                  checked={form.role === 'owner'}
                  onChange={handleChange}
                />
                <span className="role-icon">🏠</span>
                <span>Owner</span>
                <small>Have a room to rent</small>
              </label>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
