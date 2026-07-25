import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { theme } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Plus, Receipt, Search, Barcode } from 'lucide-react-native';

interface CatalogScreenProps {
  onBack: () => void;
}

export function CatalogScreen({ onBack }: CatalogScreenProps) {
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadCatalog = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('catalog_items')
      .select('*')
      .order('name', { ascending: true });
    setCatalogItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const filteredItems = catalogItems.filter(
    item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.barcode_value && item.barcode_value.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Catalog</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.content}>
        {/* Search */}
        <View style={styles.searchBox}>
          <Search size={16} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter catalog or search barcode..."
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Catalog List */}
        <FlatList
          data={filteredItems}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.itemCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                {item.barcode_value ? (
                  <View style={styles.barcodeBadge}>
                    <Barcode size={12} color={theme.colors.accent} style={{ marginRight: 4 }} />
                    <Text style={styles.barcodeText}>{item.barcode_value}</Text>
                  </View>
                ) : (
                  <Text style={styles.itemSub}>No Barcode</Text>
                )}
              </View>
              <Text style={styles.itemPrice}>₹{item.price}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No catalog items found.</Text>
            </View>
          }
        />
      </View>
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
  backBtn: {
    padding: theme.spacing.xs,
  },
  headerTitle: {
    fontSize: theme.typography.fontMd,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSm,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemTitle: {
    fontSize: theme.typography.fontSm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  itemSub: {
    fontSize: theme.typography.fontXs,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  barcodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accentSubtle,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    marginTop: 4,
  },
  barcodeText: {
    fontSize: theme.typography.fontXs,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  itemPrice: {
    fontSize: theme.typography.fontMd,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  emptyBox: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.fontSm,
  },
});
