/**
 * NotificationList.js
 * Screen daftar notifikasi
 * 
 * Fitur:
 * - List notifikasi dengan icon, judul, waktu, status (read/unread)
 * - Filter by type (Semua, Verifikasi, Revisi, Sanggahan)
 * - Pull to refresh
 * - Mark as read
 * - Deep link ke detail terkait
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  Alert, ActivityIndicator, ImageBackground, RefreshControl,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import NotificationService from '../library/NotificationService';
import moment from 'moment';

const FILTER_OPTIONS = [
  { key: 'all', label: 'Semua' },
  { key: 'verifikasi', label: 'Verifikasi' },
  { key: 'revisi', label: 'Revisi' },
  { key: 'sanggahan', label: 'Sanggahan' },
  { key: 'info', label: 'Info' },
];

const NotificationList = ({ navigation }) => {
  const dispatch = useDispatch();
  const TOKEN = useSelector(state => state.TOKEN);
  const URL = useSelector(state => state.URL);

  // State
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);

  // Load notifikasi saat screen focus
  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      // Coba fetch dari server terlebih dahulu
      const notifs = await NotificationService.fetchFromServer(URL, TOKEN);
      setNotifications(notifs);
      
      const count = await NotificationService.getUnreadCount();
      setUnreadCount(count);
      dispatch({ type: 'SET_NOTIFICATION_COUNT', payload: count });
    } catch (error) {
      console.error('[NotificationList] Error loading:', error);
      // Fallback ke data lokal
      const localNotifs = await NotificationService.getNotifications();
      setNotifications(localNotifs);
    }
    setIsLoading(false);
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadNotifications();
    setIsRefreshing(false);
  };

  /**
   * Handle tap notifikasi
   */
  const handleNotifPress = async (notif) => {
    // Mark as read
    await NotificationService.markAsRead(notif.id);
    
    // Update count
    const count = await NotificationService.getUnreadCount();
    setUnreadCount(count);
    dispatch({ type: 'SET_NOTIFICATION_COUNT', payload: count });

    // Reload list
    await loadNotifications();

    // Navigate based on type
    NotificationService.handleNotificationPress(notif, navigation);
  };

  /**
   * Mark all as read
   */
  const handleMarkAllRead = async () => {
    await NotificationService.markAllAsRead();
    await loadNotifications();
  };

  /**
   * Delete notification
   */
  const handleDelete = (notif) => {
    Alert.alert(
      'Hapus Notifikasi',
      `Hapus "${notif.title}"?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await NotificationService.deleteNotification(notif.id);
            await loadNotifications();
          },
        },
      ]
    );
  };

  /**
   * Get type icon & color
   */
  const getTypeInfo = (type) => {
    switch (type) {
      case 'verifikasi':
        return { icon: '✅', color: '#4CAF50', bgColor: '#E8F5E9' };
      case 'revisi':
        return { icon: '📝', color: '#FF9800', bgColor: '#FFF3E0' };
      case 'sanggahan':
        return { icon: '⚠️', color: '#F44336', bgColor: '#FFEBEE' };
      default:
        return { icon: 'ℹ️', color: '#2196F3', bgColor: '#E3F2FD' };
    }
  };

  /**
   * Format relative time
   */
  const formatTime = (dateString) => {
    const now = moment();
    const date = moment(dateString);
    const diffMinutes = now.diff(date, 'minutes');

    if (diffMinutes < 1) return 'Baru saja';
    if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} jam lalu`;
    if (diffMinutes < 10080) return `${Math.floor(diffMinutes / 1440)} hari lalu`;
    return date.format('DD/MM/YYYY');
  };

  /**
   * Filtered notifications
   */
  const filteredNotifications = activeFilter === 'all'
    ? notifications
    : notifications.filter(n => n.type === activeFilter);

  /**
   * Render notification item
   */
  const renderItem = ({ item }) => {
    const typeInfo = getTypeInfo(item.type);

    return (
      <TouchableOpacity
        style={[
          styles.notifItem,
          !item.isRead && styles.notifItemUnread,
        ]}
        onPress={() => handleNotifPress(item)}
        onLongPress={() => handleDelete(item)}
      >
        {/* Icon */}
        <View style={[styles.notifIcon, { backgroundColor: typeInfo.bgColor }]}>
          <Text style={styles.notifIconText}>{typeInfo.icon}</Text>
        </View>

        {/* Content */}
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={[
              styles.notifTitle,
              !item.isRead && { fontWeight: 'bold' }
            ]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifBody} numberOfLines={2}>
            {item.body}
          </Text>
          <View style={styles.notifFooter}>
            <Text style={[styles.notifType, { color: typeInfo.color }]}>
              {item.type?.toUpperCase() || 'INFO'}
            </Text>
            <Text style={styles.notifTime}>
              {formatTime(item.receivedAt)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.goBack()}>
          <FastImage
            style={{ width: 20, height: 20 }}
            source={require('../assets/img/chevron-left.png')}
            resizeMode={FastImage.resizeMode.contain}
          />
        </TouchableOpacity>
        <View style={{ flex: 3, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Notifikasi</Text>
        </View>
        <TouchableOpacity style={{ flex: 1, alignItems: 'flex-end' }} onPress={handleMarkAllRead}>
          <Text style={styles.markAllText}>Baca Semua</Text>
        </TouchableOpacity>
      </View>

      {/* Unread count */}
      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Text style={styles.unreadBannerText}>
            🔔 {unreadCount} notifikasi belum dibaca
          </Text>
        </View>
      )}

      <ImageBackground
        source={require('../assets/img/bgbg.jpg')}
        style={{ flex: 1, width: '100%' }}
        resizeMode="cover"
      >
        {/* Filter tabs */}
        <View style={styles.filterContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={FILTER_OPTIONS}
            keyExtractor={(item) => item.key}
            contentContainerStyle={{ paddingHorizontal: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterTab,
                  activeFilter === item.key && styles.filterTabActive,
                ]}
                onPress={() => setActiveFilter(item.key)}
              >
                <Text style={[
                  styles.filterTabText,
                  activeFilter === item.key && styles.filterTabTextActive,
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Loading */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#208DC0" />
            <Text style={styles.loadingText}>Memuat notifikasi...</Text>
          </View>
        )}

        {/* Notification List */}
        {!isLoading && (
          <FlatList
            data={filteredNotifications}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20, paddingTop: 5 }}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={['#208DC0']} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔕</Text>
                <Text style={styles.emptyText}>Tidak ada notifikasi</Text>
                <Text style={styles.emptySubtext}>
                  Notifikasi tentang verifikasi, revisi,{'\n'}dan sanggahan akan muncul di sini
                </Text>
              </View>
            }
          />
        )}
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    elevation: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#208DC0',
  },
  markAllText: {
    fontSize: 11,
    color: '#208DC0',
    fontWeight: '600',
  },
  unreadBanner: {
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  unreadBannerText: {
    fontSize: 12,
    color: '#1565C0',
    fontWeight: '600',
  },
  filterContainer: {
    paddingVertical: 10,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginHorizontal: 4,
    elevation: 1,
  },
  filterTabActive: {
    backgroundColor: '#208DC0',
  },
  filterTabText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#208DC0',
    marginTop: 10,
    fontWeight: '600',
  },
  notifItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  notifItemUnread: {
    backgroundColor: '#fff',
    borderLeftWidth: 3,
    borderLeftColor: '#208DC0',
  },
  notifIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifIconText: {
    fontSize: 20,
  },
  notifContent: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifTitle: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#208DC0',
    marginLeft: 8,
  },
  notifBody: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    lineHeight: 17,
  },
  notifFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  notifType: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  notifTime: {
    fontSize: 10,
    color: '#98A9B9',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 50,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#208DC0',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#98A9B9',
    marginTop: 5,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default NotificationList;
