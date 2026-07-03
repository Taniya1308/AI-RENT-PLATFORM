import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ScoreBadge from '../components/ScoreBadge';
import api from '../utils/api';

const API_BASE = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';

export default function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [interestMsg, setInterestMsg] = useState('');
  const [sendingInterest, setSendingInterest] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    api.get(`/listings/${id}`)
      .then(data => setListing(data.listing))
      .catch(err => { addToast(err.message, 'error'); navigate('/listings'); })
      .finally(() => setLoading(false));
  }, [id, addToast, navigate]);

  async function handleSendInterest() {
    setSendingInterest(true);
    try {
      await api.post('/interests', { listing_id: parseInt(id), message: interestMsg });
      addToast('Interest request sent!', 'success');
      // Refresh listing to show updated status
      const data = await api.get(`/listings/${id}`);
      setListing(data.listing);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSendingInterest(false);
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (!listing) return null;

  const photos = listing.photos || [];
  const currentPhoto = photos[photoIndex];
  const photoSrc = currentPhoto
    ? (currentPhoto.url?.startsWith('http') ? currentPhoto.url : `${API_BASE}${currentPhoto.url}`)
    : null;

  const canSendInterest = user && user.role === 'tenant' && !listing.interest_request && !listing.is_filled;
  const interestStatus = listing.interest_request?.status;

  return (
    <div className="listing-detail">
      <div className="container">
        <Link to="/listings" className="back-link">← Back to listings</Link>

        <div className="listing-detail-grid">
          {/* Left: Photos + details */}
          <div className="listing-detail-main">
            {/* Photo gallery */}
            <div className="photo-gallery">
              {photoSrc ? (
                <img src={photoSrc} alt={listing.title} className="gallery-main-image" />
              ) : (
                <div className="gallery-placeholder">🏠</div>
              )}
              {photos.length > 1 && (
                <div className="gallery-thumbs">
                  {photos.map((p, i) => {
                    const src = p.url?.startsWith('http') ? p.url : `${API_BASE}${p.url}`;
                    return (
                      <button key={i} onClick={() => setPhotoIndex(i)} className={`gallery-thumb ${i === photoIndex ? 'active' : ''}`}>
                        <img src={src} alt={`Photo ${i + 1}`} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Listing info */}
            <div className="listing-detail-info">
              <div className="listing-detail-header">
                <div>
                  <h1>{listing.title}</h1>
                  <p className="listing-location-detail">📍 {listing.location}, {listing.city}</p>
                </div>
                {listing.is_filled && <span className="badge badge-filled">Filled</span>}
              </div>

              <div className="listing-specs">
                <div className="spec-item">
                  <span className="spec-label">Monthly Rent</span>
                  <span className="spec-value rent">${listing.rent.toLocaleString()}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Room Type</span>
                  <span className="spec-value">{listing.room_type.replace('_', ' ')}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Furnishing</span>
                  <span className="spec-value">{listing.furnishing}</span>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Available From</span>
                  <span className="spec-value">
                    {new Date(listing.available_from).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              </div>

              {listing.description && (
                <div className="listing-description">
                  <h3>About this room</h3>
                  <p>{listing.description}</p>
                </div>
              )}

              <div className="listing-owner-info">
                <span>Listed by <strong>{listing.owner_name}</strong></span>
              </div>
            </div>
          </div>

          {/* Right: Score + action */}
          <div className="listing-detail-sidebar">
            {/* Compatibility score */}
            {listing.compatibility_score !== null && listing.compatibility_score !== undefined && (
              <div className="score-card">
                <h3>Your Compatibility</h3>
                <ScoreBadge
                  score={listing.compatibility_score}
                  explanation={listing.compatibility_explanation}
                  computedBy={listing.computed_by}
                  size="lg"
                />
                {listing.compatibility_explanation && (
                  <p className="score-explanation">{listing.compatibility_explanation}</p>
                )}
              </div>
            )}

            {/* Interest action */}
            <div className="action-card">
              <h3>Interested?</h3>
              {!user && (
                <p>
                  <Link to="/login" className="btn btn-primary btn-full">Sign in to express interest</Link>
                </p>
              )}

              {user && user.role === 'owner' && user.id === listing.owner_id && (
                <div className="owner-actions">
                  <Link to={`/owner/listings/${listing.id}/edit`} className="btn btn-outline btn-full">Edit Listing</Link>
                </div>
              )}

              {user && user.role === 'tenant' && listing.is_filled && (
                <p className="status-msg filled">This room has been filled.</p>
              )}

              {canSendInterest && (
                <div className="interest-form">
                  <textarea
                    value={interestMsg}
                    onChange={e => setInterestMsg(e.target.value)}
                    placeholder="Optional message to the owner..."
                    rows={3}
                    className="interest-textarea"
                  />
                  <button
                    onClick={handleSendInterest}
                    disabled={sendingInterest}
                    className="btn btn-primary btn-full"
                  >
                    {sendingInterest ? 'Sending...' : 'Send Interest Request'}
                  </button>
                </div>
              )}

              {interestStatus === 'pending' && (
                <div className="status-msg pending">⏳ Interest request sent — waiting for owner's response.</div>
              )}
              {interestStatus === 'accepted' && (
                <div>
                  <div className="status-msg accepted">✅ Interest accepted! You can now chat with the owner.</div>
                  <Link to="/chat" className="btn btn-primary btn-full" style={{ marginTop: '8px' }}>Open Chat</Link>
                </div>
              )}
              {interestStatus === 'declined' && (
                <div className="status-msg declined">❌ Your interest was declined.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
