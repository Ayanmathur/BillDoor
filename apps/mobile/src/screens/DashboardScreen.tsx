import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { theme } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import {
  Plus,
  Receipt,
  Users,
  Star,
  TrendingUp,
  Wallet,
  LogOut,
  Camera,
} from 'lucide-react-native';

interface DashboardScreenProps {
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

export function DashboardScreen({ onNavigate, onLogout }: DashboardScreenProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    todayRevenue: 4850,
    todayCount: 14,
    totalBills: 382,
    customers: 128,
    avgRating: '4.8',
    unreadReviews: 2,
    monthExpenses: 1200,
  });

  const loadDashboardStats = async () => {
    setRefreshing(true);
    // Fetch live stats from Supabase
    try {
      const { data: bills } = await supabase.from('bills').select('grand_total, created_at');
      if (bills && bills.length > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        const todayBills = bills.filter(b => b.created_at && b.created_at.startsWith(todayStr));
        const rev = todayBills.reduce((acc, b) => acc + (Number(b.grand_total) || 0), 0);
        setStats(prev => ({
          ...prev,
          todayRevenue: rev || prev.todayRevenue,
          todayCount: todayBills.length || prev.todayCount,
          totalBills: bills.length || prev.totalBills,
        }));
      }
    } catch (e) {
      console.log('Dashboard stats fetch:', e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardStats();
  }, []);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Image
          source={require('../../assets/splash.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <LogOut size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadDashboardStats} tintColor={theme.colors.accent} />
        }
      >
        {/* Quick Actions Bar */}
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={() => onNavigate('createBill')}>
            <Plus size={20} color="#FFF" />
            <Text style={styles.actionBtnPrimaryText}>Create Bill</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => onNavigate('scanBarcode')}>
            <Camera size={18} color={theme.colors.accent} />
            <Text style={styles.actionBtnText}>Scan Camera</Text>
          </TouchableOpacity>
        </View>

        {/* Metric Cards */}
        <Text style={styles.sectionTitle}>BUSINESS SUMMARY</Text>
        <View style={styles.grid}>
          {/* Revenue */}
          <TouchableOpacity style={styles.card} onPress={() => onNavigate('createBill')}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Today's Revenue</Text>
              <View style={[styles.iconBox, { backgroundColor: theme.colors.accentSubtle }]}>
                <TrendingUp size={16} color={theme.colors.accent} />
              </View>
            </View>
            <Text style={styles.cardValue}>₹{stats.todayRevenue.toLocaleString('en-IN')}</Text>
            <Text style={styles.cardSub}>{stats.todayCount} bills today · {stats.totalBills} total</Text>
          </TouchableOpacity>

          {/* Reviews */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Average Rating</Text>
              <View style={[styles.iconBox, { backgroundColor: theme.colors.warningSubtle }]}>
                <Star size={16} color={theme.colors.warning} />
              </View>
            </View>
            <Text style={styles.cardValue}>{stats.avgRating} ★</Text>
            <Text style={styles.cardSub}>
              {stats.unreadReviews > 0 ? `${stats.unreadReviews} unread reviews` : '100% positive feedback'}
            </Text>
          </View>

          {/* Customers */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>Total Customers</Text>
              <View style={[styles.iconBox, { backgroundColor: theme.colors.infoSubtle }]}>
                <Users size={16} color={theme.colors.info} />
              </View>
            </View>
            <Text style={styles.cardValue}>{stats.customers}</Text>
            <Text style={styles.cardSub}>Unique mobile numbers</Text>
          </View>

          {/* Expenses */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>This Month Expenses</Text>
              <View style={[styles.iconBox, { backgroundColor: theme.colors.errorSubtle }]}>
                <Wallet size={16} color={theme.colors.error} />
              </View>
            </View>
            <Text style={styles.cardValue}>₹{stats.monthExpenses.toLocaleString('en-IN')}</Text>
            <Text style={styles.cardSub}>Logged operating expenses</Text>
          </View>
        </View>

        {/* Navigation Quick Links */}
        <Text style={styles.sectionTitle}>MODULES</Text>
        <View style={styles.menuList}>
          <TouchableOpacity style={styles.menuItem} onPress={() => onNavigate('catalog')}>
            <Receipt size={20} color={theme.colors.accent} />
            <View style={styles.menuTextGroup}>
              <Text style={styles.menuTitle}>Product Catalog</Text>
              <Text style={styles.menuSub}>Manage catalog items & compact barcodes</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  logo: {
    width: 140,
    height: 40,
  },
  logoutBtn: {
    padding: theme.spacing.sm,
  },
  scrollContent: {
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.fontXs,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  actionBtnPrimary: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  actionBtnText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSm,
    fontWeight: '600',
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: theme.typography.fontSm,
    fontWeight: '600',
  },
  grid: {
    gap: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  cardLabel: {
    fontSize: theme.typography.fontXs,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  iconBox: {
    padding: theme.spacing.xs,
    borderRadius: theme.radius.sm,
  },
  cardValue: {
    fontSize: theme.typography.fontXl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginVertical: theme.spacing.xs,
  },
  cardSub: {
    fontSize: theme.typography.fontXs,
    color: theme.colors.textTertiary,
  },
  menuList: {
    gap: theme.spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  menuTextGroup: {
    flex: 1,
  },
  menuTitle: {
    fontSize: theme.typography.fontSm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  menuSub: {
    fontSize: theme.typography.fontXs,
    color: theme.colors.textSecondary,
  },
});
