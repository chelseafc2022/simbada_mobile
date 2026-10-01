# Panduan Pengembangan & Tips Testing SIMBADA Mobile

Dokumen ini berisi rangkuman tips penting untuk troubleshooting jaringan, testing lokal, dan proses build aplikasi **SIMBADA Mobile**.

---

## 1. Tips Mengatasi "Network Request Failed" (Testing Lokal HP Fisik)

Saat menguji aplikasi di **perangkat HP fisik** yang terhubung via kabel USB dengan server lokal laptop (`localhost:5073`):

### Masalah
Alamat `localhost` pada HP merujuk ke dirinya sendiri (bukan laptop/komputer server). Akibatnya, request API ke `http://localhost:5073/` akan gagal dengan pesan `Network request failed`.

### Solusi Praktis
Jalankan perintah ADB reverse berikut di terminal:
```bash
# Otomatis via npm (sudah dibuatkan script):
npm run reverse

# Atau langsung via adb:
adb reverse tcp:5073 tcp:5073 && adb reverse tcp:8081 tcp:8081
```

> **Catatan Penting:**
> Jika kabel USB dicabut dan dipasang kembali, atau HP di-restart, jalankan kembali `npm run reverse`.

---

## 2. Pilihan Konfigurasi Server URL (`views/redux/reducer.js`)

Buka file [views/redux/reducer.js](file:///Users/simplephi/Documents/riswan/SEG_1/simbada_mobile/views/redux/reducer.js):

- **Untuk Development Lokal (Kabel USB):**
  ```javascript
  var URL = 'http://localhost:5073/';
  var URLX = 'http://localhost:5073/';
  ```
  *(Wajib aktifkan `npm run reverse`)*

- **Untuk Development Lokal (Satu Jaringan WiFi Tanpa Kabel):**
  ```javascript
  var URL = 'http://<IP_LAPTOP>:5073/'; // Contoh: http://10.139.77.44:5073/
  var URLX = 'http://<IP_LAPTOP>:5073/';
  ```

- **Untuk Client Demo / Uji Coba Lapangan / Production:**
  ```javascript
  var URL = 'https://server-simbada.konaweselatankab.go.id/';
  var URLX = 'https://server-simbada.konaweselatankab.go.id/';
  ```
  *(Dapat diakses di mana saja menggunakan internet/data seluler tanpa perlu laptop menyala)*

---

## 3. Perintah Build APK

Masuk ke folder `simbada_mobile/android`:

### Build APK Release (Untuk Client / Produksi):
```bash
cd android
./gradlew assembleRelease
```
File APK akan berada di:
`android/app/build/outputs/apk/release/app-release.apk`

### Build APK Debug (Untuk Pengujian Cepat):
```bash
cd android
./gradlew assembleDebug
```
File APK akan berada di:
`android/app/build/outputs/apk/debug/app-debug.apk`
