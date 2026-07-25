import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { ThemeColors, themeDimensions } from '../theme/tokens';
import { ArrowLeft, Moon, Sun, Save, QrCode } from 'lucide-react-native';

interface SettingsScreenProps {
  theme: ThemeColors;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onBack: () => void;
}

export function SettingsScreen({ theme, isDarkMode, onToggleDarkMode, onBack }: SettingsScreenProps) {
  const [businessName, setBusinessName] = useState('My Retail Business');
  const [gstNumber, setGstNumber] = useState('27AAAAA0000A1Z5');
  const [instagramUrl, setInstagramUrl] = useState('https://instagram.com/');

  const handleSaveSettings = () => {
    Alert.alert('Settings Saved', 'Your business profile and settings have been updated.');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
      <View style={[styles.header, { backgroundColor: theme.bgSecondary, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Business Settings</Text>
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={handleSaveSettings}>
          <Save size={16} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Theme Settings */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>APPEARANCE & THEME</Text>
        <View style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
          <View style={styles.row}>
            {isDarkMode ? <Moon size={20} color={theme.accent} /> : <Sun size={20} color={theme.warning} />}
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Dark Mode</Text>
            <Switch value={isDarkMode} onValueChange={onToggleDarkMode} trackColor={{ false: '#767577', true: theme.accent }} />
          </View>
        </View>

        {/* Business Identity */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>BUSINESS PROFILE</Text>
        <View style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Business Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.textPrimary }]}
            value={businessName}
            onChangeText={setBusinessName}
          />

          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>GST Number</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.textPrimary }]}
            value={gstNumber}
            onChangeText={setGstNumber}
            autoCapitalize="characters"
          />

          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Instagram URL</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.textPrimary }]}
            value={instagramUrl}
            onChangeText={setInstagramUrl}
          />
        </View>

        {/* QR Links */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>QR CODES & LINKS</Text>
        <TouchableOpacity style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
          <View style={styles.row}>
            <QrCode size={20} color={theme.accent} />
            <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Review QR & Digital Card Links</Text>
          </View>
        </TouchableOpacity>
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
  saveBtn: { padding: themeDimensions.spacing.xs, borderRadius: themeDimensions.radius.sm },
  content: { padding: themeDimensions.spacing.lg, gap: themeDimensions.spacing.md },
  sectionTitle: { fontSize: themeDimensions.typography.fontXs, fontWeight: '700', letterSpacing: 0.5 },
  card: { padding: themeDimensions.spacing.md, borderRadius: themeDimensions.radius.md, borderWidth: 1, gap: themeDimensions.spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  rowLabel: { fontSize: themeDimensions.typography.fontSm, fontWeight: '600', flex: 1, marginLeft: 8 },
  inputLabel: { fontSize: themeDimensions.typography.fontXs, fontWeight: '600', marginTop: 4 },
  input: { height: 44, borderRadius: themeDimensions.radius.md, borderWidth: 1, paddingHorizontal: themeDimensions.spacing.md, fontSize: themeDimensions.typography.fontSm, marginVertical: 4 },
});
