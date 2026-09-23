/**
 * queryClient.js — TanStack Query Client Singleton untuk SIMBADA Mobile
 * Dioptimalkan untuk performa aplikasi mobile offline-first dan GIS:
 * - refetchOnWindowFocus dinonaktifkan agar tidak trigger fetch berulang saat buka-tutup app/tab
 * - staleTime 5 menit default untuk data umum
 * - gcTime 24 jam agar data cache tersimpan di memori sepanjang sesi
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 5 * 60 * 1000, // 5 menit
      gcTime: 24 * 60 * 60 * 1000, // 24 jam
    },
  },
});

export default queryClient;
