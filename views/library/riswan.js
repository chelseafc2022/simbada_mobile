


import React from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ImageBackground } from 'react-native'
import useSelector  from '../redux/reducer'
import AsyncStorage from '@react-native-async-storage/async-storage';


var store = useSelector();



const GetStorage = async () => {
  try {
    const token = await AsyncStorage.getItem('TOKEN');
    const profileku = await AsyncStorage.getItem('PROFILE');

    store.TOKEN = token;

    if (token && profileku) {
      store.AUTH_STAT = true; // Token valid

      // Parse JSON profile sebelum disimpan ke Redux
      const parsedProfile = JSON.parse(profileku);
      store.PROFILE = parsedProfile;

      // Ambil status user dari profile.profile.status
      const userStatus = parsedProfile.profile?.status;
      console.log('Status User:', userStatus); // Debug status

      // Simpan status ke Redux (opsional)
      store.USER_STATUS = userStatus;
    } else {
      store.AUTH_STAT = false; // Token kosong atau null
    }
  } catch (error) {
    console.error('Error getting storage:', error);
    store.AUTH_STAT = false;
  }
};




module.exports = {

    // kelamin : kelamin,
    GetStorage : GetStorage,

}