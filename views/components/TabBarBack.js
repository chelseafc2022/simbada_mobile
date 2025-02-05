//import liraries
import React, {useState, useEffect} from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { useSelector } from 'react-redux'
import { useNavigation, useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';


import AutoHeightImage from 'react-native-auto-height-image';
import styles from '../assets/css/kiken'
import LIB from '../library/kiken'

// create a component
const TabBarBack = (props) => {

    const isFocused = useIsFocused();
    const navigation = useNavigation();
    const store = useSelector(state => state)

    const [FCM_TOKEN, SET_FCM_TOKEN] = useState('')


    const routex = ()=>{
        navigation.navigate(props.navx)
    }
    

    const saveDataToken = async (key, val) => {
        await AsyncStorage.setItem(key, val)
    }

    const logOut = ()=>{
        store.TOKEN = ''
        store.AUTH_STAT = 'false'
        saveDataToken('TOKEN', '')
        navigation.navigate('Login')
    }


    const checkLogin = ()=>{
        fetch(store.URL.URL_test_connections + "", {
            method: "GET",
            headers: {
                "content-type": "application/json",
                authorization: "kikensbatara " + store.TOKEN
            }
        })
            .then(res => res.json())
            .then(res_data => {
                console.log(res_data.message)
                if (res_data.message =='Tidak ter-Authorisasi') {
                    console.log("TIDAAAAAAAK");
                    store.TOKEN = ''
                    store.AUTH_STAT = 'false'
                    saveDataToken('TOKEN', '')


                    navigation.navigate('Login')
                    // return false
                } else {
                    
                }


        });





    }


    useEffect( () => {
        checkLogin();
    }, [isFocused]);

    return (
        <View style={styles.topBar}>

      

            <TouchableOpacity onPress={(()=>{routex()})} style={styles.topBarKiri}>
                <AutoHeightImage width={65} source={require('../assets/img/back.png')}/>
            </TouchableOpacity>

            <TouchableOpacity onPress={(()=>{logOut()})} style={styles.topBarKanan}>
                <Text>{props.back}</Text>
                <AutoHeightImage width={79} source={require('../assets/img/logout.png')}/>
            </TouchableOpacity>
        </View>
    );
};

// define your styles
// const styles = StyleSheet.create({
//     container: {
//         flex: 1,
//         justifyContent: 'center',
//         alignItems: 'center',
//         backgroundColor: '#2c3e50',
//     },
// });

//make this component available to the app
export default TabBarBack;
