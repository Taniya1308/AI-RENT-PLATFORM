import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ListingCard from '../components/ListingCard';
import api from '../utils/api';

export default function Listings() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [listings, setListings] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [filters, setFilters] = useState({
    city: '', min_budget: '', max_budget: '', room_type: '', furnishing: ''
  });

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (filters.city) params.set('city', filters.city);
      if (filters.min_budget) params.set('min_budget', filters.min_budget);
      if (filters.max_budget) params.set('max_budget', filters.max_budget);
      if (filters.room_type) params.set('room_type', filters.room_type);
      if (filters.furnishing) params.set('furnishing', filters.furnishing);

      const data = await api.get(`/listings?${params}`);
      setListings(data.listings);
      setTotal(data.total);

      // If tenant with profile, batch-compute missing scores
      if (user && user.role === 'tenant') {
        const missing = data.listings
          .filter(l => l.compatibility_score === null || l.compatibility_score === undefined)
          .map(l => l.id);
        if (missing.length > 0) {
          setComputing(true);
          try {
            const scoreData = await api.post('/compatibility/batch', { listing_ids: missing });
            setListings(prev => prev.map(l => {
              const found = scoreData.scores.find(s => s.listingId === l.id);
              if (found) return { ...l, compatibility_score: found.score, compatibility_explanation: found.explanation, computed_by: found.computed_by };
              return l;
            }));
          } catch {
            // Silent — scores just won't show if no profile yet
          } finally {
            setComputing(false);
          }
        }
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, page, user, addToast]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  function handleFilterChange(e) {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(1);
  }

  function clearFilters() {
    setFilters({ city: '', min_budget: '', max_budget: '', room_type: '', furnishing: '' });
    setPage(1);
  }

  const totalPages = Math.ceil(total / 12);

  return (
    <div className="listings-page">
      <div className="container">
        <div className="page-header">
          <h1>Browse Rooms</h1>
          <p>{total} listing{total !== 1 ? 's' : ''} available
            {user && user.role === 'tenant' && ' — sorted by your compatibility score'}
          </p>
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <div className="filter-group">
            <input
              type="text"
              name="city"
              value={filters.city}
              onChange={handleFilterChange}
              placeholder="🔍 Search by city..."
              className="filter-input"
            />
          </div>
          <div className="filter-group filter-row">
            <input
              type="number"
              name="min_budget"
              value={filters.min_budget}
              onChange={handleFilterChange}
              placeholder="Min $"
              className="filter-input filter-budget"
            />
            <span className="filter-sep">–</span>
            <input
              type="number"
              name="max_budget"
              value={filters.max_budget}
              onChange={handleFilterChange}
              placeholder="Max $"
              className="filter-input filter-budget"
            />
          </div>
          <div className="filter-group">
            <select name="room_type" value={filters.room_type} onChange={handleFilterChange} className="filter-select">
              <option value="">All Room Types</option>
              <option value="single">Single</option>
              <option value="double">Double</option>
              <option value="shared">Shared</option>
              <option value="studio">Studio</option>
              <option value="entire_flat">Entire Flat</option>
            </select>
          </div>
          <div className="filter-group">
            <select name="furnishing" value={filters.furnishing} onChange={handleFilterChange} className="filter-select">
              <option value="">All Furnishing</option>
              <option value="furnished">Furnished</option>
              <option value="semi-furnished">Semi-furnished</option>
              <option value="unfurnished">Unfurnished</option>
            </select>
          </div>
          <button onClick={clearFilters} className="btn btn-outline btn-sm">Clear</button>
        </div>

        {computing && (
          <div className="computing-banner">
            ✦ Computing AI compatibility scores for you...
          </div>
        )}

        {user && user.role === 'tenant' && (
          <div className="info-banner">
            💡 Listings are ranked by your compatibility score. <a href="/tenant/profile">Update your profile</a> to refine matches.
          </div>
        )}

        {/* Listings grid */}
        {loading ? (
          <div className="listings-grid loading-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="listing-card skeleton"></div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="empty-state">
            <span>🏘</span>
            <h3>No listings found</h3>
            <p>Try adjusting your filters.</p>
            <button onClick={clearFilters} className="btn btn-outline">Clear Filters</button>
          </div>
        ) : (
          <div className="listings-grid">
            {listings.map(listing => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-outline btn-sm"
            >
              ← Prev
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn btn-outline btn-sm"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
