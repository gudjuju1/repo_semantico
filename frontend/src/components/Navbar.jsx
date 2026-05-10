import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <nav className="bg-dark-card border-b border-dark-border px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center">
          <Link to="/" className="text-text-main text-xl font-bold hover:text-primary transition-colors">
            UGMA Repositorio
          </Link>
        </div>

        <div className="flex items-center justify-center">
          {isAuthenticated && user?.role === 'super_admin' && (
            <Link
              to="/admin"
              className="rounded-2xl bg-primary px-4 py-2 text-dark-bg text-sm md:text-base font-semibold hover:bg-opacity-90 transition-all"
            >
              Abrir panel de superadmin
            </Link>
          )}
          {isAuthenticated && user?.role === 'admin' && (
            <Link
              to="/admin"
              className="rounded-2xl bg-primary px-4 py-2 text-dark-bg text-sm md:text-base font-semibold hover:bg-opacity-90 transition-all"
            >
              Abrir panel de admin
            </Link>
          )}
        </div>

        <div className="flex items-center space-x-4 justify-end">
          {isAuthenticated ? (
            <>
              <span className="text-text-main text-sm md:text-base">
                Hola, <span className="font-semibold text-primary">{user?.name || user?.nombre || user?.email || user?.correo || 'Usuario'}</span>
              </span>
              <button
                type="button"
                onClick={logout}
                className="bg-red-500/10 text-red-500 border border-red-500/50 px-4 py-2 rounded hover:bg-red-500 hover:text-white transition-all text-sm font-medium"
              >
                Cerrar Sesión
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="bg-primary text-dark-bg px-4 py-2 rounded font-bold hover:bg-opacity-90 transition-all text-sm"
            >
              Iniciar Sesión
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;