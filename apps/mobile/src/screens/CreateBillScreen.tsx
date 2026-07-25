import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { theme } from '../theme/tokens';
import { supabase } from '../lib/supabase';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  ArrowLeft,
  Camera,
  Plus,
  Trash2,
  Send,
  Search,
  Check,
  X,
} from 'lucide-react-native';

interface LineItem {
  id: string;
  catalogItemId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  barcodeValue?: string;
}

interface CreateBillScreenProps {
  onBack: () => void;
  initialCameraOpen?: boolean;
}

export function CreateBillScreen({ onBack, initialCameraOpen = false }: CreateBillScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraVisible, setCameraVisible] = useState(initialCameraOpen);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [lastScannedCode, setLastScannedCode] = useState('');

  // Search Catalog Function
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const { data } = await supabase
      .from('catalog_items')
      .select('*')
      .or(`name.ilike.%${query.trim()}%,barcode_value.ilike.%${query.trim()}%`)
      .limit(6);
    setSearchResults(data || []);
  };

  const addItemToBill = (catalogItem: any) => {
    setItems(prev => {
      const existing = prev.find(
        i =>
          (catalogItem.id && i.catalogItemId === catalogItem.id) ||
          (catalogItem.barcode_value && i.barcodeValue && i.barcodeValue.toLowerCase() === catalogItem.barcode_value.toLowerCase()) ||
          i.description.toLowerCase() === catalogItem.name.toLowerCase()
      );

      if (existing) {
        return prev.map(i => (i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i));
      }

      return [
        ...prev,
        {
          id: Math.random().toString(),
          catalogItemId: catalogItem.id,
          description: catalogItem.name,
          quantity: 1,
          unitPrice: Number(catalogItem.price) || 0,
          gstPercent: Number(catalogItem.default_gst_percent) || 0,
          barcodeValue: catalogItem.barcode_value,
        },
      ];
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (!data || data === lastScannedCode) return;
    setLastScannedCode(data);
    setTimeout(() => setLastScannedCode(''), 1500);

    const { data: catalogItems } = await supabase
      .from('catalog_items')
      .select('*')
      .eq('barcode_value', data.trim())
      .limit(1);

    if (catalogItems && catalogItems.length > 0) {
      addItemToBill(catalogItems[0]);
    } else {
      Alert.alert('Barcode Scanned', `Scanned barcode: ${data}\nItem not found in catalog.`);
    }
  };

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const grandTotal = Math.round(subtotal);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Digital Bill</Text>
        <TouchableOpacity
          style={styles.cameraTriggerBtn}
          onPress={async () => {
            if (!permission?.granted) {
              const res = await requestPermission();
              if (!res.granted) {
                Alert.alert('Permission Denied', 'Camera permission is required to scan barcodes.');
                return;
              }
            }
            setCameraVisible(true);
          }}
        >
          <Camera size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Customer Details */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CUSTOMER DETAILS</Text>
          <TextInput
            style={styles.input}
            placeholder="Mobile Phone Number (+91...)"
            placeholderTextColor={theme.colors.textTertiary}
            value={customerPhone}
            onChangeText={setCustomerPhone}
            keyboardType="phone-pad"
          />
          <TextInput
            style={[styles.input, { marginTop: theme.spacing.sm }]}
            placeholder="Customer Name (Optional)"
            placeholderTextColor={theme.colors.textTertiary}
            value={customerName}
            onChangeText={setCustomerName}
          />
        </View>

        {/* Item Search & Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ADD PRODUCTS & SERVICES</Text>
          <View style={styles.searchBox}>
            <Search size={16} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search product name or barcode (e.g. BLU003)"
              placeholderTextColor={theme.colors.textTertiary}
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>

          {searchResults.length > 0 && (
            <View style={styles.dropdown}>
              {searchResults.map(item => (
                <TouchableOpacity key={item.id} style={styles.dropdownItem} onPress={() => addItemToBill(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dropdownItemTitle}>{item.name}</Text>
                    {item.barcode_value && <Text style={styles.dropdownItemSub}>Barcode: {item.barcode_value}</Text>}
                  </View>
                  <Text style={styles.dropdownItemPrice}>₹{item.price}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ITEMS ON BILL ({items.length})</Text>
          {items.length === 0 ? (
            <View style={styles.emptyItemsBox}>
              <Text style={styles.emptyItemsText}>No items added yet. Search or scan camera barcode.</Text>
            </View>
          ) : (
            items.map(item => (
              <View key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.description}</Text>
                  <Text style={styles.itemSub}>₹{item.unitPrice} × {item.quantity}</Text>
                </View>

                {/* Quantity Controls */}
                <View style={styles.qtyControls}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => {
                      setItems(prev =>
                        prev
                          .map(i => (i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i))
                          .filter(i => i.quantity > 0)
                      );
                    }}
                  >
                    <Text style={styles.qtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => {
                      setItems(prev => prev.map(i => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)));
                    }}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.itemTotal}>₹{item.quantity * item.unitPrice}</Text>
              </View>
            ))
          )}
        </View>

        {/* Bill Total & Action */}
        <View style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalValue}>₹{grandTotal.toLocaleString('en-IN')}</Text>
          </View>

          <TouchableOpacity
            style={styles.sendWhatsAppBtn}
            onPress={() => {
              if (items.length === 0) {
                Alert.alert('Empty Bill', 'Add at least one item before issuing the bill.');
                return;
              }
              Alert.alert('Bill Generated', `Bill for ₹${grandTotal} ready! WhatsApp notification sent.`);
              onBack();
            }}
          >
            <Send size={18} color="#FFF" />
            <Text style={styles.sendWhatsAppBtnText}>Issue Bill & Send WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Native Camera Modal */}
      <Modal visible={cameraVisible} animationType="slide">
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['code128', 'code39', 'ean13', 'qr'],
            }}
          />
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.closeCameraBtn} onPress={() => setCameraVisible(false)}>
              <X size={20} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.aimingBox} />

            <Text style={styles.cameraFooterText}>Position barcode inside frame to scan</Text>
          </View>
        </View>
      </Modal>
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
  cameraTriggerBtn: {
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.xs,
  },
  sectionLabel: {
    fontSize: theme.typography.fontXs,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    height: 44,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSm,
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
  dropdown: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    marginTop: theme.spacing.xs,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dropdownItemTitle: {
    fontSize: theme.typography.fontSm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  dropdownItemSub: {
    fontSize: theme.typography.fontXs,
    color: theme.colors.textSecondary,
  },
  dropdownItemPrice: {
    fontSize: theme.typography.fontSm,
    fontWeight: '700',
    color: theme.colors.accent,
  },
  emptyItemsBox: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyItemsText: {
    fontSize: theme.typography.fontXs,
    color: theme.colors.textTertiary,
  },
  itemRow: {
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
    color: theme.colors.textSecondary,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginHorizontal: theme.spacing.md,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: theme.typography.fontSm,
  },
  qtyText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    minWidth: 20,
    textAlign: 'center',
  },
  itemTotal: {
    fontSize: theme.typography.fontSm,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  totalCard: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    gap: theme.spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: theme.typography.fontMd,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  totalValue: {
    fontSize: theme.typography.fontXl,
    fontWeight: '700',
    color: theme.colors.accent,
  },
  sendWhatsAppBtn: {
    backgroundColor: theme.colors.accent,
    height: 48,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  sendWhatsAppBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: theme.typography.fontBase,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xxl,
  },
  closeCameraBtn: {
    alignSelf: 'flex-end',
    marginRight: theme.spacing.lg,
    padding: theme.spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: theme.radius.full,
  },
  aimingBox: {
    width: 280,
    height: 140,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    borderStyle: 'dashed',
    borderRadius: theme.radius.md,
  },
  cameraFooterText: {
    color: '#FFF',
    fontSize: theme.typography.fontXs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.sm,
  },
});
