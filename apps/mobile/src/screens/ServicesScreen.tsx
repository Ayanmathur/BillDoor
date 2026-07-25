import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { ThemeColors, themeDimensions } from '../theme/tokens';
import { ArrowLeft, Globe, Search, Megaphone, Palette, ExternalLink } from 'lucide-react-native';

interface ServicesScreenProps {
  theme: ThemeColors;
  onBack: () => void;
}

export function ServicesScreen({ theme, onBack }: ServicesScreenProps) {
  const handleContactOrbitex = (serviceName: string) => {
    const text = `Hi Orbitex Team, I am interested in ${serviceName} for my business.`;
    const url = `whatsapp://send?phone=919422880355&text=${encodeURIComponent(text)}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://api.whatsapp.com/send?phone=919422880355&text=${encodeURIComponent(text)}`);
      }
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
      <View style={[styles.header, { backgroundColor: theme.bgSecondary, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Orbitex Agency Services</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>GROW YOUR BUSINESS</Text>

        <TouchableOpacity style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]} onPress={() => handleContactOrbitex('Website Development')}>
          <Globe size={22} color={theme.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Website & Online Store</Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Custom high-speed SEO website for your brand</Text>
          </View>
          <ExternalLink size={16} color={theme.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]} onPress={() => handleContactOrbitex('Local SEO & Google Maps Ranking')}>
          <Search size={22} color={theme.warning} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Local SEO & Google Maps</Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Rank #1 in local business search results</Text>
          </View>
          <ExternalLink size={16} color={theme.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]} onPress={() => handleContactOrbitex('Google & Instagram Ads')}>
          <Megaphone size={22} color={theme.info} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Google & Instagram Ads</Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>High-converting customer lead campaigns</Text>
          </View>
          <ExternalLink size={16} color={theme.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]} onPress={() => handleContactOrbitex('Branding & Logo Design')}>
          <Palette size={22} color={theme.success} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Branding & Identity</Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Premium logo design, packaging & identity</Text>
          </View>
          <ExternalLink size={16} color={theme.textTertiary} />
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
  content: { padding: themeDimensions.spacing.lg, gap: themeDimensions.spacing.md },
  sectionTitle: { fontSize: themeDimensions.typography.fontXs, fontWeight: '700', letterSpacing: 0.5 },
  card: { flexDirection: 'row', alignItems: 'center', padding: themeDimensions.spacing.md, borderRadius: themeDimensions.radius.md, borderWidth: 1, gap: themeDimensions.spacing.md },
  cardTitle: { fontSize: themeDimensions.typography.fontSm, fontWeight: '700' },
  cardSub: { fontSize: themeDimensions.typography.fontXs, marginTop: 2 },
});
