import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import ScoreBadge from '../components/ScoreBadge';
import api from '../utils/api';

export default function OwnerInterests() {
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const filterListing = searchParams.get('listing');
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  function fetchInterests() {
    api.get('/interests')
      .then(data => {
        let list = data.interests;
        if (filterListing) list = list.filter(i => String(i.listing_id) === filterListing);
        setInterests(list);
      })
      .catch(err => addToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchInterests(); }, [filterListing]);

  async function handleAction(id, action) {
    setProcessing(id);
    try {
      await api.patch(`/interests/${id}/${action}`);
      addToast(`Interest ${action === 'accept' ? 'accepted' : 'declined'}`, 'success');
      fetchInterests();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setProcessing(null);
    }
  }

  const pending = interests.filter(i => i.status === 'pending');
  const others = interests.filter(i => i.status !== 'pending');

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  function renderInterest(interest) {
    return (
      <div key={interest.id} className={`interest-card interest-${interest.status}`}>
        <div className="interest-card-body">
          <div className="interest-tenant-info">
            <div className="interest-tenant-header">
              <strong>{interest.tenant_name}</strong>
              {interest.compatibility_score !== null && interest.compatibility_score !== undefined && (
                <ScoreBadge score={interest.compatibility_score} explanation={interest.compatibility_explanation} />
              )}
            </div>
            <p className="interest-tenant-email">{interest.tenant_email}</p>
            {interest.preferred_location && (
              <p className="interest-prefs">
                Prefers: {interest.preferred_location} · Budget: ${interest.budget_min}–${interest.budget_max}/mo
              </p>
            )}
            {interest.compatibility_explanation && (
              <p className="interest-explanation">"{interest.compatibility_explanation}"</p>
            )}
            <p className="interest-listing-name">
              For: <Link to={`/listings/${interest.listing_id}`}>{interest.listing_title}</Link>
            </p>
            <p className="interest-date">{new Date(interest.created_at).toLocaleDateString()}</p>
          </div>

          <div className="interest-actions-col">
            {interest.status === 'pending' && (
              <>
                <button
                  onClick={() => handleAction(interest.id, 'accept')}
                  disabled={processing === interest.id}
                  className="btn btn-success btn-sm"
                >
                  {processing === interest.id ? '...' : '✓ Accept'}
                </button>
                <button
                  onClick={() => handleAction(interest.id, 'decline')}
                  disabled={processing === interest.id}
                  className="btn btn-danger btn-sm"
                >
                  {processing === interest.id ? '...' : '✕ Decline'}
                </button>
              </>
            )}
            {interest.status === 'accepted' && (
              <span className="status-badge status-accepted">✅ Accepted</span>
            )}
            {interest.status === 'declined' && (
              <span className="status-badge status-declined">❌ Declined</span>
            )}
            {interest.status === 'accepted' && (
              <Link to="/chat" className="btn btn-primary btn-sm">Chat</Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="container">
        <div className="page-header">
          <h1>Interest Requests</h1>
          <p>{interests.length} total · {pending.length} pending</p>
        </div>

        {interests.length === 0 ? (
          <div className="empty-state">
            <span>📬</span>
            <h3>No interest requests yet</h3>
            <p>Tenants will appear here when they express interest in your listings.</p>
            <Link to="/owner/listings" className="btn btn-outline">View My Listings</Link>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <div className="interests-section">
                <h2 className="section-title">Pending ({pending.length})</h2>
                <div className="interests-list">{pending.map(renderInterest)}</div>
              </div>
            )}
            {others.length > 0 && (
              <div className="interests-section">
                <h2 className="section-title">Past Requests ({others.length})</h2>
                <div className="interests-list">{others.map(renderInterest)}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
