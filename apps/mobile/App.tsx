import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { lightTheme, darkTheme } from './src/theme/tokens';
import { supabase } from './src/lib/supabase';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { CreateBillScreen } from './src/screens/CreateBillScreen';
import { CatalogScreen } from './src/screens/CatalogScreen';
import { AppointerScreen } from './src/screens/AppointerScreen';
import { ReviewFlowScreen } from './src/screens/ReviewFlowScreen';
import { WhatsAppScreen } from './src/screens/WhatsAppScreen';
import { ServicesScreen } from './src/screens/ServicesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { LayoutDashboard, Receipt, Calendar, Star, MessageSquare, Briefcase, Settings } from 'lucide-react-native';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState<string>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  const activeTheme = isDarkMode ? darkTheme : lightTheme;

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
      <SafeAreaView style={[styles.container, { backgroundColor: activeTheme.bgPrimary }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <LoginScreen onLoginSuccess={() => setCurrentScreen('dashboard')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: activeTheme.bgPrimary }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <View style={styles.mainView}>
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

        {currentScreen === 'appointer' && (
          <AppointerScreen theme={activeTheme} onBack={() => setCurrentScreen('dashboard')} />
        )}

        {currentScreen === 'reviews' && (
          <ReviewFlowScreen theme={activeTheme} onBack={() => setCurrentScreen('dashboard')} />
        )}

        {currentScreen === 'whatsapp' && (
          <WhatsAppScreen theme={activeTheme} onBack={() => setCurrentScreen('dashboard')} />
        )}

        {currentScreen === 'services' && (
          <ServicesScreen theme={activeTheme} onBack={() => setCurrentScreen('dashboard')} />
        )}

        {currentScreen === 'settings' && (
          <SettingsScreen
            theme={activeTheme}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
            onBack={() => setCurrentScreen('dashboard')}
          />
        )}
      </View>

      {/* Bottom Navigation Bar */}
      <View style={[styles.bottomBar, { backgroundColor: activeTheme.bgSecondary, borderTopColor: activeTheme.border }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('dashboard')}>
          <LayoutDashboard size={20} color={currentScreen === 'dashboard' ? activeTheme.accent : activeTheme.textSecondary} />
          <Text style={[styles.navText, { color: currentScreen === 'dashboard' ? activeTheme.accent : activeTheme.textSecondary }]}>Dash</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('createBill')}>
          <Receipt size={20} color={currentScreen === 'createBill' ? activeTheme.accent : activeTheme.textSecondary} />
          <Text style={[styles.navText, { color: currentScreen === 'createBill' ? activeTheme.accent : activeTheme.textSecondary }]}>Billit</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('appointer')}>
          <Calendar size={20} color={currentScreen === 'appointer' ? activeTheme.accent : activeTheme.textSecondary} />
          <Text style={[styles.navText, { color: currentScreen === 'appointer' ? activeTheme.accent : activeTheme.textSecondary }]}>Book</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('reviews')}>
          <Star size={20} color={currentScreen === 'reviews' ? activeTheme.accent : activeTheme.textSecondary} />
          <Text style={[styles.navText, { color: currentScreen === 'reviews' ? activeTheme.accent : activeTheme.textSecondary }]}>Review</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('whatsapp')}>
          <MessageSquare size={20} color={currentScreen === 'whatsapp' ? activeTheme.accent : activeTheme.textSecondary} />
          <Text style={[styles.navText, { color: currentScreen === 'whatsapp' ? activeTheme.accent : activeTheme.textSecondary }]}>WA</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('services')}>
          <Briefcase size={20} color={currentScreen === 'services' ? activeTheme.accent : activeTheme.textSecondary} />
          <Text style={[styles.navText, { color: currentScreen === 'services' ? activeTheme.accent : activeTheme.textSecondary }]}>Orbitex</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentScreen('settings')}>
          <Settings size={20} color={currentScreen === 'settings' ? activeTheme.accent : activeTheme.textSecondary} />
          <Text style={[styles.navText, { color: currentScreen === 'settings' ? activeTheme.accent : activeTheme.textSecondary }]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainView: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  navText: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
});
