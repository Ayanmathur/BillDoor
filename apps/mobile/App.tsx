import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { theme } from './src/theme/tokens';
import { supabase } from './src/lib/supabase';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { CreateBillScreen } from './src/screens/CreateBillScreen';
import { CatalogScreen } from './src/screens/CatalogScreen';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState<string>('dashboard');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <LoginScreen onLoginSuccess={() => setCurrentScreen('dashboard')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {currentScreen === 'dashboard' && (
        <DashboardScreen
          onNavigate={(screen) => setCurrentScreen(screen)}
          onLogout={handleLogout}
        />
      )}

      {currentScreen === 'createBill' && (
        <CreateBillScreen
          onBack={() => setCurrentScreen('dashboard')}
          initialCameraOpen={false}
        />
      )}

      {currentScreen === 'scanBarcode' && (
        <CreateBillScreen
          onBack={() => setCurrentScreen('dashboard')}
          initialCameraOpen={true}
        />
      )}

      {currentScreen === 'catalog' && (
        <CatalogScreen onBack={() => setCurrentScreen('dashboard')} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
});
