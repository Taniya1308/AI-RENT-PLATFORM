import React from 'react';
import { Link } from 'react-router-dom';
import ScoreBadge from './ScoreBadge';

export default function ListingCard({ listing }) {
  const photo = listing.photos && listing.photos.length > 0
    ? (typeof listing.photos[0] === 'string' ? listing.photos[0] : listing.photos[0]?.url)
    : null;

  const photoSrc = photo
    ? (photo.startsWith('http') ? photo : `${process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000'}${photo}`)
    : null;

  return (
    <div className="listing-card">
      <div className="listing-card-image">
        {photoSrc ? (
          <img src={photoSrc} alt={listing.title} loading="lazy" />
        ) : (
          <div className="listing-card-placeholder">🏠</div>
        )}
        {listing.is_filled ? (
          <span className="listing-badge filled">Filled</span>
        ) : null}
      </div>

      <div className="listing-card-body">
        <div className="listing-card-header">
          <h3 className="listing-title">{listing.title}</h3>
          {listing.compatibility_score !== null && listing.compatibility_score !== undefined && (
            <ScoreBadge
              score={listing.compatibility_score}
              explanation={listing.compatibility_explanation}
              computedBy={listing.computed_by}
            />
          )}
        </div>

        <div className="listing-meta">
          <span className="listing-location">📍 {listing.location}, {listing.city}</span>
          <span className="listing-rent">💰 ${listing.rent.toLocaleString()}/mo</span>
        </div>

        <div className="listing-tags">
          <span className="tag">{listing.room_type.replace('_', ' ')}</span>
          <span className="tag">{listing.furnishing}</span>
          <span className="tag">From {new Date(listing.available_from).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>

        <div className="listing-card-footer">
          <span className="listing-owner">by {listing.owner_name}</span>
          <Link to={`/listings/${listing.id}`} className="btn btn-primary btn-sm">View Details</Link>
        </div>
      </div>
    </div>
  );
}
