import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import api from '../utils/api';

const API_BASE = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';

export default function ListingForm() {
  const { id } = useParams(); // Present when editing
  const isEdit = Boolean(id);
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '', description: '', location: '', city: '',
    rent: '', available_from: '', room_type: 'single', furnishing: 'furnished'
  });
  const [photos, setPhotos] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (isEdit) {
      api.get(`/listings/${id}`)
        .then(data => {
          const l = data.listing;
          setForm({
            title: l.title,
            description: l.description || '',
            location: l.location,
            city: l.city,
            rent: l.rent,
            available_from: l.available_from,
            room_type: l.room_type,
            furnishing: l.furnishing
          });
          setExistingPhotos(l.photos || []);
        })
        .catch(err => { addToast(err.message, 'error'); navigate('/owner/listings'); })
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, addToast, navigate]);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handlePhotoChange(e) {
    setPhotos(Array.from(e.target.files));
  }

  async function handleDeletePhoto(photoId) {
    if (!window.confirm('Remove this photo?')) return;
    try {
      await api.delete(`/listings/${id}/photos/${photoId}`);
      setExistingPhotos(prev => prev.filter(p => p.id !== photoId));
      addToast('Photo removed', 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => formData.append(k, v));
    photos.forEach(p => formData.append('photos', p));

    try {
      if (isEdit) {
        await api.put(`/listings/${id}`, formData);
        addToast('Listing updated!', 'success');
      } else {
        await api.post('/listings', formData);
        addToast('Listing created!', 'success');
      }
      navigate('/owner/listings');
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
          <h1>{isEdit ? 'Edit Listing' : 'Post a New Room'}</h1>
        </div>

        <form onSubmit={handleSubmit} className="listing-form">
          <div className="form-section">
            <h2>Basic Details</h2>
            <div className="form-group">
              <label>Listing Title *</label>
              <input type="text" name="title" value={form.title} onChange={handleChange}
                placeholder="e.g. Cozy double room near city centre" required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea name="description" value={form.description} onChange={handleChange}
                placeholder="Describe the room, amenities, house rules..." rows={5} />
            </div>
          </div>

          <div className="form-section">
            <h2>Location</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Street / Area *</label>
                <input type="text" name="location" value={form.location} onChange={handleChange}
                  placeholder="e.g. 42 Baker Street, Midtown" required />
              </div>
              <div className="form-group">
                <label>City *</label>
                <input type="text" name="city" value={form.city} onChange={handleChange}
                  placeholder="e.g. London" required />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>Room Details</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Monthly Rent ($) *</label>
                <input type="number" name="rent" value={form.rent} onChange={handleChange}
                  placeholder="1200" min="1" required />
              </div>
              <div className="form-group">
                <label>Available From *</label>
                <input type="date" name="available_from" value={form.available_from} onChange={handleChange} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Room Type *</label>
                <select name="room_type" value={form.room_type} onChange={handleChange} required>
                  <option value="single">Single</option>
                  <option value="double">Double</option>
                  <option value="shared">Shared</option>
                  <option value="studio">Studio</option>
                  <option value="entire_flat">Entire Flat</option>
                </select>
              </div>
              <div className="form-group">
                <label>Furnishing *</label>
                <select name="furnishing" value={form.furnishing} onChange={handleChange} required>
                  <option value="furnished">Furnished</option>
                  <option value="semi-furnished">Semi-furnished</option>
                  <option value="unfurnished">Unfurnished</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>Photos</h2>
            {existingPhotos.length > 0 && (
              <div className="existing-photos">
                {existingPhotos.map(photo => {
                  const src = photo.url?.startsWith('http') ? photo.url : `${API_BASE}${photo.url}`;
                  return (
                    <div key={photo.id} className="existing-photo">
                      <img src={src} alt="Listing" />
                      <button type="button" onClick={() => handleDeletePhoto(photo.id)} className="photo-remove" aria-label="Remove photo">✕</button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="form-group">
              <label>Upload Photos (max 10, 5MB each)</label>
              <input type="file" accept="image/*" multiple onChange={handlePhotoChange} className="file-input" />
              {photos.length > 0 && <p className="file-count">{photos.length} file(s) selected</p>}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Update Listing' : 'Post Listing'}
            </button>
            <button type="button" onClick={() => navigate('/owner/listings')} className="btn btn-outline">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
