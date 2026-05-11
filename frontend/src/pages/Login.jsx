import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // Estado para el botón
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true); // Bloqueamos el formulario

    const result = await login(email, password);

    if (result.success) {
      navigate('/admin');
    } else {
      setError(result.error);
      setLoading(false); // Liberamos para que intente de nuevo
    }
  };

  return (
    <div className="min-h-screen flex bg-dark-bg w-full">
      {/* Panel Izquierdo: Imagen Cinematográfica (Full Height) */}
      <div className="hidden lg:block lg:w-1/2 relative h-screen">
        <img
          src="/bg.jpg"
          alt="Futuristic Repository"
          className="absolute inset-0 w-full h-full object-cover grayscale-[10%] contrast-110 brightness-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-transparent to-transparent opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-r from-dark-bg/40 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-end p-16 xl:p-24">
          <div className="space-y-4">
            <h1 className="text-6xl xl:text-7xl font-black text-text-main tracking-tighter leading-[0.9]">
              REPOSITORIO <br />
              <span className="text-primary italic">INTELIGENTE</span>
            </h1>
            <div className="h-1 w-24 bg-primary rounded-full" />
            <p className="text-text-main/70 max-w-sm text-lg font-medium leading-relaxed">
              Gestión avanzada de TEG,INF Pasantia y control académico para la comunidad UGMA.
            </p>
          </div>
        </div>
      </div>

      {/* Panel Derecho: Formulario de Acceso */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-dark-bg p-8 sm:p-12 h-screen overflow-y-auto">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-4xl font-black text-text-main tracking-tight mb-2">
              Hola de nuevo.
            </h2>
            <p className="text-text-main/50 font-medium">Ingresa tus credenciales para continuar.</p>
          </div>

          <div className="rounded-[2.5rem] border border-dark-border bg-dark-card/50 p-8 sm:p-10 shadow-2xl backdrop-blur-xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-widest text-text-main/40 ml-1">
                  Correo Electrónico
                </label>
                <div className="relative group">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-text-main focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-300"
                    placeholder="nombre@ugma.edu.ve"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-widest text-text-main/40 ml-1">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-4 bg-dark-bg/50 border border-dark-border rounded-2xl text-text-main focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all duration-300"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-4 rounded-2xl text-sm font-bold animate-shake">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all duration-300 shadow-xl shadow-primary/20
                  enabled:bg-primary enabled:text-dark-bg enabled:hover:scale-[1.02] enabled:active:scale-95
                  disabled:bg-dark-border disabled:text-text-main/20 disabled:cursor-not-allowed"
              >
                {loading ? 'Verificando...' : 'Iniciar Sesión'}
              </button>
            </form>
          </div>

          <div className="text-center lg:text-left">
            <button
              onClick={() => navigate('/')}
              className="text-text-main/40 hover:text-primary text-sm font-bold transition-colors"
            >
              ← Volver al buscador público
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;