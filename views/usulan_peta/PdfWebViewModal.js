import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { WebView } from 'react-native-webview';

const PdfWebViewModal = ({ isVisible, onClose, pdfUrl }) => {
    return (
        <Modal isVisible={isVisible} style={styles.modal}>
            <View style={styles.container}>
                {/* Tombol Tutup */}
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Text style={styles.closeText}>Tutup</Text>
                </TouchableOpacity>

                {/* WebView untuk menampilkan PDF */}
                <WebView
                    source={{ uri: `https://docs.google.com/gview?embedded=true&url=${pdfUrl}` }}
                    style={styles.webView}
                />
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modal: {
        margin: 0,
        justifyContent: 'center',
    },
    container: {
        flex: 1,
        backgroundColor: 'white',
        padding: 10,
        borderRadius: 10,
    },
    closeButton: {
        alignSelf: 'flex-end',
        backgroundColor: '#ff5c5c',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 5,
        marginBottom: 10,
    },
    closeText: {
        color: 'white',
        fontWeight: 'bold',
    },
    webView: {
        flex: 1,
    },
});

export default PdfWebViewModal;
