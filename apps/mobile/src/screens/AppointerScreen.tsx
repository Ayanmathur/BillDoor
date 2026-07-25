import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { ThemeColors, themeDimensions } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Calendar, Clock, User, Plus, Check } from 'lucide-react-native';

interface AppointerScreenProps {
  theme: ThemeColors;
  onBack: () => void;
}

export function AppointerScreen({ theme, onBack }: AppointerScreenProps) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedTime, setSelectedTime] = useState('10:00 AM');
  const [showAdd, setShowAdd] = useState(false);

  const loadAppointments = async () => {
    const { data } = await supabase.from('appointments').select('*').order('created_at', { ascending: false });
    setAppointments(data || []);
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const handleBook = async () => {
    if (!customerName || !customerPhone) {
      Alert.alert('Required', 'Please enter customer name and phone.');
      return;
    }
    const { error } = await supabase.from('appointments').insert({
      customer_id: null,
      slot_start: new Date().toISOString(),
      status: 'scheduled',
    });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Appointment Booked', `Appointment confirmed for ${customerName} at ${selectedTime}`);
      setShowAdd(false);
      setCustomerName('');
      setCustomerPhone('');
      loadAppointments();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
      <View style={[styles.header, { backgroundColor: theme.bgSecondary, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Appointer Scheduling</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: theme.accent }]} onPress={() => setShowAdd(!showAdd)}>
          <Plus size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {showAdd && (
          <View style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.accent }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>New Appointment</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.textPrimary }]}
              placeholder="Customer Name"
              placeholderTextColor={theme.textTertiary}
              value={customerName}
              onChangeText={setCustomerName}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.textPrimary }]}
              placeholder="Mobile Phone Number"
              placeholderTextColor={theme.textTertiary}
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
            />
            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: theme.accent }]} onPress={handleBook}>
              <Check size={18} color="#FFF" />
              <Text style={styles.submitBtnText}>Confirm Booking</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>SCHEDULED APPOINTMENTS</Text>
        {appointments.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
            <Calendar size={24} color={theme.textTertiary} style={{ marginBottom: 8 }} />
            <Text style={[styles.emptyText, { color: theme.textTertiary }]}>No appointments scheduled today.</Text>
          </View>
        ) : (
          appointments.map(app => (
            <View key={app.id} style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
              <View style={styles.appRow}>
                <Clock size={16} color={theme.accent} />
                <Text style={[styles.appTime, { color: theme.textPrimary }]}>{new Date(app.slot_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                <View style={[styles.statusBadge, { backgroundColor: theme.successSubtle }]}>
                  <Text style={[styles.statusText, { color: theme.success }]}>Scheduled</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: themeDimensions.spacing.lg,
    paddingTop: themeDimensions.spacing.xl,
    paddingBottom: themeDimensions.spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { padding: themeDimensions.spacing.xs },
  headerTitle: { fontSize: themeDimensions.typography.fontMd, fontWeight: '700' },
  addBtn: { padding: themeDimensions.spacing.sm, borderRadius: themeDimensions.radius.sm },
  content: { padding: themeDimensions.spacing.lg, gap: themeDimensions.spacing.md },
  sectionTitle: { fontSize: themeDimensions.typography.fontXs, fontWeight: '700', letterSpacing: 0.5 },
  card: { padding: themeDimensions.spacing.md, borderRadius: themeDimensions.radius.md, borderWidth: 1, gap: themeDimensions.spacing.sm },
  cardTitle: { fontSize: themeDimensions.typography.fontSm, fontWeight: '700' },
  input: { height: 44, borderRadius: themeDimensions.radius.md, borderWidth: 1, paddingHorizontal: themeDimensions.spacing.md, fontSize: themeDimensions.typography.fontSm },
  submitBtn: { height: 44, borderRadius: themeDimensions.radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  submitBtnText: { color: '#FFF', fontWeight: '700' },
  emptyBox: { padding: themeDimensions.spacing.xl, borderRadius: themeDimensions.radius.md, borderWidth: 1, alignItems: 'center' },
  emptyText: { fontSize: themeDimensions.typography.fontSm },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appTime: { fontSize: themeDimensions.typography.fontSm, fontWeight: '600', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: themeDimensions.radius.sm },
  statusText: { fontSize: themeDimensions.typography.fontXs, fontWeight: '700' },
});
