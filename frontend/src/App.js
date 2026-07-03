import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Listings from './pages/Listings';
import ListingDetail from './pages/ListingDetail';
import TenantProfile from './pages/TenantProfile';
import TenantInterests from './pages/TenantInterests';
import OwnerListings from './pages/OwnerListings';
import ListingForm from './pages/ListingForm';
import OwnerInterests from './pages/OwnerInterests';
import Chat from './pages/Chat';
import AdminPanel from './pages/AdminPanel';

import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <div className="app">
            <Navbar />
            <main className="main-content">
              <Routes>
                {/* Public */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/listings" element={<Listings />} />
                <Route path="/listings/:id" element={<ListingDetail />} />

                {/* Tenant */}
                <Route path="/tenant/profile" element={
                  <ProtectedRoute roles={['tenant']}>
                    <TenantProfile />
                  </ProtectedRoute>
                } />
                <Route path="/tenant/interests" element={
                  <ProtectedRoute roles={['tenant']}>
                    <TenantInterests />
                  </ProtectedRoute>
                } />

                {/* Owner */}
                <Route path="/owner/listings" element={
                  <ProtectedRoute roles={['owner']}>
                    <OwnerListings />
                  </ProtectedRoute>
                } />
                <Route path="/owner/listings/new" element={
                  <ProtectedRoute roles={['owner']}>
                    <ListingForm />
                  </ProtectedRoute>
                } />
                <Route path="/owner/listings/:id/edit" element={
                  <ProtectedRoute roles={['owner']}>
                    <ListingForm />
                  </ProtectedRoute>
                } />
                <Route path="/owner/interests" element={
                  <ProtectedRoute roles={['owner']}>
                    <OwnerInterests />
                  </ProtectedRoute>
                } />

                {/* Chat: tenant + owner */}
                <Route path="/chat" element={
                  <ProtectedRoute roles={['tenant', 'owner']}>
                    <Chat />
                  </ProtectedRoute>
                } />

                {/* Admin */}
                <Route path="/admin" element={
                  <ProtectedRoute roles={['admin']}>
                    <AdminPanel />
                  </ProtectedRoute>
                } />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
