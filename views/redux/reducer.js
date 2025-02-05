
import { buildTREFromConfig } from "react-native-render-html"

import AsyncStorage from '@react-native-async-storage/async-storage';

var URL = 'https://server-simbada.konaweselatankab.go.id/'; 
var URLX = 'https://server-simbada.konaweselatankab.go.id/'; 





const initialState = {
    VERSI_APP : '0.0.4',
    AUTH_STAT : 'true',
    URL: {
        URL_APP: URL,
        URL_APPX: URLX,
        LOGIN_URL: URL + "auth/login",
        URL_LIST_MONITORING : URL + "api/v1/monitoring/",
        URL_HOME : URL + "api/v1/web_home/",
        URL_KECAMATAN : URL + "api/v1/petadasarnew/",
        URL_ADD_ZONA : URL + "api/v1/web_zona_tanah/",
        URL_PENGGUNA : URL + "api/v1/pengguna/",
        URL_PETA_FINAL : URL + "api/v1/petafinal/"
        // URL_VIEW : URL + "api/v1/web_zona_tanah/",
        // URL_PETA_DASAR : URL + ""

    },


    AUTH_STAT : 'true',
    TOKEN   : 'xx',
    
}

// state = initialState artinya jika state belumpunya nilai maka setup awalnya initialState,,, jadi boleh juga di tulis begini (state, action)
const reducer = (state = initialState, action)=>{
    return state
}

// Simpan lokasi ke AsyncStorage
const saveLocations = async (locations) => {
  try {
      await AsyncStorage.setItem('locations', JSON.stringify(locations));
  } catch (error) {
      console.error("Error saving locations", error);
  }
};

// Ambil lokasi dari AsyncStorage
const getLocations = async () => {
  try {
      const locations = await AsyncStorage.getItem('locations');
      return locations != null ? JSON.parse(locations) : [];
  } catch (error) {
      console.error("Error getting locations", error);
      return [];
  }
};
const handleLogin = async (token, profile) => {
    try {
      await AsyncStorage.setItem('TOKEN', token);
      await AsyncStorage.setItem('PROFILE', JSON.stringify(profile));
  
      dispatch({ type: 'SET_TOKEN', payload: token });
      dispatch({ type: 'SET_PROFILE', payload: profile });
    } catch (error) {
      console.error('Gagal menyimpan data:', error);
    }
  };


export default reducer
