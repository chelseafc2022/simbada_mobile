//import liraries
import React, { Component, useEffect, useState } from 'react';
import styles from '../assets/style'
import { View, Text, TextInput, TouchableOpacity, ScrollView , ImageBackground, Alert} from 'react-native';
import FastImage from "react-native-fast-image";
import Icon from 'react-native-vector-icons/Ionicons';
import NetInfo from '@react-native-community/netinfo';

import { useSelector } from 'react-redux'
import { useIsFocused } from "@react-navigation/native";
import { Assets } from '@react-navigation/elements';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LIB from '../library/riswan'
import { useDispatch } from 'react-redux';
import { Provider } from 'react-redux';
import { StyleSheet as RNStyleSheet, PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';

const loginStyles = RNStyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: '80%',
    height: 150,
    borderRadius: 30,
  },
  headerText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subHeaderText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 40,
  },
  formContainer: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
  },
  input: {
    flex: 1,
    color: '#0F172A',
    fontSize: 14,
  },
  loginBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  copyright: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 50,
  }
});

// create a component
const Login = ({navigation}) => {
    const dispatch = useDispatch();

    // const navigation = useNavigation();
    const Route = (routex)=>{
        navigation.navigate(routex)
    }

    const isFocused = useIsFocused();

    const token = useSelector(state => state.TOKEN);
      const PROFILE = useSelector(state => state.PROFILE);
      const URL = useSelector(state => state.URL);

    // const [TOKEN, SET_TOKEN] = useState('')
      // const [FCM_TOKEN, SET_FCM_TOKEN] = useState('')
    const [CheckLoad, SET_CHECK_LOAD] = useState(false)
    const [LOADING, SET_LOADING] = useState('false')
    const [ErrorMessage, SET_ERROR_MESSAGE] = useState('')
    const [ErrorStatus, SET_ERROR_STATUS] = useState(false)
    const [SAVE_PASSWORD, SET_SAVE_PASSWORD] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const saveUserNamePassword = () =>{
        if (SAVE_PASSWORD == true) {
            saveDataToken('USERNAME', form.username)
            saveDataToken('PASSWORD', form.password)
        } else {
            saveDataToken('USERNAME', '')
            saveDataToken('PASSWORD', '')
        }
    }

    

    const [form, SET_FORM] = useState({
        username : '',
        password : ''
    });

    const saveDataToken = async (key, val) => {
        await AsyncStorage.setItem(key, val)
    }

    const readDataToken = async (key) => {
        SET_TOKEN(await AsyncStorage.getItem(key))
    }

    const constchangeInput = async (val, objek) =>{
        SET_ERROR_STATUS(false)
        SET_FORM((prevState) => ({
            ...prevState,
            [objek]: val
        }));
        //  store.nama = val
    }

    const login = async () => {
    SET_LOADING('true')
    SET_CHECK_LOAD(true);
    SET_ERROR_STATUS(false);
    SET_ERROR_MESSAGE('')
    saveDataToken('TOKEN', '')
    saveDataToken('PROFILE', '')

      NetInfo.fetch().then(state => {
        if (!state.isConnected) {
            SET_LOADING('false');
            SET_CHECK_LOAD(false);
            SET_ERROR_STATUS(true);
            SET_ERROR_MESSAGE('No internet connection. Please check your network and try again.');
            Alert.alert('Connection Failed', 'No internet connection. Please check your network and try again.');
            return;
        }

        if (!form.username || !form.password) {
            SET_LOADING('false');
            SET_CHECK_LOAD(false);
            SET_ERROR_STATUS(true);
            SET_ERROR_MESSAGE('Silakan masukkan username dan password.');
            return;
        }

    console.log("LOGIN ATTEMPT URL:", URL?.LOGIN_URL, "form:", form);
    fetch(URL.LOGIN_URL, {
        method: "POST",
        headers: {
            Accept: 'application/json',
                "content-type": "application/json"
            },
            body: JSON.stringify({
                username : form.username,
                password : form.password,
              // VERSI_APP: VERSI_APP,
            })
        })
    .then((response)=>{
        console.log("LOGIN RESPONSE STATUS:", response.status, response.ok);
        SET_LOADING('false')
        if (response.ok) {
              SET_CHECK_LOAD(false);
              return response.json();
              SET_LOADING('false')
          } 
          return response.json().then(error => {
              SET_CHECK_LOAD(false)
              throw new Error(error.message);
              SET_LOADING('false')
          });
      })

      .then(async (res_data) => {
          console.log("LOGIN SUCCESS:", res_data);
          await saveDataToken('TOKEN', res_data.token)
          await saveDataToken('PROFILE', JSON.stringify(res_data.profile))
          await AsyncStorage.setItem('LAST_LOGIN', Date.now().toString()); /// coba implementasi login
          
          SET_ERROR_STATUS(false);
          
          readDataToken('TOKEN')
          AUTH_STAT = true
          await LIB.GetStorage();

          dispatch({ type: 'SET_TOKEN', payload: res_data.token })
          dispatch({ type: 'SET_PROFILE', payload: res_data.profile })
          SET_LOADING('false')
          saveUserNamePassword();

          const profile = JSON.parse(await AsyncStorage.getItem('PROFILE'));

          // appSettings.setString("profile", JSON.stringify(res_data.profile));
          saveFcmToken(res_data.token, res_data.profile.id);
          navigation.navigate('Home')
          // console.log('Token adalah : '+TOKEN)

      })
      .catch(error => {
          console.log("LOGIN CATCH ERROR FULL:", error, error.name, error.message, error.cause);
          SET_LOADING('false')
          SET_ERROR_MESSAGE(error.message)
          SET_ERROR_STATUS(true);
      });
      });
  }


// const checkToken = async () => {
//     const token = await AsyncStorage.getItem("TOKEN");
//     if (!token || token === '') {
//         // Kosong atau expired, tetap di halaman login
//         return;
//     }

//     // Jika token ada, arahkan ke home
//     navigation.reset({
//         index: 0,
//         routes: [{ name: 'Home' }],
//     });
// };


const checkToken = async () => {
    const token = await AsyncStorage.getItem("TOKEN");
    const lastLogin = await AsyncStorage.getItem("LAST_LOGIN");
    const profileStr = await AsyncStorage.getItem("PROFILE");

    // Ubah ini ke 1 menit (60000 ms) untuk pengujian cepat
    const EXPIRATION_TIME = 6 * 60 * 60 * 1000; // 6 jam
    // const EXPIRATION_TIME = 1 * 60 * 1000; // 1 menit

    const now = Date.now();

    if (!token || !lastLogin || (now - parseInt(lastLogin)) > EXPIRATION_TIME) {
        // console.log("Token expired or invalid. Clearing AsyncStorage...");
        await AsyncStorage.removeItem("TOKEN");
        await AsyncStorage.removeItem("PROFILE");
        await AsyncStorage.removeItem("LAST_LOGIN");
        return;
    }

    // ✅ KRITIS: Restore token & profile ke Redux agar semua modul bisa fetch data
    dispatch({ type: 'SET_TOKEN', payload: token });
    if (profileStr) {
        try {
            const profile = JSON.parse(profileStr);
            dispatch({ type: 'SET_PROFILE', payload: profile });
            // console.log('✅ Sesi dipulihkan dari penyimpanan lokal. Status User:', profile.status_user || profile.status);
        } catch (e) {
            console.error('Gagal parsing PROFILE dari AsyncStorage:', e);
        }
    }

    // Jika masih aktif, langsung masuk ke Home tanpa login ulang
    navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
    });
};


  const saveFcmToken = async (currentToken, userId) => {
      try {
          let enabled = false;

          // Untuk Android 13+ kita butuh PermissionsAndroid
          if (Platform.OS === 'android' && Platform.Version >= 33) {
              const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
              enabled = granted === PermissionsAndroid.RESULTS.GRANTED;
          } else {
              const authStatus = await messaging().requestPermission();
              enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
          }

          if (enabled || (Platform.OS === 'android' && Platform.Version < 33)) {
              const fcmToken = await messaging().getToken();
              console.log("FCM Token didapat:", fcmToken);

              fetch(URL.URL_PENGGUNA + "update-fcm", {
                  method: "POST",
                  headers: {
                      "content-type": "application/json",
                      authorization: "kikensbatara " + currentToken
                  },
                  body: JSON.stringify({
                      id: userId,
                      fcm_token : fcmToken,
                  })
              })
              .then(res => res.json())
              .then(res_data => {
                  console.log("FCM tersimpan ke DB:", res_data);
              })
              .catch(err => {
                  console.error("Gagal mengirim FCM ke DB:", err);
              });
          } else {
              console.log("User tidak mengizinkan notifikasi.");
          }
      } catch (error) {
          console.error("Error pada proses FCM Token:", error);
      }
  }

  const storeAccount = async()=>{

      await LIB.GetStorage();
      checkToken();

      const storeUsername = await AsyncStorage.getItem('USERNAME')
      const storePassword = await AsyncStorage.getItem('PASSWORD')
      if (storeUsername) {
          constchangeInput(storeUsername, 'username')
      }
      if (storePassword) {
          constchangeInput(storePassword, 'password')
      }
  }

     
     
     useEffect( () => {
      storeAccount();
      }, [isFocused]);


    return (
      <View style={{ flex: 1 }}>
        <ImageBackground
          source={require('../assets/img/bg.png')}
          style={{ height: '100%' }}
          resizeMode="cover"
        >
          <ScrollView contentContainerStyle={loginStyles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={loginStyles.logoContainer}>
            <FastImage 
              style={loginStyles.logo}
              source={require('../assets/img/logo.jpeg')}
              resizeMode={FastImage.resizeMode.contain}
            />
          </View>

          <View>
            <Text style={loginStyles.headerText}>Selamat Datang!</Text>
            <Text style={loginStyles.subHeaderText}>Masuk untuk melanjutkan ke SIMBADA</Text>
          </View>

          {LOADING === 'true' && (
            <View style={{ justifyContent: 'center', alignItems: 'center', marginTop: 20 }}>
              <FastImage
                style={{ width: 80, height: 80, opacity: 0.5 }}
                source={require('../assets/img/loading.gif')}
                resizeMode={FastImage.resizeMode.contain}
              />
            </View>
          )}

          {LOADING === 'false' && (
            <View style={loginStyles.formContainer}>
              {ErrorStatus === true && (
                <View style={loginStyles.errorBox}>
                  <Text style={loginStyles.errorText}>{ErrorMessage}</Text>
                </View>
              )}
              
              <View style={loginStyles.inputGroup}>
                <Text style={loginStyles.label}>Username</Text>
                <View style={loginStyles.inputWrapper}>
                  <TextInput
                    style={loginStyles.input}
                    placeholderTextColor="#94A3B8"
                    placeholder="Masukkan Username"
                    onChangeText={text => constchangeInput(text, 'username')}
                    value={form.username || ''}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={loginStyles.inputGroup}>
                <Text style={loginStyles.label}>Password</Text>
                <View style={loginStyles.inputWrapper}>
                  <TextInput
                    style={loginStyles.input}
                    placeholderTextColor="#94A3B8"
                    placeholder="Masukkan Password"
                    secureTextEntry={!showPassword}
                    onChangeText={text => constchangeInput(text, 'password')}
                    value={form.password || ''}
                  />
                  <TouchableOpacity 
                    onPress={() => setShowPassword(!showPassword)} 
                    style={{ padding: 5 }}
                  >
                    <Icon name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={22} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={loginStyles.loginBtn} onPress={login}>
                <Text style={loginStyles.loginBtnText}>Masuk</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={loginStyles.copyright}>
            Copyright: Bagian Pemerintahan, Kab. Konawe Selatan
          </Text>

        </ScrollView>
        </ImageBackground>
      </View>
    );

  };



//make this component available to the app
export default Login;
