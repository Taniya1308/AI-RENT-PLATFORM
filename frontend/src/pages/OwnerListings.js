import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import api from '../utils/api';

const API_BASE = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';

export default function OwnerListings() {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  function fetchListings() {
    api.get('/listings/my')
      .then(data => setListings(data.listings))
      .catch(err => addToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchListings(); }, []);

  async function handleMarkFilled(id) {
    if (!window.confirm('Mark this listing as filled? It will be hidden from search results.')) return;
    try {
      await api.patch(`/listings/${id}/mark-filled`);
      addToast('Listing marked as filled', 'success');
      fetchListings();
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this listing? This cannot be undone.')) return;
    try {
      await api.delete(`/listings/${id}`);
      addToast('Listing deleted', 'success');
      fetchListings();
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>My Listings</h1>
            <p>{listings.length} listing{listings.length !== 1 ? 's' : ''}</p>
          </div>
          <Link to="/owner/listings/new" className="btn btn-primary">+ Post New Room</Link>
        </div>

        {listings.length === 0 ? (
          <div className="empty-state">
            <span>🏠</span>
            <h3>No listings yet</h3>
            <p>Post your first room to start receiving interest from tenants.</p>
            <Link to="/owner/listings/new" className="btn btn-primary">Post a Room</Link>
          </div>
        ) : (
          <div className="owner-listings-grid">
            {listings.map(listing => {
              const photo = listing.photos?.[0];
              const photoSrc = photo ? (photo.startsWith('http') ? photo : `${API_BASE}${photo}`) : null;
              return (
                <div key={listing.id} className={`owner-listing-card ${listing.is_filled ? 'is-filled' : ''}`}>
                  <div className="owner-listing-image">
                    {photoSrc ? <img src={photoSrc} alt={listing.title} /> : <div className="listing-placeholder">🏠</div>}
                    {listing.is_filled && <span className="listing-badge filled">Filled</span>}
                  </div>
                  <div className="owner-listing-info">
                    <h3>
                      <Link to={`/listings/${listing.id}`}>{listing.title}</Link>
                    </h3>
                    <p>📍 {listing.location}, {listing.city}</p>
                    <p>💰 ${listing.rent.toLocaleString()}/mo · {listing.room_type.replace('_', ' ')} · {listing.furnishing}</p>
                    <div className="listing-stats">
                      <span className={`stat ${listing.pending_interests > 0 ? 'stat-highlight' : ''}`}>
                        📬 {listing.pending_interests} pending interest{listing.pending_interests !== 1 ? 's' : ''}
                      </span>
                      <span className="stat">👥 {listing.total_interests} total</span>
                    </div>
                  </div>
                  <div className="owner-listing-actions">
                    <Link to={`/owner/listings/${listing.id}/edit`} className="btn btn-outline btn-sm">Edit</Link>
                    <Link to={`/owner/interests?listing=${listing.id}`} className="btn btn-outline btn-sm">Interests</Link>
                    {!listing.is_filled && (
                      <button onClick={() => handleMarkFilled(listing.id)} className="btn btn-secondary btn-sm">Mark Filled</button>
                    )}
                    <button onClick={() => handleDelete(listing.id)} className="btn btn-danger btn-sm">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
