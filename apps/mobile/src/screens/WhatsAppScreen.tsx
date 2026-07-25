import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Linking,
  Alert,
} from 'react-native';
import { ThemeColors, themeDimensions } from '../theme/tokens';
import { ArrowLeft, MessageSquare, Send, Smartphone } from 'lucide-react-native';

interface WhatsAppScreenProps {
  theme: ThemeColors;
  onBack: () => void;
}

export function WhatsAppScreen({ theme, onBack }: WhatsAppScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('Hello! Thank you for visiting our store. Here is your digital bill link: https://app.billdoor.in/bill/sample');

  const openWhatsApp = () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Phone Required', 'Please enter recipient mobile phone number.');
      return;
    }
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const url = `whatsapp://send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`);
      }
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
      <View style={[styles.header, { backgroundColor: theme.bgSecondary, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>WhatsApp Automation</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>DIRECT WHATSAPP APP LAUNCHER</Text>
        <View style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.accent }]}>
          <View style={styles.cardHeader}>
            <MessageSquare size={18} color={theme.accent} />
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Instant WhatsApp Send</Text>
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.textPrimary }]}
            placeholder="Mobile Phone Number (10 digits)"
            placeholderTextColor={theme.textTertiary}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.textPrimary }]}
            placeholder="WhatsApp Message..."
            placeholderTextColor={theme.textTertiary}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
          />
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: theme.accent }]} onPress={openWhatsApp}>
            <Send size={16} color="#FFF" />
            <Text style={styles.sendBtnText}>Open WhatsApp App & Send</Text>
          </TouchableOpacity>
        </View>
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
  content: { padding: themeDimensions.spacing.lg, gap: themeDimensions.spacing.md },
  sectionTitle: { fontSize: themeDimensions.typography.fontXs, fontWeight: '700', letterSpacing: 0.5 },
  card: { padding: themeDimensions.spacing.md, borderRadius: themeDimensions.radius.md, borderWidth: 1, gap: themeDimensions.spacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: themeDimensions.typography.fontSm, fontWeight: '700' },
  input: { height: 44, borderRadius: themeDimensions.radius.md, borderWidth: 1, paddingHorizontal: themeDimensions.spacing.md, fontSize: themeDimensions.typography.fontSm },
  textArea: { height: 80, borderRadius: themeDimensions.radius.md, borderWidth: 1, paddingHorizontal: themeDimensions.spacing.md, paddingVertical: themeDimensions.spacing.xs, fontSize: themeDimensions.typography.fontSm, textAlignVertical: 'top' },
  sendBtn: { height: 44, borderRadius: themeDimensions.radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  sendBtnText: { color: '#FFF', fontWeight: '700', fontSize: themeDimensions.typography.fontSm },
});
