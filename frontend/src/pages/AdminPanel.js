import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import api from '../utils/api';

export default function AdminPanel() {
  const { addToast } = useToast();
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [interests, setInterests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'listings') loadListings();
    if (tab === 'interests') loadInterests();
    if (tab === 'notifications') loadNotifications();
  }, [tab, userSearch, userRole]);

  async function loadStats() {
    try {
      const data = await api.get('/admin/stats');
      setStats(data.stats);
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (userSearch) params.set('search', userSearch);
      if (userRole) params.set('role', userRole);
      const data = await api.get(`/admin/users?${params}`);
      setUsers(data.users);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadListings() {
    setLoading(true);
    try {
      const data = await api.get('/admin/listings?limit=100');
      setListings(data.listings);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadInterests() {
    setLoading(true);
    try {
      const data = await api.get('/admin/interests');
      setInterests(data.interests);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await api.get('/admin/notifications');
      setNotifications(data.notifications);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function toggleUser(id) {
    try {
      await api.patch(`/admin/users/${id}/toggle-active`);
      addToast('User status updated', 'success');
      loadUsers();
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function deleteListing(id) {
    if (!window.confirm('Remove this listing?')) return;
    try {
      await api.delete(`/admin/listings/${id}`);
      addToast('Listing removed', 'success');
      loadListings();
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  const TABS = ['stats', 'users', 'listings', 'interests', 'notifications'];

  return (
    <div className="page-container">
      <div className="container">
        <div className="page-header">
          <h1>Admin Panel</h1>
        </div>

        {/* Tab nav */}
        <div className="admin-tabs">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`admin-tab ${tab === t ? 'active' : ''}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Stats */}
        {tab === 'stats' && stats && (
          <div className="stats-grid">
            <div className="stat-card"><span className="stat-num">{stats.users}</span><span>Total Users</span></div>
            <div className="stat-card"><span className="stat-num">{stats.tenants}</span><span>Tenants</span></div>
            <div className="stat-card"><span className="stat-num">{stats.owners}</span><span>Owners</span></div>
            <div className="stat-card"><span className="stat-num">{stats.active_listings}</span><span>Active Listings</span></div>
            <div className="stat-card"><span className="stat-num">{stats.filled_listings}</span><span>Filled Listings</span></div>
            <div className="stat-card"><span className="stat-num">{stats.interest_requests}</span><span>Interest Requests</span></div>
            <div className="stat-card"><span className="stat-num">{stats.accepted_interests}</span><span>Accepted</span></div>
            <div className="stat-card"><span className="stat-num">{stats.conversations}</span><span>Conversations</span></div>
            <div className="stat-card"><span className="stat-num">{stats.messages}</span><span>Messages Sent</span></div>
            <div className="stat-card"><span className="stat-num">{stats.llm_scores}</span><span>AI Scores</span></div>
            <div className="stat-card"><span className="stat-num">{stats.rule_based_scores}</span><span>Rule-based Scores</span></div>
            <div className="stat-card"><span className="stat-num">{stats.notifications_sent}</span><span>Emails Sent</span></div>
          </div>
        )}

        {/* Users */}
        {tab === 'users' && (
          <div>
            <div className="admin-filters">
              <input
                type="text" value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="filter-input"
              />
              <select value={userRole} onChange={e => setUserRole(e.target.value)} className="filter-select">
                <option value="">All Roles</option>
                <option value="tenant">Tenants</option>
                <option value="owner">Owners</option>
                <option value="admin">Admins</option>
              </select>
            </div>
            {loading ? <div className="loading-screen"><div className="spinner"></div></div> : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th>Joined</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className={!u.is_active ? 'row-inactive' : ''}>
                        <td>{u.id}</td>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
                        <td>{u.is_active ? '✓' : '✗'}</td>
                        <td>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td>
                          {u.role !== 'admin' && (
                            <button onClick={() => toggleUser(u.id)} className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}>
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Listings */}
        {tab === 'listings' && (
          <div>
            {loading ? <div className="loading-screen"><div className="spinner"></div></div> : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>ID</th><th>Title</th><th>Owner</th><th>City</th><th>Rent</th><th>Filled</th><th>Interests</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {listings.map(l => (
                      <tr key={l.id}>
                        <td>{l.id}</td>
                        <td><Link to={`/listings/${l.id}`}>{l.title}</Link></td>
                        <td>{l.owner_name}</td>
                        <td>{l.city}</td>
                        <td>${l.rent}</td>
                        <td>{l.is_filled ? '✓' : '–'}</td>
                        <td>{l.interest_count}</td>
                        <td>
                          <button onClick={() => deleteListing(l.id)} className="btn btn-danger btn-sm">Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Interests */}
        {tab === 'interests' && (
          <div>
            {loading ? <div className="loading-screen"><div className="spinner"></div></div> : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>ID</th><th>Tenant</th><th>Owner</th><th>Listing</th><th>Score</th><th>Status</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {interests.map(i => (
                      <tr key={i.id}>
                        <td>{i.id}</td>
                        <td>{i.tenant_name}</td>
                        <td>{i.owner_name}</td>
                        <td><Link to={`/listings/${i.listing_id}`}>{i.listing_title}</Link></td>
                        <td>
                          {i.compatibility_score !== null && i.compatibility_score !== undefined
                            ? <strong style={{ color: i.compatibility_score >= 80 ? '#16a34a' : i.compatibility_score >= 60 ? '#ca8a04' : '#dc2626' }}>
                                {i.compatibility_score}
                              </strong>
                            : '–'}
                        </td>
                        <td><span className={`status-badge status-${i.status}`}>{i.status}</span></td>
                        <td>{new Date(i.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Notifications */}
        {tab === 'notifications' && (
          <div>
            {loading ? <div className="loading-screen"><div className="spinner"></div></div> : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>ID</th><th>User</th><th>Type</th><th>Subject</th><th>Sent</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {notifications.map(n => (
                      <tr key={n.id}>
                        <td>{n.id}</td>
                        <td>{n.user_name || '–'}</td>
                        <td><code>{n.type}</code></td>
                        <td>{n.subject}</td>
                        <td>{n.sent ? '✅' : n.error ? `❌ ${n.error.slice(0, 40)}` : '–'}</td>
                        <td>{new Date(n.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
