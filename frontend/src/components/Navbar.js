import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link';

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          🏠 <span>Rent Finder</span>
        </Link>

        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          {menuOpen ? '✕' : '☰'}
        </button>

        <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          <Link to="/listings" className={isActive('/listings')} onClick={() => setMenuOpen(false)}>
            Browse Rooms
          </Link>

          {!user && (
            <>
              <Link to="/login" className={isActive('/login')} onClick={() => setMenuOpen(false)}>Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm" onClick={() => setMenuOpen(false)}>Sign Up</Link>
            </>
          )}

          {user && user.role === 'tenant' && (
            <>
              <Link to="/tenant/profile" className={isActive('/tenant/profile')} onClick={() => setMenuOpen(false)}>My Profile</Link>
              <Link to="/tenant/interests" className={isActive('/tenant/interests')} onClick={() => setMenuOpen(false)}>My Interests</Link>
              <Link to="/chat" className={isActive('/chat')} onClick={() => setMenuOpen(false)}>Chat</Link>
            </>
          )}

          {user && user.role === 'owner' && (
            <>
              <Link to="/owner/listings" className={isActive('/owner/listings')} onClick={() => setMenuOpen(false)}>My Listings</Link>
              <Link to="/owner/interests" className={isActive('/owner/interests')} onClick={() => setMenuOpen(false)}>Interests</Link>
              <Link to="/chat" className={isActive('/chat')} onClick={() => setMenuOpen(false)}>Chat</Link>
            </>
          )}

          {user && user.role === 'admin' && (
            <Link to="/admin" className={isActive('/admin')} onClick={() => setMenuOpen(false)}>Admin</Link>
          )}

          {user && (
            <div className="navbar-user">
              <span className={`role-badge role-${user.role}`}>{user.role}</span>
              <span className="user-name">{user.name}</span>
              <button onClick={handleLogout} className="btn btn-outline btn-sm">Logout</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
