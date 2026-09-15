// views/home/components/RecentActivity.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * RecentActivity SIMBADA V2 (Field Survey Audit Trail)
 * Timeline list sederhana aktivitas survei batas, pembaruan polygon, dan riwayat sinkronisasi.
 */
const RecentActivity = ({ activities = [], onViewAllPress }) => {
  const defaultActivities = [
    {
      id: '1',
      title: 'Survei titik batas Desa Ranomeeto',
      time: '12 Sep 2026, 09:14',
      type: 'survey',
      dotColor: '#087FC1',
    },
    {
      id: '2',
      title: 'Polygon Desa Ambaipua diperbarui',
      time: '11 Sep 2026, 15:20',
      type: 'polygon',
      dotColor: '#16A36A',
    },
    {
      id: '3',
      title: 'Data berhasil disinkronkan',
      time: '11 Sep 2026, 12:10',
      type: 'sync',
      dotColor: '#F59E0B',
    },
  ];

  const displayList =
    activities && activities.length > 0 ? activities : defaultActivities;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWithBar}>
          <View style={styles.indicatorBar} />
          <Text style={styles.sectionTitle}>AKTIVITAS TERBARU</Text>
        </View>

        <TouchableOpacity
          onPress={onViewAllPress}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.viewAllText}>Lihat Semua ›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listCard}>
        {displayList.map((item, index) => {
          const isLast = index === displayList.length - 1;
          return (
            <View key={item.id || index} style={styles.timelineItem}>
              {/* Timeline Connector */}
              <View style={styles.timelineIndicatorCol}>
                <View
                  style={[
                    styles.timelineDot,
                    { backgroundColor: item.dotColor || '#087FC1' },
                  ]}
                />
                {!isLast && <View style={styles.timelineLine} />}
              </View>

              {/* Content */}
              <View style={[styles.timelineContent, !isLast && styles.contentBorder]}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemTime}>{item.time}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleWithBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicatorBar: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: '#087FC1',
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0B3558',
    letterSpacing: 0.8,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#087FC1',
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
    borderWidth: 1,
    borderColor: '#E5E9F0',
  },
  timelineItem: {
    flexDirection: 'row',
  },
  timelineIndicatorCol: {
    alignItems: 'center',
    width: 18,
    marginRight: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 3,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 2,
    marginBottom: 2,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 14,
  },
  contentBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#142033',
    lineHeight: 18,
  },
  itemTime: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 2,
  },
});

export default RecentActivity;
