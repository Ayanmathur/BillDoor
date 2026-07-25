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
import { ArrowLeft, Star, ExternalLink, MapPin, Copy } from 'lucide-react-native';

interface ReviewFlowScreenProps {
  theme: ThemeColors;
  onBack: () => void;
}

export function ReviewFlowScreen({ theme, onBack }: ReviewFlowScreenProps) {
  const [placeId, setPlaceId] = useState('ChIJN1t_tDe15zsR80b... (Default)');

  const openGoogleMapsReview = () => {
    const url = `https://search.google.com/local/writereview?placeid=${placeId.trim()}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Google Maps', `Review URL: ${url}`);
      }
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
      <View style={[styles.header, { backgroundColor: theme.bgSecondary, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Review Flow & Funnel</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Rating Funnel Cards */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>REVIEW FUNNEL METRICS</Text>
        <View style={styles.grid}>
          <View style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Positive Feedback (4-5★)</Text>
            <Text style={[styles.cardValue, { color: theme.success }]}>94.2%</Text>
            <Text style={[styles.cardSub, { color: theme.textTertiary }]}>Redirected to Google Reviews</Text>
          </View>

          <View style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
            <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>Private Feedback (1-3★)</Text>
            <Text style={[styles.cardValue, { color: theme.error }]}>5.8%</Text>
            <Text style={[styles.cardSub, { color: theme.textTertiary }]}>Sent privately to management</Text>
          </View>
        </View>

        {/* Google Place ID Redirect Setup */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>GOOGLE MAPS PLACE ID REDIRECT</Text>
        <View style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.accent }]}>
          <View style={styles.placeHeader}>
            <MapPin size={18} color={theme.accent} />
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Google Place ID</Text>
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.textPrimary }]}
            placeholder="Paste your Google Place ID..."
            placeholderTextColor={theme.textTertiary}
            value={placeId}
            onChangeText={setPlaceId}
          />
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.accent }]} onPress={openGoogleMapsReview}>
            <ExternalLink size={16} color="#FFF" />
            <Text style={styles.actionBtnText}>Test Launch Google Maps Review App</Text>
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
  grid: { gap: themeDimensions.spacing.sm },
  card: { padding: themeDimensions.spacing.md, borderRadius: themeDimensions.radius.md, borderWidth: 1, gap: themeDimensions.spacing.xs },
  placeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: themeDimensions.typography.fontSm, fontWeight: '700' },
  cardLabel: { fontSize: themeDimensions.typography.fontXs, fontWeight: '600' },
  cardValue: { fontSize: themeDimensions.typography.fontXl, fontWeight: '700', marginVertical: 4 },
  cardSub: { fontSize: themeDimensions.typography.fontXs },
  input: { height: 44, borderRadius: themeDimensions.radius.md, borderWidth: 1, paddingHorizontal: themeDimensions.spacing.md, fontSize: themeDimensions.typography.fontSm, marginVertical: 4 },
  actionBtn: { height: 44, borderRadius: themeDimensions.radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  actionBtnText: { color: '#FFF', fontWeight: '700', fontSize: themeDimensions.typography.fontSm },
});
