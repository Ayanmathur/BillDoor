import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
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
import { LayoutDashboard, Receipt, Calendar, Star, MessageSquare, Briefcase, Settings, RefreshCw } from 'lucide-react-native';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.log('App ErrorBoundary caught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.errorContainer}>
          <Text style={styles.errorTitle}>BillDoor Native Mobile</Text>
          <Text style={styles.errorText}>Something went wrong while loading this screen.</Text>
          <Text style={styles.errorDetail}>{this.state.error?.message}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => this.setState({ hasError: false, error: undefined })}
          >
            <RefreshCw size={18} color="#FFF" />
            <Text style={styles.retryBtnText}>Reload App</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const [session, setSession] = useState<any>(null);
  const [currentScreen, setCurrentScreen] = useState<string>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  const activeTheme = isDarkMode ? darkTheme : lightTheme;

  useEffect(() => {
    let isMounted = true;
    try {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (isMounted) setSession(session);
      }).catch(err => {
        console.log('Supabase session fetch error:', err);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (isMounted) setSession(session);
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } catch (err) {
      console.log('Supabase init auth listener catch:', err);
    }
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.log('Logout error:', e);
    }
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

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
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
  errorContainer: {
    flex: 1,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#A0A0A5',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorDetail: {
    fontSize: 12,
    color: '#D94452',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#088395',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
