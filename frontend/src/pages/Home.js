import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <h1>Find Your Perfect Room &amp; Flatmate</h1>
          <p className="hero-subtitle">
            AI-powered compatibility matching connects tenants and owners based on budget, location, and lifestyle.
          </p>
          <div className="hero-actions">
            <Link to="/listings" className="btn btn-primary btn-lg">Browse Rooms</Link>
            {!user && <Link to="/register" className="btn btn-outline btn-lg">Get Started Free</Link>}
            {user && user.role === 'owner' && (
              <Link to="/owner/listings/new" className="btn btn-outline btn-lg">Post a Room</Link>
            )}
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <h2>How It Works</h2>
          <div className="features-grid">
            <div className="feature-card">
              <span className="feature-icon">🔍</span>
              <h3>Smart Matching</h3>
              <p>Our AI scores every listing against your preferences — budget, location, and move-in date — so the best matches rise to the top.</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">💬</span>
              <h3>Real-Time Chat</h3>
              <p>Once an owner accepts your interest, a private chat opens instantly. No emails back and forth.</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">🔔</span>
              <h3>Instant Notifications</h3>
              <p>Owners get alerted when a highly compatible tenant shows interest. Tenants hear back the moment owners respond.</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon">🏠</span>
              <h3>Verified Listings</h3>
              <p>Owners post detailed listings with photos, room type, furnishing status, and availability dates.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="container">
          {!user ? (
            <>
              <h2>Ready to find your next home?</h2>
              <p>Join thousands of tenants and owners already using Rent Finder.</p>
              <div className="cta-actions">
                <Link to="/register" className="btn btn-primary btn-lg">Register as Tenant</Link>
                <Link to="/register?role=owner" className="btn btn-outline btn-lg">List Your Room</Link>
              </div>
            </>
          ) : user.role === 'tenant' ? (
            <>
              <h2>Welcome back, {user.name}!</h2>
              <p>Check out new listings matched to your preferences.</p>
              <Link to="/listings" className="btn btn-primary btn-lg">Browse Listings</Link>
            </>
          ) : (
            <>
              <h2>Welcome back, {user.name}!</h2>
              <p>Manage your listings and connect with interested tenants.</p>
              <Link to="/owner/listings" className="btn btn-primary btn-lg">My Listings</Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
