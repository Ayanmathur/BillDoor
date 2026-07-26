import 'react-native-url-polyfill/auto';
import React, { useState, useRef } from 'react';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { RefreshCw, X } from 'lucide-react-native';

const APP_URL = 'https://billdoor-rho.vercel.app';

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraVisible, setCameraVisible] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState('');

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!data || data === lastScannedCode) return;
    setLastScannedCode(data);
    setTimeout(() => setLastScannedCode(''), 1500);

    // Send scanned barcode back to web app via window.postMessage
    webViewRef.current?.injectJavaScript(`
      (function() {
        if (window.handleNativeBarcodeScan) {
          window.handleNativeBarcodeScan("${data}");
        } else {
          var activeInput = document.activeElement;
          if (activeInput && (activeInput.tagName === 'INPUT' || activeInput.tagName === 'TEXTAREA')) {
            activeInput.value = "${data}";
            activeInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      })();
      true;
    `);

    Alert.alert('Barcode Scanned', `Scanned code: ${data}`);
    setCameraVisible(false);
  };

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'OPEN_CAMERA') {
        if (!permission?.granted) {
          const res = await requestPermission();
          if (!res.granted) {
            Alert.alert('Permission Required', 'Camera permission is required to scan barcodes.');
            return;
          }
        }
        setCameraVisible(true);
      }
    } catch (e) {
      // Non-JSON postMessage ignored
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Hidden Status Bar for 100% Fullscreen Immersive Mode */}
      <ExpoStatusBar hidden={true} translucent={true} />

      {/* Main Native WebView Container — 100% Fullscreen Display */}
      <View style={styles.webViewWrapper}>
        <WebView
          ref={webViewRef}
          source={{ uri: APP_URL }}
          style={styles.webView}
          onLoadStart={() => {
            setLoading(true);
            setHasError(false);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setHasError(true);
          }}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          allowsBackForwardNavigationGestures={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#088395" />
              <Text style={styles.loadingText}>Loading BillDoor...</Text>
            </View>
          )}
        />

        {hasError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>BillDoor Mobile App</Text>
            <Text style={styles.errorText}>Could not connect to live application server.</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setHasError(false);
                setLoading(true);
                webViewRef.current?.reload();
              }}
            >
              <RefreshCw size={18} color="#FFF" />
              <Text style={styles.retryBtnText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Native Camera Barcode Scanner Overlay Modal */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  webViewWrapper: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: '#111111',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
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
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 32,
  },
  closeCameraBtn: {
    alignSelf: 'flex-end',
    marginRight: 16,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 9999,
  },
  aimingBox: {
    width: 280,
    height: 140,
    borderWidth: 2,
    borderColor: '#088395',
    borderStyle: 'dashed',
    borderRadius: 10,
  },
  cameraFooterText: {
    color: '#FFF',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
});
