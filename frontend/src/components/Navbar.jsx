import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <nav className="bg-dark-card border-b border-dark-border px-6 py-4 sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        
        {/* Logo a la izquierda */}
        <div className="flex-shrink-0">
          <Link to="/" className="text-2xl font-black text-primary tracking-tighter hover:scale-105 transition-transform inline-block">
            UGMA <span className="text-text-main font-light">Repo</span>
          </Link>
        </div>

        {/* Acciones de Usuario a la derecha (en móvil y desktop) */}
        <div className="order-2 flex items-center gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="hidden md:inline text-sm text-text-main/60">
                Hola, <span className="font-bold text-primary">{user?.name || user?.nombre || 'Admin'}</span>
              </span>
              <button
                type="button"
                onClick={logout}
                className="bg-red-500/10 text-red-500 border border-red-500/30 px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition-all text-xs font-bold uppercase tracking-wider"
              >
                Salir
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="bg-primary text-dark-bg px-6 py-2 rounded-xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
            >
              ENTRAR
            </Link>
          )}
        </div>

        {/* Botón de Administración (Central en desktop, abajo en móvil) */}
        {isAuthenticated && (user?.role === 'super_admin' || user?.role === 'admin') && (
          <div className="order-3 w-full lg:order-2 lg:w-auto flex justify-center">
            <Link
              to="/admin"
              className="w-full lg:w-auto text-center rounded-xl bg-primary/10 border border-primary/30 px-6 py-2 text-primary text-sm font-bold hover:bg-primary hover:text-dark-bg transition-all duration-300"
            >
              {user.role === 'super_admin' ? 'Panel Superadmin' : 'Panel Admin'}
            </Link>
          </div>
        )}

      </div>
    </nav>
  );
};

export default Navbar;