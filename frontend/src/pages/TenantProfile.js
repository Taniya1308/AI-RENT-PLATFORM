import React, { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import api from '../utils/api';

export default function TenantProfile() {
  const { addToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    preferred_location: '', preferred_city: '',
    budget_min: '', budget_max: '', move_in_date: '',
    about_me: '', occupation: ''
  });

  useEffect(() => {
    api.get('/tenant/profile')
      .then(data => {
        setProfile(data.profile);
        const p = data.profile;
        setForm({
          preferred_location: p.preferred_location,
          preferred_city: p.preferred_city,
          budget_min: p.budget_min,
          budget_max: p.budget_max,
          move_in_date: p.move_in_date,
          about_me: p.about_me || '',
          occupation: p.occupation || ''
        });
      })
      .catch(() => setEditing(true)) // No profile yet → show create form
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      let data;
      if (profile) {
        data = await api.put('/tenant/profile', form);
        addToast('Profile updated! Compatibility scores will be refreshed.', 'success');
      } else {
        data = await api.post('/tenant/profile', form);
        addToast('Profile created!', 'success');
      }
      setProfile(data.profile);
      setEditing(false);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="container">
        <div className="page-header">
          <h1>My Tenant Profile</h1>
          <p>Your preferences help us find the best room matches for you.</p>
        </div>

        {profile && !editing ? (
          <div className="profile-view">
            <div className="profile-card">
              <div className="profile-section">
                <h2>{profile.name}</h2>
                <p className="profile-email">{profile.email}</p>
                {profile.occupation && <p className="profile-occupation">💼 {profile.occupation}</p>}
              </div>

              <div className="profile-prefs">
                <div className="pref-item">
                  <span className="pref-label">Preferred Location</span>
                  <span className="pref-value">📍 {profile.preferred_location}, {profile.preferred_city}</span>
                </div>
                <div className="pref-item">
                  <span className="pref-label">Budget Range</span>
                  <span className="pref-value">💰 ${profile.budget_min.toLocaleString()} – ${profile.budget_max.toLocaleString()}/mo</span>
                </div>
                <div className="pref-item">
                  <span className="pref-label">Move-in Date</span>
                  <span className="pref-value">📅 {new Date(profile.move_in_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                {profile.about_me && (
                  <div className="pref-item pref-about">
                    <span className="pref-label">About Me</span>
                    <p className="pref-value">{profile.about_me}</p>
                  </div>
                )}
              </div>

              <button onClick={() => setEditing(true)} className="btn btn-primary">Edit Profile</button>
            </div>
          </div>
        ) : (
          <div className="profile-form-container">
            <form onSubmit={handleSubmit} className="profile-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Preferred Location / Area *</label>
                  <input
                    type="text"
                    name="preferred_location"
                    value={form.preferred_location}
                    onChange={handleChange}
                    placeholder="e.g. Downtown, Midtown"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Preferred City *</label>
                  <input
                    type="text"
                    name="preferred_city"
                    value={form.preferred_city}
                    onChange={handleChange}
                    placeholder="e.g. New York"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Min Budget ($/mo)</label>
                  <input
                    type="number"
                    name="budget_min"
                    value={form.budget_min}
                    onChange={handleChange}
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Max Budget ($/mo) *</label>
                  <input
                    type="number"
                    name="budget_max"
                    value={form.budget_max}
                    onChange={handleChange}
                    placeholder="2000"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Move-in Date *</label>
                <input
                  type="date"
                  name="move_in_date"
                  value={form.move_in_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Occupation</label>
                <input
                  type="text"
                  name="occupation"
                  value={form.occupation}
                  onChange={handleChange}
                  placeholder="e.g. Software Engineer, Student"
                />
              </div>

              <div className="form-group">
                <label>About Me</label>
                <textarea
                  name="about_me"
                  value={form.about_me}
                  onChange={handleChange}
                  placeholder="Tell owners a bit about yourself..."
                  rows={4}
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : profile ? 'Update Profile' : 'Create Profile'}
                </button>
                {profile && (
                  <button type="button" onClick={() => setEditing(false)} className="btn btn-outline">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
