// import pustaka
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Switch,
  ActivityIndicator,
  StyleSheet as RNStyleSheet,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';
import { useSelector, useDispatch } from 'react-redux';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import messaging from '@react-native-firebase/messaging';
import LIB from '../library/riswan';

// Komponen Utama Login
const Login = ({ navigation }) => {
  const dispatch = useDispatch();
  const isFocused = useIsFocused();

  const token = useSelector((state) => state.TOKEN);
  const PROFILE = useSelector((state) => state.PROFILE);
  const URL = useSelector((state) => state.URL);

  const [CheckLoad, SET_CHECK_LOAD] = useState(false);
  const [LOADING, SET_LOADING] = useState('false');
  const [ErrorMessage, SET_ERROR_MESSAGE] = useState('');
  const [ErrorStatus, SET_ERROR_STATUS] = useState(false);
  const [SAVE_PASSWORD, SET_SAVE_PASSWORD] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const [form, SET_FORM] = useState({
    username: '',
    password: '',
  });

  const saveDataToken = async (key, val) => {
    await AsyncStorage.setItem(key, val);
  };

  const readDataToken = async (key) => {
    return await AsyncStorage.getItem(key);
  };

  const saveUserNamePassword = () => {
    if (SAVE_PASSWORD === true) {
      saveDataToken('USERNAME', form.username);
      saveDataToken('PASSWORD', form.password);
    } else {
      saveDataToken('USERNAME', '');
      saveDataToken('PASSWORD', '');
    }
  };

  const constchangeInput = async (val, objek) => {
    SET_ERROR_STATUS(false);
    SET_FORM((prevState) => ({
      ...prevState,
      [objek]: val,
    }));
  };

  const login = async () => {
    SET_LOADING('true');
    SET_CHECK_LOAD(true);
    SET_ERROR_STATUS(false);
    SET_ERROR_MESSAGE('');
    saveDataToken('TOKEN', '');
    saveDataToken('PROFILE', '');

    NetInfo.fetch().then((state) => {
      if (!state.isConnected) {
        SET_LOADING('false');
        SET_CHECK_LOAD(false);
        SET_ERROR_STATUS(true);
        SET_ERROR_MESSAGE('Tidak ada koneksi internet. Silakan periksa jaringan Anda.');
        Alert.alert(
          'Koneksi Gagal',
          'Tidak ada koneksi internet. Silakan periksa jaringan Anda dan coba lagi.'
        );
        return;
      }

      if (!form.username || !form.password) {
        SET_LOADING('false');
        SET_CHECK_LOAD(false);
        SET_ERROR_STATUS(true);
        SET_ERROR_MESSAGE('Silakan masukkan username dan password.');
        return;
      }

      console.log('LOGIN ATTEMPT URL:', URL?.LOGIN_URL, 'form:', form);
      fetch(URL.LOGIN_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
        }),
      })
        .then((response) => {
          console.log('LOGIN RESPONSE STATUS:', response.status, response.ok);
          SET_LOADING('false');
          if (response.ok) {
            SET_CHECK_LOAD(false);
            return response.json();
          }
          return response.json().then((error) => {
            SET_CHECK_LOAD(false);
            throw new Error(error.message || 'Login gagal, periksa kredensial Anda.');
          });
        })
        .then(async (res_data) => {
          console.log('LOGIN SUCCESS:', res_data);
          await saveDataToken('TOKEN', res_data.token);
          await saveDataToken('PROFILE', JSON.stringify(res_data.profile));
          await AsyncStorage.setItem('LAST_LOGIN', Date.now().toString());

          SET_ERROR_STATUS(false);
          await LIB.GetStorage();

          dispatch({ type: 'SET_TOKEN', payload: res_data.token });
          dispatch({ type: 'SET_PROFILE', payload: res_data.profile });
          SET_LOADING('false');
          saveUserNamePassword();

          saveFcmToken(res_data.token, res_data.profile.id);
          navigation.navigate('Home');
        })
        .catch((error) => {
          console.log('LOGIN ERROR:', error.message);
          SET_LOADING('false');
          SET_ERROR_MESSAGE(error.message || 'Terjadi kesalahan saat masuk');
          SET_ERROR_STATUS(true);
        });
    });
  };

  const checkToken = async () => {
    const token = await AsyncStorage.getItem('TOKEN');
    const lastLogin = await AsyncStorage.getItem('LAST_LOGIN');
    const profileStr = await AsyncStorage.getItem('PROFILE');

    const EXPIRATION_TIME = 6 * 60 * 60 * 1000; // 6 jam
    const now = Date.now();

    if (!token || !lastLogin || now - parseInt(lastLogin, 10) > EXPIRATION_TIME) {
      await AsyncStorage.removeItem('TOKEN');
      await AsyncStorage.removeItem('PROFILE');
      await AsyncStorage.removeItem('LAST_LOGIN');
      return;
    }

    dispatch({ type: 'SET_TOKEN', payload: token });
    if (profileStr) {
      try {
        const profile = JSON.parse(profileStr);
        dispatch({ type: 'SET_PROFILE', payload: profile });
      } catch (e) {
        console.error('Gagal parsing PROFILE dari AsyncStorage:', e);
      }
    }

    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const saveFcmToken = async (currentToken, userId) => {
    try {
      let enabled = false;

      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        enabled = granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const authStatus = await messaging().requestPermission();
        enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      }

      if (enabled || (Platform.OS === 'android' && Platform.Version < 33)) {
        const fcmToken = await messaging().getToken();
        console.log('FCM Token didapat:', fcmToken);

        fetch(URL.URL_PENGGUNA + 'update-fcm', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: 'kikensbatara ' + currentToken,
          },
          body: JSON.stringify({
            id: userId,
            fcm_token: fcmToken,
          }),
        })
          .then((res) => res.json())
          .then((res_data) => {
            console.log('FCM tersimpan ke DB:', res_data);
          })
          .catch((err) => {
            console.error('Gagal mengirim FCM ke DB:', err);
          });
      }
    } catch (error) {
      console.error('Error pada proses FCM Token:', error);
    }
  };

  const storeAccount = async () => {
    await LIB.GetStorage();
    checkToken();

    const storeUsername = await AsyncStorage.getItem('USERNAME');
    const storePassword = await AsyncStorage.getItem('PASSWORD');
    if (storeUsername) {
      constchangeInput(storeUsername, 'username');
    }
    if (storePassword) {
      constchangeInput(storePassword, 'password');
    }
  };

  useEffect(() => {
    storeAccount();
  }, [isFocused]);

  return (
    <View style={ui.screenContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F9FF" />

      <ScrollView
        contentContainerStyle={ui.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ======================================================== */}
        {/* 1. LOGO & BRANDING HEADER                                */}
        {/* ======================================================== */}
        <View style={ui.brandingContainer}>
          <View style={ui.logoWrapper}>
            <FastImage
              style={ui.logo}
              source={require('../assets/img/logo.jpeg')}
              resizeMode={FastImage.resizeMode.contain}
            />
          </View>
          <Text style={ui.appTitle}>SIMBADA</Text>
          <Text style={ui.appSubtitle}>SISTEM INFORMASI BATAS DESA</Text>
          <Text style={ui.appTagline}>Kabupaten Konawe Selatan</Text>
        </View>

        {/* ======================================================== */}
        {/* 2. FORM KARTU LOGIN                                      */}
        {/* ======================================================== */}
        <View style={ui.formCard}>
          <Text style={ui.cardTitle}>Selamat Datang!</Text>
          <Text style={ui.cardSubtitle}>
            Silakan masuk dengan akun terdaftar untuk mengakses layanan survei & batas desa
          </Text>

          {/* Kotak Error Notifikasi */}
          {ErrorStatus === true && (
            <View style={ui.errorBox}>
              <Icon name="alert-circle-outline" size={20} color="#DC2626" style={{ marginRight: 8 }} />
              <Text style={ui.errorText}>{ErrorMessage}</Text>
            </View>
          )}

          {/* Input Username */}
          <View style={ui.inputGroup}>
            <Text style={ui.label}>Username</Text>
            <View
              style={[
                ui.inputWrapper,
                focusedField === 'username' && ui.inputWrapperFocused,
              ]}
            >
              <Icon
                name="person-outline"
                size={20}
                color={focusedField === 'username' ? '#0284C7' : '#94A3B8'}
                style={ui.inputIcon}
              />
              <TextInput
                style={ui.input}
                placeholderTextColor="#94A3B8"
                placeholder="Masukkan username Anda"
                onChangeText={(text) => constchangeInput(text, 'username')}
                value={form.username || ''}
                autoCapitalize="none"
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* Input Password */}
          <View style={ui.inputGroup}>
            <Text style={ui.label}>Password</Text>
            <View
              style={[
                ui.inputWrapper,
                focusedField === 'password' && ui.inputWrapperFocused,
              ]}
            >
              <Icon
                name="lock-closed-outline"
                size={20}
                color={focusedField === 'password' ? '#0284C7' : '#94A3B8'}
                style={ui.inputIcon}
              />
              <TextInput
                style={ui.input}
                placeholderTextColor="#94A3B8"
                placeholder="Masukkan password Anda"
                secureTextEntry={!showPassword}
                onChangeText={(text) => constchangeInput(text, 'password')}
                value={form.password || ''}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={ui.eyeBtn}
                activeOpacity={0.7}
              >
                <Icon
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Switch Simpan Password */}
          <View style={ui.rememberRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon name="shield-checkmark-outline" size={18} color="#0284C7" style={{ marginRight: 6 }} />
              <Text style={ui.rememberText}>Simpan Password</Text>
            </View>
            <Switch
              value={SAVE_PASSWORD}
              onValueChange={(val) => SET_SAVE_PASSWORD(val)}
              trackColor={{ false: '#CBD5E1', true: '#BAE6FD' }}
              thumbColor={SAVE_PASSWORD ? '#0284C7' : '#F8FAFC'}
            />
          </View>

          {/* Tombol CTA Masuk */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={login}
            disabled={LOADING === 'true'}
            style={ui.loginBtnContainer}
          >
            <LinearGradient
              colors={['#0284C7', '#0369A1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={ui.loginBtn}
            >
              {LOADING === 'true' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={ui.loginBtnText}>Memverifikasi...</Text>
                </View>
              ) : (
                <Text style={ui.loginBtnText}>Masuk</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ======================================================== */}
        {/* 3. FOOTER COPYRIGHT                                      */}
        {/* ======================================================== */}
        <Text style={ui.copyright}>
          © 2026 Bagian Pemerintahan, Kab. Konawe Selatan
        </Text>
      </ScrollView>
    </View>
  );
};

// ================================================================
// DESIGN SYSTEM STYLING — Geo-Sapphire & Emerald Field
// ================================================================
const ui = RNStyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F0F9FF', // Token: --color-bg-primary
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 30,
    justifyContent: 'center',
  },

  // BRANDING
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWrapper: {
    width: 140,
    height: 75,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#0C4A6E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0C4A6E', // Token: --color-text-heading
    letterSpacing: 1,
  },
  appSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7', // Token: --color-primary
    letterSpacing: 1.5,
    marginTop: 2,
  },
  appTagline: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },

  // FORM CARD
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    elevation: 4,
    shadowColor: '#0C4A6E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 20,
  },

  // ERROR BOX
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },

  // INPUTS
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '700',
    marginBottom: 6,
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputWrapperFocused: {
    borderColor: '#0284C7',
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '500',
  },
  eyeBtn: {
    padding: 6,
  },

  // REMEMBER SWITCH
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  rememberText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },

  // BUTTON CTA
  loginBtnContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  loginBtn: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // COPYRIGHT
  copyright: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 30,
  },
});

export default Login;
