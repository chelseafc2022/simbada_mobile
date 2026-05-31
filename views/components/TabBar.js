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
    const NOTIFICATION_COUNT = useSelector(state => state.NOTIFICATION_COUNT);
    const IS_ONLINE = useSelector(state => state.IS_ONLINE);
    const OFFLINE_QUEUE_COUNT = useSelector(state => state.OFFLINE_QUEUE_COUNT);

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
            {/* Offline indicator */}
            {IS_ONLINE === false && (
              <View style={tabStyles.offlineDot} />
            )}
            
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
                {/* Offline queue badge */}
                {OFFLINE_QUEUE_COUNT > 0 && (
                  <View style={tabStyles.badge}>
                    <Text style={tabStyles.badgeText}>{OFFLINE_QUEUE_COUNT > 9 ? '9+' : OFFLINE_QUEUE_COUNT}</Text>
                  </View>
                )}
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
                {/* Notification badge */}
                {NOTIFICATION_COUNT > 0 && (
                  <View style={tabStyles.badge}>
                    <Text style={tabStyles.badgeText}>{NOTIFICATION_COUNT > 9 ? '9+' : NOTIFICATION_COUNT}</Text>
                  </View>
                )}
            </TouchableOpacity>

            </View>
    );
};


// define your styles
const tabStyles = StyleSheet.create({
    badge: {
        position: 'absolute',
        top: 5,
        right: 10,
        backgroundColor: '#F44336',
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 3,
    },
    badgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: 'bold',
    },
    offlineDot: {
        position: 'absolute',
        top: 3,
        left: '50%',
        marginLeft: -4,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF9800',
        zIndex: 10,
    },
});

//make this component available to the app
export default TabBar;
