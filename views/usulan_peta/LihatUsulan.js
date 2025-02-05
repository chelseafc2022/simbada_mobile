//import liraries
import React, { Component } from 'react';
import styles from '../assets/style'
import { View, Text, TouchableOpacity, ScrollView ,StyleSheet } from 'react-native';
import FastImage from "react-native-fast-image";
import MapView, { Marker } from 'react-native-maps';
import { Assets } from '@react-navigation/elements';

// create a component
const LihatUsulan = ({navigation}) => {
    const Route = (routex)=>{
        navigation.navigate(routex)
      }

      

    return (

        <View style={{flex:1}}>
            <View style={styles.navTop}>
                    <TouchableOpacity style={styles.top1} onPress={() => navigation.navigate('Monitoring')} >
                        <FastImage 
                            style={styles.backIcon}
                            source={require('../assets/img/chevron-left.png')}
                            resizeMode={FastImage.resizeMode.contain}
                        />
                    </TouchableOpacity>
                    
                    <View style={styles.top2}>
                    <Text style={styles.headerTitle}>
                        Lihat Usulan
                        </Text>
                    </View>

                    <View style={styles.top3}>
                        <Text>
                            
                        </Text>
                    </View>

                </View>
            
            <ScrollView style={styles.body}>
              <Text style={{
                color: '#208DC0', 
                fontWeight:'bold', 
                fontSize:12, 
                height: 'auto', 
                width:'90%', 
                marginTop:20, 
                alignSelf:'center'}}>

                Zona Batas Tanah 
            </Text>
              <Text style={{
                color: '#98A9B9', 
                fontWeight:'bold', 
                fontSize:12, 
                height: 'auto', 
                width:'90%', 
                marginTop:10, 
                alignSelf:'center'}}>

                Kecamatan XXXXXX - Desa XXXXX
            </Text>

            


            

            <View style={styles.mapx}>
                <MapView
                    style={styles.map}
                    provider="google"
                    initialRegion={{
                    latitude: -6.200000, // Latitude awal (contoh: Jakarta)
                    longitude: 106.816666, // Longitude awal
                    latitudeDelta: 0.0922, // Zoom level
                    longitudeDelta: 0.0421,
                    }}
                >
                    {/* Marker */}
                    <Marker
                    coordinate={{
                        latitude: -6.200000,
                        longitude: 106.816666,
                    }}
                    title="Lokasi"
                    description="Deskripsi Lokasi"
                    />
                </MapView>

            </View>
            
            
            

           </ScrollView>








           {/* ============================================= */}


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
            
           
        
        </View>





    //     <View style={styles.biru}>

    //    <TouchableOpacity onPress={() => navigation.navigate('Login')}>
    //     <Text>
    //       Click Saya untuk ke Login
    //     </Text>
    //   </TouchableOpacity>
    //     </View>
    );
};

// const styles = StyleSheet.create({
//     container: {
//       flex: 1,
//     },
//     map: {
//       ...StyleSheet.absoluteFillObject,
//     },
//   });




//make this component available to the app
export default LihatUsulan;
