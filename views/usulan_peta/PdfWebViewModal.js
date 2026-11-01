import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useSelector } from 'react-redux';
import Modal from 'react-native-modal';
import { WebView } from 'react-native-webview';
import { readPrivatePdf } from '../library/PrivateFiles';
import { pdfViewerHtml } from '../library/pdfViewerHtml';

const PdfWebViewModal = ({ isVisible, onClose, pdfUrl }) => {
  const token = useSelector(state => state.TOKEN);
  const base = useSelector(state => state.URL?.URL_APP);
  const [document, setDocument] = useState(null);
  const html = document?.token === token && document?.pdfUrl === pdfUrl ? document?.html : '';
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setDocument(null); setError('');
    if (isVisible && pdfUrl) {
      readPrivatePdf(pdfUrl, base, token).then(data => { if (active) { setDocument({html:pdfViewerHtml(data),token,pdfUrl}); } })
        .catch(err => { if (active) { setError(err.message); } });
    }
    return () => { active = false; };
  }, [isVisible, pdfUrl, base, token]);
  return <Modal isVisible={isVisible} style={styles.modal}>
    <View style={styles.container}>
      <TouchableOpacity onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>Tutup</Text></TouchableOpacity>
      {error ? <Text accessibilityRole="alert">{error}</Text> : !html ? <ActivityIndicator /> :
        <WebView source={{ html, baseUrl: 'https://simbada.local/' }} style={styles.webView}
          originWhitelist={['https://simbada.local', 'about:blank']} allowFileAccess={false}
          mixedContentMode="never" setSupportMultipleWindows={false} javaScriptCanOpenWindowsAutomatically={false}
          onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url.startsWith('https://simbada.local/')}
          onMessage={event => { if (event.nativeEvent.data.includes('PDF_RENDER_FAILED')) { setError('PDF tidak dapat ditampilkan.'); } }} />}
    </View>
  </Modal>;
};
const styles = StyleSheet.create({
  modal: { margin: 0, justifyContent: 'center' },
  container: { flex: 1, backgroundColor: 'white', padding: 10, borderRadius: 10 },
  closeButton: { alignSelf: 'flex-end', backgroundColor: '#ff5c5c', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5, marginBottom: 10 },
  closeText: { color: 'white', fontWeight: 'bold' },
  webView: { flex: 1 },
});
export default PdfWebViewModal;
