import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import type { User } from '@/types/user';

export function useAuth() {
  const { user, isLoading, setUser, setLoading, setSession } = useAuthStore();

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('fuelbox_user');
      const token = localStorage.getItem('fuelbox_token');
      if (storedUser && token) {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [setUser, setLoading]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      const userObj: User = {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.name || data.user.email.split('@')[0],
        phone: data.user.phone || '',
        created_at: new Date().toISOString(),
      } as User;

      localStorage.setItem('fuelbox_token', data.token);
      localStorage.setItem('fuelbox_user_role', data.user.role || 'user');
      localStorage.setItem('fuelbox_user', JSON.stringify(userObj));

      setUser(userObj);
      setLoading(false);
      return data;
    } catch (err: any) {
      setLoading(false);
      throw err;
    }
  };

  const signup = async (
    email: string,
    password: string,
    fullName: string,
    mobileNumber?: string,
    pinCode?: string,
    referralCode?: string
  ) => {
    const mockUser: User = {
      id: `usr_${Date.now()}`,
      email,
      full_name: fullName,
      phone: mobileNumber || '',
      pincode: pinCode || '',
      created_at: new Date().toISOString(),
    } as User;

    localStorage.setItem('fuelbox_token', 'jwt_mock_token_' + Date.now());
    localStorage.setItem('fuelbox_user', JSON.stringify(mockUser));
    localStorage.setItem('fuelbox_user_role', 'user');

    setUser(mockUser);
    return mockUser;
  };

  const logout = async () => {
    localStorage.removeItem('fuelbox_token');
    localStorage.removeItem('fuelbox_user_role');
    localStorage.removeItem('fuelbox_user');
    useAuthStore.getState().logout();
    useCartStore.getState().setItems([]);
  };

  const loginWithGoogle = async () => {
    console.log('Google login via local auth');
  };

  return { user, isLoading, login, signup, logout, loginWithGoogle };
}
