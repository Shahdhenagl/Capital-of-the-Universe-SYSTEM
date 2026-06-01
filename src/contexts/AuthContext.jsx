import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

const DEFAULT_ROLE_PERMISSIONS = {
  accountant: {
    'dashboard.view': true,
    'analytics.view': true,
    'clients.view': true,
    'quotations.view': true,
    'contracts.view': true,
    'collections.view': true,
    'expenses.view': true,
    'revenue.view': true,
    'spare_parts.view': true,
    'payroll.view': true,
    'services.view': true
  },
  viewer: {
    'dashboard.view': true,
    'clients.view': true,
    'quotations.view': true,
    'contracts.view': true,
    'collections.view': true
  }
};

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. الاستماع لتغيرات الجلسة بشكل متزامن وبسيط لتفادي تعليق أقفال الويب (Web Locks Deadlock)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const currentUser = session?.user || null;
        setUser(currentUser);
        
        // إذا لم يكن هناك مستخدم مسجل، قم بإلغاء التحميل فوراً
        if (!currentUser) {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // 2. جلب الملف الشخصي بشكل منفصل عند تغير المستخدم لتجنب التداخل غير المتزامن
  useEffect(() => {
    if (user) {
      fetchProfile(user.id);
    } else {
      setProfile(null);
    }
  }, [user]);

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
  }

  async function createUser(email, password, metadata) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    if (error) throw error;
    return data;
  }

  function hasPermission(permissionKey) {
    if (!permissionKey) return true;
    if (profile?.role === 'admin') return true;
    const storedPermissions = profile?.permissions || {};
    const permissions = Object.keys(storedPermissions).length > 0
      ? storedPermissions
      : DEFAULT_ROLE_PERMISSIONS[profile?.role] || {};
    return permissions[permissionKey] === true;
  }

  const value = {
    user,
    profile,
    loading,
    login,
    logout,
    createUser,
    hasPermission,
    isAdmin: profile?.role === 'admin',
    isAccountant: profile?.role === 'accountant' || profile?.role === 'admin',
    canEdit: profile?.role === 'admin' || profile?.role === 'accountant',
    currentBranch: profile?.branch || 'all'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
