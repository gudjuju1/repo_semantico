import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import SuperAdminPanel from '../components/SuperAdminPanel';
import AdminPanel from '../components/AdminPanel';

const Dashboard = () => {
  const { user, isAuthenticated } = useAuth();

  console.log('Dashboard - isAuthenticated:', isAuthenticated);
  console.log('Dashboard - User:', user);
  console.log('Dashboard - User role:', user?.role);

  if (user?.role === 'super_admin') {
    console.log('Rendering SuperAdminPanel');
    return <SuperAdminPanel />;
  }

  if (user?.role === 'admin') {
    console.log('Rendering AdminPanel');
    return <AdminPanel />;
  }

  console.log('Rendering default dashboard');
  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Panel de Administración</h1>
      <p>Bienvenido, {user?.name || user?.email}. Rol: {user?.role}</p>
      {/* Aquí irá el contenido del dashboard para otros roles */}
    </div>
  );
};

export default Dashboard;