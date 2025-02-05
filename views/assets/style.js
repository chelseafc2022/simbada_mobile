//import liraries
import {StyleSheet} from 'react-native';

export default StyleSheet.create({
    
    body : {
        flex: 1,
        backgroundColor : 'white',
    },

    background: {
      flex:1,
      width: '100%',
    },
     backIcon: {
        width: 20,
        height: 20,
    },

    nav : {
        // position:'absolute',
        backgroundColor : '#208DC0',
        height : 50,
        width:'100%',
        borderTopLeftRadius : 10,
        borderTopRightRadius : 10,
        flexDirection: 'row',
        
    },
    navTop: {
      flexDirection: 'row',
      padding: 15,
      alignItems: 'center',
      backgroundColor: '#ffffff',
      elevation: 5,
  },

    top : {
        height : 50,
        width:'100%',
        alignItems: 'center',
        flexDirection: 'row',
        backgroundColor: '#208DC0',
        overflow: 'hidden', // Atur jika elemen memiliki sudut melengkung
    },
    top1 : {
        flex:1
    },
    top2 : {
      flex: 3,
      alignItems: 'center',
    },
    top3 : {
      flex: 1,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#208DC0',
  },

    navCol : {
        flex : 1,
        // borderWidth : 1,
        justifyContent : 'center',
        alignItems : 'center',

    },

    addbatas : {
        backgroundColor : '#208DC0',
        marginTop : 20,
        marginBottom : 20,
        width : '90%',
        height : 50,
        borderRadius : 30,
        alignSelf : 'center',
        justifyContent : 'center',
    },

    addbatasText : {
      backgroundColor : '#E7EBEB',
      marginTop : 20,
      marginLeft : 20,
      width : '20%',
      height : 30,
      borderRadius : 10,
      alignSelf : 'center',
      justifyContent : 'center',
      elevation:2,
      
  },

    addbatasxText : {
        color : 'black',
        textAlign : 'center',
    },
    addbatasx : {
        color : 'white',
        textAlign : 'center',
    },

    lihatPerbandingan : {
        backgroundColor : '#20C050',
        marginTop : 20,
        marginBottom : 20,
        width : '90%',
        height : 50,
        borderRadius : 30,
        alignSelf : 'center',
        justifyContent : 'center',
    },

    metodeText : {
        backgroundColor : '#26A69A',
        marginTop : 10,
        // marginLeft : 20,
        width : '20%',
        height : 30,
        borderRadius : 10,
        // alignSelf : 'left',
        // justifyContent : 'center',
    },
   
    metodeText : {
        backgroundColor : '#26A69A',
        marginTop : 10,
        // marginLeft : 20,
        width : '20%',
        height : 30,
        borderRadius : 10,
        justifyContent : 'center',
        alignItems : 'center',
        //shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,

    },
    metodeExcel : {
        backgroundColor : '#20bb47',
        marginTop : 10,
        marginLeft : '20%',
        width : '20%',
        height : 30,
        borderRadius : 10,
        justifyContent : 'center',
        alignItems : 'center',
    },
    metodeJson : {
        backgroundColor : '#f44336',
        borderWidth:1,
        marginTop : 10,
        marginLeft : '20%',
        width : '20%',
        height : 30,
        borderRadius : 10,
        // alignSelf : 'center',
        justifyContent : 'center',
        alignItems : 'center',
        // textAlign : 'left',
    },

    batas : {
        flex : 1,
        flexDirection: 'column',
        borderWidth : 1,
        borderColor : '#208DC0',
        marginTop : 10,
        width : '90%',
        height : 100,
        color : 'white',
        alignSelf : 'center',
        borderRadius : 10,
        flexDirection: 'row',
    },
    
    batasUser : {
        flex : 1,
        flexDirection: 'column',
        // borderWidth : 1,
        borderColor : '#E7EBEB',
        // marginTop :,
        height : 100,
        width : '90%',
        color : 'white',
        alignSelf : 'center',
        borderRadius : 10,
        flexDirection: 'row',
    },
    batasxUser : {
        flex: 1,
        flexDirection: 'column',
        width:'80%',
        height: '100%',
        justifyContent : 'center',
        // borderWidth : 1,
        
    },
    batasyUser : {
        width:'20%',
        height: '100%',
        // borderWidth : 1,
        alignItems : 'center',
        justifyContent : 'center',
    },
    batasx : {
        flex: 1,
        flexDirection: 'column',
        width:'80%',
        height: '100%',
        // borderWidth : 1,
        justifyContent : 'center',
        
    },
    
    batasy : {
        width:'20%',
        height: '100%',
        justifyContent : 'center',
        // borderWidth : 1,
        alignItems : 'center',
    },
    

    input: {
        marginTop : 5,
        width : '90%',
        alignSelf : 'center',
        height: 50,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 10,
        paddingHorizontal: 10,
        color: '#000', // Warna teks di dalam input
        backgroundColor: '#fff', // Latar belakang input
        fontSize: 12,
     
      },
      inputMetode: {
        marginTop : 5,
        width : '80%',
        alignSelf : 'center',
        height: 40,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 10,
        paddingHorizontal: 10,
        color: '#000', // Warna teks di dalam input
        backgroundColor: '#fff', // Latar belakang input
        fontSize: 12,
     
      },
      inputDoc: {
        alignSelf : 'center',
        width: '90%',
        height: 40,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 10,
        padding: 10,
        justifyContent: 'center',
        backgroundColor: '#fff',
        marginBottom: 20,
        paddingHorizontal: 10,
      },
    inputLogin: {
        marginTop : 5,
        width : '90%',
        alignSelf : 'center',
        height: 40,
        borderWidth: 1,
        borderColor: '#545454',
        borderRadius: 10,
        paddingHorizontal: 10,
        color: '#000', // Warna teks di dalam input
        // backgroundColor: '#fff', // Latar belakang input
        fontSize: 12,
        backgroundColor: 'transparent',
     
      },

      gbrlogin: {
        marginTop : '20%',
        marginLeft : '20%',
        marginRight : '20%',
        height : 150,
        width : '80%',
        borderRadius : 30,
        // justifyContent : 'center',
        alignSelf : 'center',
        
      },

      fontHome : {
        fontFamily: 'Poppins-ExtraBoldItalic',
        fontSize : 20,
        // fontWeight : 'bold',
        marginLeft : '5%',
        color : '#ffffff',
        
      },
      fontHomex : {
        // fontFamily : 'Poppins-Black',
        marginTop : -10,
        fontSize : 6,
        marginLeft : '5%',
        color : '#ffffff',

      },

    //   map: {
    //     ...StyleSheet.absoluteFillObject,
    //   },
      map: {
        ...StyleSheet.absoluteFillObject,
      },

      mapx : {
        borderWidth:0.4, 
        height:500, 
        width:'90%', 
        alignSelf:'center', 
        marginTop:20
      },
      mapxdasar : {
        borderWidth:0.4, 
        height:450, 
        width:'100%', 
        alignSelf:'center', 
      },
      mapxText : {
        borderWidth:0.4, 
        height:250, 
        width:'100%', 
        alignSelf:'center', 
      },
      mapDashboard : {
        borderWidth:0.4, 
        height:400, 
        width:'100%', 
        alignSelf:'center', 
        marginTop:20
      },

      topBar: {
        flex : 1,
        height : 35,
        // backgroundColor : 'pink',
        flexDirection : 'row'
    },

    topBarKanan : {
        flex : 1,
        justifyContent : "center",
        alignItems : 'flex-end',
        paddingRight : 12
    },
    topBarKiri : {
        flex : 1,
        justifyContent : "center",
        paddingLeft : 12

    },

    picker: {
      height: 50,
      backgroundColor: '#1BABEE',
      borderRadius: 8,
      marginTop : 5,
        width : '90%',
        alignSelf : 'center',
        borderWidth: 1,
        paddingHorizontal: 10,
        elevation:1
    },

    backIcon: {
      width: 20,
      height: 20,
  },

  searchInput: {
    height: 40,
    borderColor: '#208DC0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginVertical: 10,
    width : '90%',
    alignSelf : 'center',
    backgroundColor: '#FFF',
}
     




});
