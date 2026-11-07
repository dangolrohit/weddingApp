import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminLayout } from '../layouts/AdminLayout';
import { PublicLayout } from '../layouts/PublicLayout';
import { Login } from '../pages/admin/Login';
import { Dashboard } from '../pages/admin/Dashboard';
import { Clients } from '../pages/admin/Clients';
import { ClientDetail } from '../pages/admin/ClientDetail';
import { Payments } from '../pages/admin/Payments';
import { Equipment } from '../pages/admin/Equipment';
import { Categories } from '../pages/admin/Categories';
import { Settings } from '../pages/admin/Settings';
import { Storage } from '../pages/admin/Storage';
import { Home } from '../pages/public/Home';
import { GetMyImage } from '../pages/delivery/GetMyImage';
import { Download } from '../pages/delivery/Download';
import { AlbumView } from '../pages/client/AlbumView';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="get-my-image" element={<GetMyImage />} />
        <Route path="d/:token" element={<Download />} />
      </Route>

      {/* Private Client Wedding Album Share Link */}
      <Route path="/album/:shareToken" element={<AlbumView />} />

      {/* Admin Auth */}
      <Route path="/admin/login" element={<Login />} />

      {/* Protected Admin Pages */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="payments" element={<Payments />} />
        <Route path="equipment" element={<Equipment />} />
        <Route path="categories" element={<Categories />} />
        <Route path="storage" element={<Storage />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
