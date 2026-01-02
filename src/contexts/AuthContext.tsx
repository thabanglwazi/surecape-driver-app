import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Driver, AuthContextType } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Fetch driver data
        const { data: driverData } = await supabase
          .from('drivers')
          .select('*')
          .eq('email', session.user.email)
          .single();
        
        if (driverData) {
          setDriver(driverData);
        }
      }
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      throw authError;
    }

    // Fetch driver data
    const { data: driverData, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .eq('email', email)
      .single();

    if (driverError) {
      throw new Error('Driver not found');
    }

    if (!driverData.is_active) {
      throw new Error('Driver account is inactive');
    }

    setDriver(driverData);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await AsyncStorage.clear();
    setDriver(null);
  };

  return (
    <AuthContext.Provider value={{ driver, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
