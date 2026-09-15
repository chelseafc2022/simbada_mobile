// views/home/components/SearchBar.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';

/**
 * SearchBar SIMBADA V2
 * Pencarian desa, kecamatan, atau lokasi untuk memfokuskan peta.
 */
const SearchBar = ({
  kecamatanList = [],
  selectedKecamatan = '',
  onSelectKecamatan,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Cari nama kecamatan terpilih
  const selectedObj = kecamatanList.find(
    (k) => k.kecamatan_id === selectedKecamatan
  );
  const displayLabel = selectedObj
    ? `Kec. ${selectedObj.nama_kecamatan}`
    : '';

  const filteredList = kecamatanList.filter((item) =>
    item.nama_kecamatan.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (item) => {
    onSelectKecamatan(item.kecamatan_id);
    setModalVisible(false);
    setSearchQuery('');
  };

  const handleClear = () => {
    onSelectKecamatan('');
    setSearchQuery('');
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.container}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <Text
          style={[
            styles.placeholderText,
            displayLabel ? styles.activeText : null,
          ]}
          numberOfLines={1}
        >
          {displayLabel || 'Cari desa, kecamatan, atau wilayah batas...'}
        </Text>
        {displayLabel ? (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            style={styles.clearBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.filterChip}>
            <Text style={styles.filterChipText}>Pilih Wilayah</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Modal Pemilihan Wilayah Kecamatan */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Kecamatan / Wilayah</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Input Pencarian di Modal */}
            <View style={styles.modalSearchBox}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ketik nama kecamatan..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={true}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Text style={styles.clearText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* List Kecamatan */}
            <FlatList
              data={filteredList}
              keyExtractor={(item) => item.kecamatan_id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isCurrent = item.kecamatan_id === selectedKecamatan;
                return (
                  <TouchableOpacity
                    style={[
                      styles.listItem,
                      isCurrent && styles.listItemCurrent,
                    ]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.listItemText,
                        isCurrent && styles.listItemTextCurrent,
                      ]}
                    >
                      Kecamatan {item.nama_kecamatan}
                    </Text>
                    {isCurrent && (
                      <Text style={styles.checkIcon}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    Kecamatan "{searchQuery}" tidak ditemukan
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#F5F7FA',
  },
  container: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 10,
  },
  placeholderText: {
    flex: 1,
    fontSize: 13,
    color: '#94A3B8',
  },
  activeText: {
    color: '#142033',
    fontWeight: '700',
  },
  clearBtn: {
    padding: 6,
  },
  clearText: {
    fontSize: 13,
    color: '#667A94',
    fontWeight: '700',
  },
  filterChip: {
    backgroundColor: '#EBF6FC',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#087FC1',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
    maxHeight: '75%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#142033',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#667A94',
    fontWeight: '700',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  modalInput: {
    flex: 1,
    fontSize: 13,
    color: '#142033',
    paddingVertical: 0,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  listItemCurrent: {
    backgroundColor: '#EBF6FC',
    borderRadius: 8,
  },
  listItemText: {
    fontSize: 13,
    color: '#142033',
    fontWeight: '500',
  },
  listItemTextCurrent: {
    fontWeight: '700',
    color: '#087FC1',
  },
  checkIcon: {
    fontSize: 14,
    fontWeight: '800',
    color: '#087FC1',
  },
  emptyBox: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#667A94',
  },
});

export default SearchBar;
