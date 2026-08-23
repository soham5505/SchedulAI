import React, { createContext, useContext, useState, useEffect } from 'react';
import { IUser, UserRole } from '@schedulai/shared-types';
import { apiClient } from '../api/client.js';

interface AuthContextType {
  user: IUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<IUser | null>(() => {
    const saved = localStorage.getItem('schedulai_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('schedulai_access_token');
      if (token) {
        try {
          const res = await apiClient.get<{ success: boolean; data: { user: IUser } }>('/auth/me');
          if (res.data.data?.user) {
            setUser(res.data.data.user);
            localStorage.setItem('schedulai_user', JSON.stringify(res.data.data.user));
          }
        } catch {
          // Handled by client interceptor
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiClient.post<{
      success: boolean;
      data: {
        user: IUser;
        tokens: { accessToken: string; refreshToken: string };
      };
    }>('/auth/login', { email, password });

    if (res.data.data) {
      const { user: userData, tokens } = res.data.data;
      setUser(userData);
      localStorage.setItem('schedulai_user', JSON.stringify(userData));
      localStorage.setItem('schedulai_access_token', tokens.accessToken);
      localStorage.setItem('schedulai_refresh_token', tokens.refreshToken);
    }
  };

  const register = async (name: string, email: string, password: string, role?: UserRole) => {
    const res = await apiClient.post<{
      success: boolean;
      data: {
        user: IUser;
        tokens: { accessToken: string; refreshToken: string };
      };
    }>('/auth/register', { name, email, password, role });

    if (res.data.data) {
      const { user: userData, tokens } = res.data.data;
      setUser(userData);
      localStorage.setItem('schedulai_user', JSON.stringify(userData));
      localStorage.setItem('schedulai_access_token', tokens.accessToken);
      localStorage.setItem('schedulai_refresh_token', tokens.refreshToken);
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      localStorage.removeItem('schedulai_user');
      localStorage.removeItem('schedulai_access_token');
      localStorage.removeItem('schedulai_refresh_token');
      window.location.href = '/login';
    }
  };

  const hasRole = (...roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
