// views/user/KebijakanPrivasi.js
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import AppHeader from '../components/AppHeader';

// ─────────────────────────────────────────────────────────
// Design System Tokens — Geo-Sapphire (konsisten dgn User.js)
// ─────────────────────────────────────────────────────────
const C = {
  PRIMARY: '#0284C7',
  PRIMARY_DARK: '#0369A1',
  PRIMARY_LIGHT: '#BAE6FD',
  PRIMARY_BG: '#EBF6FC',
  DARK_NAVY: '#0F172A',
  SLATE_700: '#334155',
  SLATE_500: '#64748B',
  SLATE_400: '#94A3B8',
  SLATE_200: '#E2E8F0',
  SURFACE: '#F8FAFC',
  WHITE: '#FFFFFF',
};

// ─────────────────────────────────────────────────────────
// Komponen Helper: BulletPoint
// ─────────────────────────────────────────────────────────
function BulletPoint({ number, text }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletNum}>{number}</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// Komponen Helper: SectionCard
// ─────────────────────────────────────────────────────────
function SectionCard({ icon, title, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderIcon}>{icon}</Text>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <View style={styles.cardBody}>
        {children}
      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════
// MAIN COMPONENT: KebijakanPrivasi
// ═════════════════════════════════════════════════════════
export default function KebijakanPrivasi({ navigation }) {
  const currentYear = new Date().getFullYear();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.WHITE} />

      {/* Header standar aplikasi */}
      <AppHeader
        title="Kebijakan Privasi"
        navigation={navigation}
        showBack={true}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Kepatuhan UU PDP */}
        <View style={styles.effectiveDate}>
          <Text style={styles.effectiveDateIcon}>🛡️</Text>
          <Text style={styles.effectiveDateText}>
            Sesuai UU No. 27 Tahun 2022 (UU PDP) • Berlaku: 27 Juli 2026
          </Text>
        </View>

        {/* 1. Pendahuluan & Dasar Hukum */}
        <SectionCard icon="📄" title="1. Pendahuluan & Dasar Hukum">
          <Text style={styles.bodyText}>
            Pemerintah Kabupaten Konawe Selatan, melalui{' '}
            <Text style={styles.bold}>Bagian Tata Pemerintahan Sekretariat Daerah</Text>,
            menghormati privasi Anda dan berkomitmen penuh melindungi data pribadi yang
            Anda berikan melalui aplikasi{' '}
            <Text style={styles.bold}>SIMBADA Mobile</Text>{' '}
            (Sistem Informasi Batas Desa). Kebijakan Privasi ini disusun sebagai wujud
            kepatuhan terhadap{' '}
            <Text style={styles.bold}>
              Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)
            </Text>.
          </Text>
          <Text style={[styles.bodyText, styles.mt8]}>
            Pemrosesan data pribadi Anda dilakukan oleh{' '}
            <Text style={styles.bold}>
              Dinas Komunikasi, Informatika dan Persandian Kabupaten Konawe Selatan
            </Text>{' '}
            selaku <Text style={styles.bold}>Pengendali Data Pribadi</Text>, berdasarkan:
          </Text>
          <BulletPoint
            number="a."
            text="Persetujuan tertulis/elektronik secara eksplisit dari Anda selaku Subjek Data Pribadi (Pasal 20 ayat 2 huruf a UU PDP)."
          />
          <BulletPoint
            number="b."
            text="Pelaksanaan tugas dalam rangka penyelenggaraan administrasi pemerintahan daerah, khususnya penetapan dan penegasan batas wilayah desa sesuai peraturan perundang-undangan yang berlaku (Pasal 20 ayat 2 huruf e UU PDP)."
          />
        </SectionCard>

        {/* 2. Kategori Data Pribadi */}
        <SectionCard icon="🗂️" title="2. Kategori Data Pribadi yang Dikumpulkan">
          <Text style={styles.sectionSubTitle}>A. Data Pribadi Bersifat Umum:</Text>
          <BulletPoint number="•" text="Nama lengkap pengguna (Operator Desa / Kecamatan / Kabupaten)." />
          <BulletPoint number="•" text="Alamat tempat tugas / domisili wilayah administrasi." />
          <BulletPoint number="•" text="Nomor telepon/WhatsApp aktif." />
          <BulletPoint number="•" text="Nama desa, kecamatan, dan kabupaten tempat bertugas." />

          <Text style={[styles.sectionSubTitle, styles.mt12]}>
            B. Data Pribadi Bersifat Spesifik (Risiko Tinggi):
          </Text>
          <BulletPoint
            number="•"
            text={
              <Text>
                <Text style={styles.bold}>NIK & Identitas Petugas:</Text> Nomor Induk Kependudukan untuk validasi identitas operator lapangan.
              </Text>
            }
          />
          <BulletPoint
            number="•"
            text={
              <Text>
                <Text style={styles.bold}>Data Koordinat Spasial (GPS):</Text> Koordinat geografis lintang-bujur dan ketinggian yang direkam saat survei lapangan batas desa (titik kartometrik, track lintasan batas, placemark titik referensi).
              </Text>
            }
          />
          <BulletPoint
            number="•"
            text={
              <Text>
                <Text style={styles.bold}>Data Foto Geotagging:</Text> Foto dokumentasi lapangan yang dilengkapi metadata lokasi dan waktu pengambilan (foto batas pilar, kenampakan alam, tanda batas wilayah).
              </Text>
            }
          />
          <BulletPoint
            number="•"
            text={
              <Text>
                <Text style={styles.bold}>Berkas Dokumen Legal:</Text> Dokumen usulan batas desa, Berita Acara kesepakatan batas, dan berkas pendukung (format PDF/KML/GPX) yang diunggah melalui fitur usulan.
              </Text>
            }
          />
        </SectionCard>

        {/* 3. Tujuan Penggunaan Data */}
        <SectionCard icon="⚙️" title="3. Tujuan Penggunaan Data">
          <BulletPoint
            number="a."
            text="Memverifikasi identitas dan kewenangan operator untuk menjamin keabsahan data batas wilayah yang diinput ke sistem."
          />
          <BulletPoint
            number="b."
            text="Memproses usulan penetapan dan penegasan batas desa, serta mendelegasikan dokumen ke instansi teknis terkait (Bagian Tapem Setda dan BPN/ATR)."
          />
          <BulletPoint
            number="c."
            text="Menyimpan dan mengelola data spasial batas wilayah desa sebagai arsip resmi digital Pemkab Konawe Selatan."
          />
          <BulletPoint
            number="d."
            text="Mengirimkan notifikasi terkait status verifikasi usulan batas desa kepada operator yang bersangkutan."
          />
          <BulletPoint
            number="e."
            text="Analisis statistik internal pemerintah daerah guna pemantauan progres penetapan batas desa seluruh wilayah Kabupaten Konawe Selatan (dalam bentuk data teranonimkan)."
          />
        </SectionCard>

        {/* 4. Keamanan Data */}
        <SectionCard icon="🔒" title="4. Keamanan Data & Perlindungan Sistem">
          <Text style={styles.bodyText}>
            Kami menerapkan langkah-langkah teknis dan organisasi yang ketat untuk menjaga
            kerahasiaan, keutuhan, dan ketersediaan data pribadi serta data spasial Anda
            di server lokal Pemerintah Kabupaten Konawe Selatan.
          </Text>
          <Text style={[styles.bodyText, styles.mt8]}>
            <Text style={styles.bold}>Pemberitahuan Kegagalan (Data Breach): </Text>
            Dalam hal terjadi kegagalan pelindungan data pribadi yang berdampak pada data
            Anda, kami berkomitmen mengirimkan pemberitahuan resmi dalam waktu maksimal{' '}
            <Text style={styles.bold}>3 x 24 jam</Text> kepada Anda dan Lembaga Regulator
            sesuai Pasal 46 UU PDP.
          </Text>
        </SectionCard>

        {/* 5. Masa Retensi Data */}
        <SectionCard icon="⏱️" title="5. Masa Retensi Data">
          <BulletPoint
            number="•"
            text="Data akun pengguna disimpan selama akun aktif dan diperlukan untuk penyelenggaraan layanan pemetaan batas desa."
          />
          <BulletPoint
            number="•"
            text="Data spasial (koordinat batas, track, placemark) yang telah diverifikasi resmi akan disimpan sebagai arsip permanen sesuai ketentuan kearsipan pemerintah daerah."
          />
          <BulletPoint
            number="•"
            text="Jika akun dihapus, data pribadi pengguna akan dihapus dari basis data operasional dalam waktu maksimal 30 hari kerja, kecuali data yang telah menjadi bagian dari dokumen resmi pemerintah."
          />
          <BulletPoint
            number="•"
            text="Akun yang tidak aktif selama 5 (lima) tahun berturut-turut akan dihapus oleh sistem dan data historisnya dianonimkan untuk keperluan kearsipan daerah."
          />
        </SectionCard>

        {/* 6. Transfer & Berbagi Data */}
        <SectionCard icon="🔄" title="6. Transfer dan Berbagi Data">
          <Text style={styles.bodyText}>
            Kami berkomitmen untuk <Text style={styles.bold}>tidak menjual, menyewakan,
            atau memperdagangkan</Text> data pribadi Anda kepada pihak ketiga.
          </Text>
          <Text style={[styles.bodyText, styles.mt8]}>
            Data hanya dibagikan secara terbatas kepada:
          </Text>
          <BulletPoint
            number="•"
            text="Organisasi Perangkat Daerah (OPD) internal Pemkab Konawe Selatan yang berwenang dalam proses penetapan dan penegasan batas desa."
          />
          <BulletPoint
            number="•"
            text="Instansi teknis terkait (BPN/ATR, Kemendagri) dalam rangka proses administrasi batas wilayah yang sah."
          />
          <BulletPoint
            number="•"
            text="Aparat penegak hukum demi pemenuhan kewajiban hukum yang sah berdasarkan putusan pengadilan atau peraturan perundang-undangan."
          />
        </SectionCard>

        {/* 7. Hak-Hak Subjek Data */}
        <SectionCard icon="👤" title="7. Hak Subjek Data Pribadi">
          <Text style={styles.bodyText}>
            Sesuai Pasal 5 hingga 13 UU PDP, Anda memiliki hak penuh untuk:
          </Text>
          <BulletPoint
            number="a."
            text="Mengakses, memperbarui, dan memperbaiki ketidakakuratan data pribadi Anda melalui menu profil akun."
          />
          <BulletPoint
            number="b."
            text="Meminta penundaan atau pembatasan pemrosesan data pribadi Anda."
          />
          <BulletPoint
            number="c."
            text="Mendapatkan salinan data pribadi dalam format elektronik yang lazim digunakan (Portabilitas Data)."
          />
          <BulletPoint
            number="d."
            text='Menarik kembali persetujuan dan meminta pemusnahan data pribadi dengan menghubungi administrator sistem.'
          />
        </SectionCard>

        {/* 8. Kontak PPDP */}
        <SectionCard icon="📞" title="8. Kontak Petugas Pelindung Data (PPDP)">
          <Text style={styles.bodyText}>
            Apabila Anda memiliki pertanyaan, keluhan, atau ingin mengajukan permohonan
            hak subjek data, hubungi Petugas Pelindung Data Pribadi (PPDP) kami:
          </Text>
          <BulletPoint
            number="•"
            text={
              <Text>
                Email: <Text style={styles.bold}>diskominfo@konaweselatankab.go.id</Text>
              </Text>
            }
          />
          <BulletPoint
            number="•"
            text="Telepon: Dinas Kominfo Kabupaten Konawe Selatan."
          />
          <BulletPoint
            number="•"
            text="Alamat: Dinas Komunikasi, Informatika dan Persandian Kabupaten Konawe Selatan, Kompleks Perkantoran Pemkab Konawe Selatan, Andoolo."
          />
        </SectionCard>

        {/* Footer */}
        <Text style={styles.footer}>
          © {currentYear} Pemerintah Kabupaten Konawe Selatan.{'\n'}
          Seluruh hak cipta dilindungi undang-undang.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.SURFACE,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 50,
  },

  // ── Banner UU PDP ──
  effectiveDate: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.PRIMARY_BG,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.PRIMARY_LIGHT,
  },
  effectiveDateIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  effectiveDateText: {
    fontSize: 11,
    color: C.PRIMARY_DARK,
    fontWeight: '700',
    flex: 1,
  },

  // ── Section Card ──
  card: {
    backgroundColor: C.WHITE,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.SLATE_200,
    shadowColor: C.DARK_NAVY,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.SLATE_200,
  },
  cardHeaderIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.PRIMARY_DARK,
    flex: 1,
  },
  cardBody: {
    padding: 14,
  },

  // ── Teks Konten ──
  sectionSubTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.DARK_NAVY,
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 20,
    textAlign: 'justify',
  },
  bold: {
    fontWeight: '700',
    color: C.DARK_NAVY,
  },
  mt8: {
    marginTop: 8,
  },
  mt12: {
    marginTop: 12,
  },

  // ── Bullet Point ──
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    marginTop: 2,
  },
  bulletNum: {
    fontSize: 13,
    fontWeight: '700',
    color: C.PRIMARY,
    minWidth: 22,
    paddingTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: '#444',
    lineHeight: 20,
    textAlign: 'justify',
  },

  // ── Footer ──
  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: C.SLATE_400,
    lineHeight: 18,
    paddingTop: 12,
    paddingBottom: 4,
  },
});
