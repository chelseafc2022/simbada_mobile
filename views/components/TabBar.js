//import liraries
import React, {useState, useEffect} from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { useSelector } from 'react-redux'
import { useNavigation, useIsFocused, useRoute } from '@react-navigation/native';
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

    

    const route = useRoute();
    const currentRoute = route.name;

    const isActive = (screenName) => currentRoute === screenName;
    const getTintColor = (screenName) => isActive(screenName) ? '#208DC0' : '#A0B2C6';

    return (
        <View style={tabStyles.container}>
            {/* Offline indicator */}
            {IS_ONLINE === false && (
              <View style={tabStyles.offlineDot} />
            )}
            <TouchableOpacity style={tabStyles.navCol} onPress={()=>Route('Home')}>
                <FastImage 
                    style={tabStyles.icon}
                    source={require('../assets/img/home.png')}
                    resizeMode={FastImage.resizeMode.contain}
                    tintColor={getTintColor('Home')}
                />
                {isActive('Home') && <View style={tabStyles.activeDot} />}
            </TouchableOpacity>

            <TouchableOpacity style={tabStyles.navCol} onPress={() => navigation.navigate('Monitoring')}>
                <FastImage 
                    style={tabStyles.icon}
                    source={require('../assets/img/map.png')}
                    resizeMode={FastImage.resizeMode.contain}
                    tintColor={getTintColor('Monitoring')}
                />
                {isActive('Monitoring') && <View style={tabStyles.activeDot} />}
            </TouchableOpacity>

            <TouchableOpacity style={tabStyles.navCol} onPress={() => navigation.navigate('Usulan')}>
                <View>
                    <FastImage 
                        style={tabStyles.icon}
                        source={require('../assets/img/titik.png')}
                        resizeMode={FastImage.resizeMode.contain}
                        tintColor={getTintColor('Usulan')}
                    />
                    {/* Offline queue badge */}
                    {OFFLINE_QUEUE_COUNT > 0 && (
                      <View style={tabStyles.badge}>
                        <Text style={tabStyles.badgeText}>{OFFLINE_QUEUE_COUNT > 9 ? '9+' : OFFLINE_QUEUE_COUNT}</Text>
                      </View>
                    )}
                </View>
                {isActive('Usulan') && <View style={tabStyles.activeDot} />}
            </TouchableOpacity>

            <TouchableOpacity style={tabStyles.navCol} onPress={() => navigation.navigate('PetaDasar')}>
                <FastImage 
                    style={tabStyles.icon}
                    source={require('../assets/img/tanah.png')}
                    resizeMode={FastImage.resizeMode.contain}
                    tintColor={getTintColor('PetaDasar')}
                />
                {isActive('PetaDasar') && <View style={tabStyles.activeDot} />}
            </TouchableOpacity>

            <TouchableOpacity style={tabStyles.navCol} onPress={() => navigation.navigate('User')}>
                <View>
                    <FastImage 
                        style={tabStyles.icon}
                        source={require('../assets/img/user.png')}
                        resizeMode={FastImage.resizeMode.contain}
                        tintColor={getTintColor('User')}
                    />
                    {/* Notification badge */}
                    {NOTIFICATION_COUNT > 0 && (
                      <View style={tabStyles.badge}>
                        <Text style={tabStyles.badgeText}>{NOTIFICATION_COUNT > 9 ? '9+' : NOTIFICATION_COUNT}</Text>
                      </View>
                    )}
                </View>
                {isActive('User') && <View style={tabStyles.activeDot} />}
            </TouchableOpacity>

        </View>
    );
};


// define your styles
const tabStyles = StyleSheet.create({
    container: {
        height: 65,
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        // Shadow modern iOS
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        // Elevation modern Android
        elevation: 15,
        borderTopWidth: 0,
    },
    navCol: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
    },
    icon: {
        width: 24, 
        height: 24,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#208DC0',
        marginTop: 6,
    },
    badge: {
        position: 'absolute',
        top: -5,
        right: -8,
        backgroundColor: '#F44336',
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 3,
        borderWidth: 1,
        borderColor: '#fff',
    },
    badgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: 'bold',
    },
    offlineDot: {
        position: 'absolute',
        top: 8,
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
