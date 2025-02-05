/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';

import { store } from './views/redux';
import { Provider } from 'react-redux'
import {SafeAreaView,ScrollView,StyleSheet,Text,TouchableOpacity,useColorScheme,View,} from 'react-native';

import {Colors} from 'react-native/Libraries/NewAppScreen';


import { NavigationContainer, createStaticNavigation, useNavigation } from '@react-navigation/native';


import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Home from "./views/home/Home";
import Login from "./views/auth/Login";
import Monitoring from "./views/monitoring/Monitoring";
import Zona from "./views/monitoring/Zona";
import Perbandingan from "./views/monitoring/Perbandingan";
import Usulan from "./views/usulan_peta/Usulan";
import AddUsulan from "./views/usulan_peta/AddUsulan";
import EditUsulan from "./views/usulan_peta/EditUsulan";
import MetodeText from "./views/usulan_peta/MetodeText";
import User from "./views/user/User";
import PetaDasar from "./views/peta_dasar/PetaDasar";
import PetaFinal from "./views/peta_final/PetaFinal";
import LihatUsulan from "./views/usulan_peta/LihatUsulan";

const Stack = createNativeStackNavigator();
// const navigation = useNavigation();

// const Login = ()=>{
//   const navigation = useNavigation();

//   const Route = (routex)=>{
//     navigation.navigate(routex)
//   }

//   return (
//     <View>
//       <Text>Saya Login</Text>
//       <TouchableOpacity onPress={()=>Route('Home')}>
//         <Text>Click Saya untuk back ke Home</Text>
//       </TouchableOpacity>
//     </View>
//   )
// }

// const Home = ()=>{
//   const navigation = useNavigation();

//   const Route = (routex)=>{
//     navigation.navigate(routex)
//   }


//   return (
//     <View>
//       <Text>Saya Home</Text>
//       <TouchableOpacity onPress={()=>Route('Login')}>
//         <Text>
//           Click Saya untuk ke Login
//         </Text>
//       </TouchableOpacity>
//       {/* <TouchableOpacity onPress={() => navigation.navigate('Login')}>
//         <Text>
//           Click Saya untuk ke Login
//         </Text>
//       </TouchableOpacity> */}
//     </View>
//   )
// }




function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';


  return (
    <Provider store={store}>

    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Monitoring" component={Monitoring} />
        <Stack.Screen name="Zona" component={Zona} />
        <Stack.Screen name="MetodeText" component={MetodeText} />
        <Stack.Screen name="AddUsulan" component={AddUsulan} />
        <Stack.Screen name="EditUsulan" component={EditUsulan} />
        <Stack.Screen name="Perbandingan" component={Perbandingan} />
        <Stack.Screen name="Usulan" component={Usulan} />
        <Stack.Screen name="User" component={User} />
        <Stack.Screen name="PetaDasar" component={PetaDasar} />
        <Stack.Screen name="PetaFinal" component={PetaFinal} />
        <Stack.Screen name="LihatUsulan" component={LihatUsulan} />
      </Stack.Navigator>
    </NavigationContainer>
    </Provider>
  );
}

const styles = StyleSheet.create({
  
});

export default App;