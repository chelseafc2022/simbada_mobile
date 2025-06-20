//import liraries
import React, { Component, useEffect, useState } from 'react';
import styles from '../assets/style'
import { View, Text, TextInput, TouchableOpacity, ScrollView , ImageBackground, Alert} from 'react-native';
import FastImage from "react-native-fast-image";
import NetInfo from '@react-native-community/netinfo';

import { useSelector } from 'react-redux'
import { useIsFocused } from "@react-navigation/native";
import { Assets } from '@react-navigation/elements';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LIB from '../library/riswan'
import { useDispatch } from 'react-redux';
// import { Provider } from 'react-redux';


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
    console.log(URL.LOGIN_URL)
    SET_LOADING('true')
    SET_CHECK_LOAD(true);
    SET_ERROR_STATUS(false);
    SET_ERROR_MESSAGE('')
    saveDataToken('TOKEN', '')
    saveDataToken('PROFILE', '')


    console.log(form)
      // console.log(URL.LOGIN_URL)

      NetInfo.fetch().then(state => {
        if (!state.isConnected) {
            SET_LOADING('false');
            SET_CHECK_LOAD(false);
            SET_ERROR_STATUS(true);
            SET_ERROR_MESSAGE('No internet connection. Please check your network and try again.');
            Alert.alert('Connection Failed', 'No internet connection. Please check your network and try again.');

            return;
        }

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
          // SET_LOADING(false)
        SET_LOADING('false')
        console.log(response)
        if (response.ok) {
              SET_CHECK_LOAD(false);
              // console.log("sudah betul")
              return response.json();
              SET_LOADING('false')
          } 
          return response.json().then(error => {
              // console.log("sudah salah")
              SET_CHECK_LOAD(false)
              throw new Error(error.message);
              SET_LOADING('false')
          });
      })

      .then(async (res_data) => {
          console.log(res_data)

          // console.log(res_data)
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
            console.log('Status User:', profile.status_user);  // Debugging status user

            // Navigasi ke halaman sesuai status user
            if (profile.status_user === 1) {
                console.log('User adalah Administrator');
            } else if (profile.status_user === 4) {
                console.log('User adalah Operator Desa');
            } else {
                console.log('Status user tidak diketahui');
            }


          // appSettings.setString("profile", JSON.stringify(res_data.profile));
          saveFcmToken();
          navigation.navigate('Home')
          // console.log('Token adalah : '+TOKEN)

      })
      .catch(error => {
          // console.log('PESAN GAGAL :')
          console.log(error.message)
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

    // Ubah ini ke 1 menit (60000 ms) untuk pengujian cepat
    const EXPIRATION_TIME = 6 * 60 * 60 * 1000; // 6 jam
    // const EXPIRATION_TIME = 1 * 60 * 1000; // 1 menit

    const now = Date.now();

    if (!token || !lastLogin || (now - parseInt(lastLogin)) > EXPIRATION_TIME) {
        console.log("Token expired or invalid. Clearing AsyncStorage...");
        await AsyncStorage.removeItem("TOKEN");
        await AsyncStorage.removeItem("PROFILE");
        await AsyncStorage.removeItem("LAST_LOGIN");
        return;
    }
    // Alert.alert("Sesi Habis", "Anda telah logout otomatis karena tidak aktif terlalu lama.");

    // Jika masih aktif
    navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
    });
};


  const saveFcmToken = async () =>{

      await LIB.GetStorage();
      var fcmToken = await AsyncStorage.getItem('fcmToken')
      SET_FCM_TOKEN(fcmToken)

      fetch(URL.URL_UpdateToken + "add", {
          method: "POST",
          headers: {
              "content-type": "application/json",
              authorization: "kikensbatara " + TOKEN
          },
          body: JSON.stringify({
              token_fcm : FCM_TOKEN,
          })
      })
          .then(res => res.json())
          .then(res_data => {
              console.log(res_data)

      });

  }

  const storeAccount = async()=>{

      await LIB.GetStorage();
      checkToken();

      // await LIB.GetStorage();
      const storeUsername = await AsyncStorage.getItem('USERNAME')
      const storePassword = await AsyncStorage.getItem('PASSWORD')
      constchangeInput(storeUsername, 'username')
      constchangeInput(storePassword, 'password')
  }

     
     
     useEffect( () => {
      storeAccount();
      }, [isFocused]);


    return (

        <View style={{flex:1}}>

            <View style={styles.body}>

           

            <ImageBackground
        source={require('../assets/img/bg.png')}
        style={{height:'100%'}}
        resizeMode="cover"
      >
        
      <ScrollView>
        
        <FastImage 
            style={styles.gbrlogin}
            source={require('../assets/img/logo.jpeg')}
            resizeMode={FastImage.resizeMode.contain}
        />

        <View style={{marginTop : 20}}>
            <Text style={{fontWeight : 'bold', color : '#208DC0', textAlign : 'center', fontSize: 26}}>
                Selamat Datang !
            </Text>
        </View>

        {
              LOADING === 'true' &&
              (

                  <View style={{flex:1}}>
                      <View style={{justifyContent:'center', alignItems:'center'}}>
                          <FastImage
                              style={{ width: 100, height: 100, opacity: 0.5 }}
                              source={require('../assets/img/loading.gif')}
                              resizeMode={FastImage.resizeMode.contain}
                          />
                      </View>
                  </View>
              ) 
          }


        {
            LOADING === 'false' && 

            (
              <View>
        <View style={{marginTop : 10}}>

        {
              ErrorStatus == true && (
                  <View style={{marginBottom:10 ,color:'white', backgroundColor:'#E4555A', borderRadius:50, alignItems:'center', justifyContent:'center' }}>
                      <Text style={{paddingHorizontal:20, paddingVertical:5, color:'white', fontSize:10, fontWeight:'bold'}}>
                      {ErrorMessage}
                      </Text>
                  </View>

              )
          }
            
            <Text style={{color: 'black', fontSize:12, height: 'auto', width:'90%', marginTop:10, alignSelf:'center'}}>
                            Username    
            </Text>
            <TextInput
                style={styles.inputLogin}
                placeholderTextColor="#aaa" // Warna teks placeholder
                placeholder='Masukan Username'
                onChangeText={text => constchangeInput(text, 'username')}
                value={form.username}
            />
        </View>
        <View style={{marginTop : 10}}>
            
            <Text style={{color: 'black', fontSize:12, height: 'auto', width:'90%', marginTop:10, alignSelf:'center'}}>
                            Password    
            </Text>
            <TextInput
                style={styles.inputLogin}
                placeholderTextColor="#aaa" // Warna teks placeholder
                placeholder='Masukan Password'
                secureTextEntry={true}
                onChangeText={text => constchangeInput(text, 'password')}
                value={form.password}
            />
        </View>

        <View>
        <TouchableOpacity style={styles.addbatas} onPress={login}> 
                    <Text style={styles.addbatasx}>
                        Login
                    </Text>
                </TouchableOpacity>
        </View>

        <Text style={{color: '#aaa', fontSize:12, height: 'auto', width:'100%', marginTop:10, textAlign:'center'}}>
                            Copyright: Bagian Pemerintahan, Kab. Konawe Selatan    
        </Text>
        </View>
      )
      
      }

        
      </ScrollView>
      </ImageBackground>
      </View>

      </View>

    );

  };



//make this component available to the app
export default Login;
