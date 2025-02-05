//import liraries
import React, { Component } from 'react';
import styles from '../assets/style'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import FastImage from "react-native-fast-image";

import MapView, { Marker } from 'react-native-maps';
import TabBar from '../components/TabBar'
import { Assets } from '@react-navigation/elements';

// create a component
const Perbandingan = ({navigation}) => {
    const Route = (routex)=>{
        navigation.navigate(routex)
      }


    return (

        <View style={{flex:1}}>
            <View style={styles.navTop}>
                    <TouchableOpacity style={styles.top1} onPress={() => navigation.goBack()} >
                        <FastImage 
                            style={{width: 12, height: 12}}
                            source={require('../assets/img/chevron-left.png')}
                            resizeMode={FastImage.resizeMode.contain}
                        />
                    </TouchableOpacity>
                    
                    <View style={styles.top2}>
                        <Text style={{color:'#208DC0'}}>
                        Perbandingan Zona Batas
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

            <Text style={{
                color: '#208DC0', 
                fontWeight:'bold', 
                fontSize:16, 
                height: 'auto', 
                width:'90%', 
                marginTop:20, 
                alignSelf:'center'}}>

                Perbandingan
            </Text>


            <View style={styles.mapx}>
                <MapView
                    style={styles.map}
                    provider="google"
                    initialRegion={{
                        latitude: -4.3332916,
                        longitude: 122.2788887,
                    latitudeDelta: 0.0922, // Zoom level
                    longitudeDelta: 0.0421,
                    }}
                >
                    {/* Marker */}
                    <Marker
                    coordinate={{
                        latitude: -4.3332916,
                            longitude: 122.2788887,
                    }}
                    title="Lokasi"
                    description="Deskripsi Lokasi"
                    />
                </MapView>

            </View>

           </ScrollView>

           {/* ============================================= */}


           <TabBar/>
            
           
        
        </View>



    );
};



//make this component available to the app
export default Perbandingan;
