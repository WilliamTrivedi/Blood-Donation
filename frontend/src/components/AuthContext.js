import React, { useState, useContext, createContext } from 'react';
import axios from 'axios';

// Create Auth Context
const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [isLoading, setIsLoading] = useState(false);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  // Set up axios interceptor for authentication
  React.useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { access_token, user: userData } = response.data;
      
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('auth_token', access_token);
      
      return { success: true, user: userData };
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed';
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email, password, role = 'donor') => {
    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/auth/register`, { 
        email, 
        password, 
        role 
      });
      const { access_token, user: userData } = response.data;
      
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('auth_token', access_token);
      
      return { success: true, user: userData };
    } catch (error) {
      const message = error.response?.data?.detail || 'Registration failed';
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    delete axios.defaults.headers.common['Authorization'];
  };

  const getDemoToken = async (role = 'donor') => {
    try {
      const response = await axios.get(`${API}/auth/demo-token?role=${role}`);
      const { access_token } = response.data;
      
      setToken(access_token);
      setUser({ 
        id: `demo_${role}_user`, 
        email: `demo_${role}@demo.bloodconnect.app`,
        role,
        demo: true 
      });
      localStorage.setItem('auth_token', access_token);
      
      return { success: true, demo: true };
    } catch (error) {
      return { success: false, message: 'Failed to get demo token' };
    }
  };

  const value = {
    user,
    token,
    isLoading,
    login,
    register,
    logout,
    getDemoToken,
    isAuthenticated: !!token,
    isDemo: user?.demo || false
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Login Modal Component
export const LoginModal = ({ show, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'donor'
  });
  const [errors, setErrors] = useState({});
  
  const { login, register, getDemoToken, isLoading } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validation
    if (!formData.email || !formData.password) {
      setErrors({ general: 'Email and password are required' });
      return;
    }

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    if (!isLogin && formData.password.length < 8) {
      setErrors({ password: 'Password must be at least 8 characters with uppercase, lowercase, and number' });
      return;
    }

    const result = isLogin 
      ? await login(formData.email, formData.password)
      : await register(formData.email, formData.password, formData.role);

    if (result.success) {
      onSuccess && onSuccess(result.user);
      onClose();
    } else {
      setErrors({ general: result.message });
    }
  };

  const handleDemoLogin = async (role) => {
    const result = await getDemoToken(role);
    if (result.success) {
      onSuccess && onSuccess({ demo: true, role });
      onClose();
    } else {
      setErrors({ general: result.message });
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">
            {isLogin ? '🩸 Login to BloodConnect' : '🩸 Join BloodConnect'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
              {errors.general}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
            {errors.password && <p className="text-red-600 text-sm mt-1">{errors.password}</p>}
          </div>

          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                />
                {errors.confirmPassword && <p className="text-red-600 text-sm mt-1">{errors.confirmPassword}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="donor">Blood Donor</option>
                  <option value="hospital">Hospital Staff</option>
                </select>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>

        <div className="mt-4">
          <div className="text-center text-sm text-gray-600 mb-3">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-red-600 hover:text-red-800"
            >
              {isLogin ? 'Register here' : 'Login here'}
            </button>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-gray-600 mb-3 text-center">🚨 Demo Mode - Try without registration:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleDemoLogin('donor')}
                className="bg-blue-100 text-blue-800 py-2 px-3 rounded-md text-sm hover:bg-blue-200"
              >
                👤 Demo Donor
              </button>
              <button
                onClick={() => handleDemoLogin('hospital')}
                className="bg-green-100 text-green-800 py-2 px-3 rounded-md text-sm hover:bg-green-200"
              >
                🏥 Demo Hospital
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};