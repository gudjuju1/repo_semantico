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
    <div className="max-w-md mx-auto bg-dark-card p-6 rounded-lg border border-dark-border shadow-xl">
      <h2 className="text-2xl font-bold mb-6 text-center text-primary">Acceso Administrativo</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-text-main mb-2 font-medium">Correo Electrónico</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-text-main focus:border-primary outline-none transition-all"
            placeholder="ejemplo@ugma.edu.ve"
            required
            disabled={loading}
          />
        </div>

        <div className="mb-6">
          <label className="block text-text-main mb-2 font-medium">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-text-main focus:border-primary outline-none transition-all"
            placeholder="••••••••"
            required
            disabled={loading}
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 rounded font-bold transition-all ${
            loading 
              ? 'bg-gray-600 cursor-not-allowed text-gray-400' 
              : 'bg-primary text-dark-bg hover:bg-opacity-90 active:scale-95'
          }`}
        >
          {loading ? 'Verificando...' : 'Iniciar Sesión'}
        </button>
      </form>
    </div>
  );
};

export default Login;