//import liraries
import React, {useState, useEffect} from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { useSelector } from 'react-redux'
import { useNavigation, useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';


// import AutoHeightImage from 'react-native-auto-height-image';
import styles from '../assets/style'
import FastImage from 'react-native-fast-image';
// import LIB from '../library/kiken'

// create a component
const TabBar = (props) => {

    const Route = (routex)=>{
        navigation.navigate(routex)
      }

    const isFocused = useIsFocused();
    const navigation = useNavigation();
    // const store = useSelector(state => state)

    const [FCM_TOKEN, SET_FCM_TOKEN] = useState('')



    

    

    // const logOut = ()=>{
    //     store.TOKEN = ''
    //     store.AUTH_STAT = 'false'
    //     saveDataToken('TOKEN', '')
    //     navigation.navigate('Login')
    // }



    useEffect( () => {
        // checkLogin();
    }, [isFocused]);

    

    return (
        <View style={styles.nav}>
            
            <TouchableOpacity style={styles.navCol} onPress={()=>Route('Home')}>
                <FastImage 
                    style={{width: 24, height: 24}}
                    source={require('../assets/img/home.png')}
                    resizeMode={FastImage.resizeMode.contain}
                />
            </TouchableOpacity>

            <TouchableOpacity style={styles.navCol} onPress={() => navigation.navigate('Monitoring')}>
                <FastImage 
                    style={{width: 24, height: 24}}
                    source={require('../assets/img/map.png')}
                    resizeMode={FastImage.resizeMode.contain}
                />
            </TouchableOpacity>

            <TouchableOpacity style={styles.navCol} onPress={() => navigation.navigate('Usulan')}>
                <FastImage 
                    style={{width: 24, height: 24}}
                    source={require('../assets/img/titik.png')}
                    resizeMode={FastImage.resizeMode.contain}
                />
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCol}  onPress={() => navigation.navigate('PetaDasar')}>
                <FastImage 
                    style={{width: 24, height: 24}}
                    source={require('../assets/img/tanah.png')}
                    resizeMode={FastImage.resizeMode.contain}
                />
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCol} onPress={() => navigation.navigate('User')}>
                <FastImage 
                    style={{width: 24, height: 24}}
                    source={require('../assets/img/user.png')}
                    resizeMode={FastImage.resizeMode.contain}
                />
            </TouchableOpacity>

            </View>
    );
};


// define your styles
const stylesx = StyleSheet.create({
    tengah: {
        flex: 1,
    },
});

//make this component available to the app
export default TabBar;
