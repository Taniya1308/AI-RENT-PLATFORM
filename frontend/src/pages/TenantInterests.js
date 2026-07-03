import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import ScoreBadge from '../components/ScoreBadge';
import api from '../utils/api';

const STATUS_LABELS = {
  pending: { label: '⏳ Pending', cls: 'status-pending' },
  accepted: { label: '✅ Accepted', cls: 'status-accepted' },
  declined: { label: '❌ Declined', cls: 'status-declined' }
};

export default function TenantInterests() {
  const { addToast } = useToast();
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/interests')
      .then(data => setInterests(data.interests))
      .catch(err => addToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [addToast]);

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="container">
        <div className="page-header">
          <h1>My Interests</h1>
          <p>{interests.length} interest request{interests.length !== 1 ? 's' : ''}</p>
        </div>

        {interests.length === 0 ? (
          <div className="empty-state">
            <span>🏠</span>
            <h3>No interests yet</h3>
            <p>Browse listings and send interest requests to get started.</p>
            <Link to="/listings" className="btn btn-primary">Browse Rooms</Link>
          </div>
        ) : (
          <div className="interests-list">
            {interests.map(interest => {
              const statusInfo = STATUS_LABELS[interest.status] || {};
              return (
                <div key={interest.id} className="interest-card">
                  <div className="interest-card-body">
                    <div className="interest-listing-info">
                      <Link to={`/listings/${interest.listing_id}`} className="interest-title">
                        {interest.listing_title}
                      </Link>
                      <span className="interest-meta">📍 {interest.city} · 💰 ${interest.rent?.toLocaleString()}/mo · {interest.room_type?.replace('_', ' ')}</span>
                      <span className="interest-owner">Owner: {interest.owner_name}</span>
                    </div>

                    <div className="interest-side">
                      {interest.compatibility_score !== null && interest.compatibility_score !== undefined && (
                        <ScoreBadge score={interest.compatibility_score} />
                      )}
                      <span className={`status-badge ${statusInfo.cls}`}>{statusInfo.label}</span>
                      <span className="interest-date">
                        {new Date(interest.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {interest.status === 'accepted' && (
                    <div className="interest-card-footer">
                      <Link to="/chat" className="btn btn-primary btn-sm">Open Chat →</Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
