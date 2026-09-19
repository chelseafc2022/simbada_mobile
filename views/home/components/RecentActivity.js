// views/home/components/RecentActivity.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * RecentActivity SIMBADA V2 (Field Survey Audit Trail)
 * Timeline dinamis dan interaktif aktivitas survei batas, pembaruan polygon, dan riwayat sinkronisasi.
 */
const RecentActivity = ({
  activities = [],
  onViewAllPress,
  onTambahTitikPress,
  onRekamTrekPress,
}) => {
  const displayList = activities || [];

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
        {displayList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Text style={{ fontSize: 24 }}>🛰️</Text>
            </View>
            <Text style={styles.emptyTitle}>Belum Ada Riwayat Survei</Text>
            <Text style={styles.emptySubtitle}>
              Mulai pemetaan lapangan dengan menambah patok titik batas atau merekam rute jejak GPS.
            </Text>
            <View style={styles.emptyActionRow}>
              {onTambahTitikPress && (
                <TouchableOpacity
                  style={styles.emptyBtnPrimary}
                  onPress={onTambahTitikPress}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyBtnPrimaryText}>📍 Titik Batas</Text>
                </TouchableOpacity>
              )}
              {onRekamTrekPress && (
                <TouchableOpacity
                  style={styles.emptyBtnSecondary}
                  onPress={onRekamTrekPress}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyBtnSecondaryText}>▶ Rekam Trek</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          displayList.map((item, index) => {
            const isLast = index === displayList.length - 1;
            const Wrapper = item.onPress ? TouchableOpacity : View;

            return (
              <Wrapper
                key={item.id || index}
                style={styles.timelineItem}
                activeOpacity={0.7}
                onPress={item.onPress}
              >
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
                  <View style={styles.headerItemRow}>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {item.badge ? (
                      <View
                        style={[
                          styles.badgeContainer,
                          {
                            backgroundColor: (item.dotColor || '#087FC1') + '15',
                            borderColor: (item.dotColor || '#087FC1') + '40',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            { color: item.dotColor || '#087FC1' },
                          ]}
                        >
                          {item.badge}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {item.subtitle ? (
                    <Text style={styles.itemSubtitle} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}

                  <View style={styles.timeRow}>
                    <Text style={styles.itemTime}>{item.time}</Text>
                    {item.onPress ? (
                      <Text style={styles.actionPromptText}>Buka detail ›</Text>
                    ) : null}
                  </View>
                </View>
              </Wrapper>
            );
          })
        )}
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
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 3,
    marginBottom: 3,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 14,
  },
  contentBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemTitle: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#142033',
    lineHeight: 18,
  },
  itemSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  itemTime: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#94A3B8',
  },
  actionPromptText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#087FC1',
  },
  badgeContainer: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  // Empty State Styles
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 14,
  },
  emptyActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyBtnPrimary: {
    backgroundColor: '#0284C7',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  emptyBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  emptyBtnSecondary: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  emptyBtnSecondaryText: {
    color: '#334155',
    fontSize: 11.5,
    fontWeight: '700',
  },
});

export default RecentActivity;
