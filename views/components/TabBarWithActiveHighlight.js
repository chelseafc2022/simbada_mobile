import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const TabBarWithActiveHighlight = ({ navigation, tabs }) => {
    const [activeTab, setActiveTab] = useState(tabs[0].route);  // Tab aktif awal

    const handleTabPress = (route) => {
        setActiveTab(route);  // Ubah tab aktif
        navigation.navigate(route);  // Navigasi ke tab tersebut
    };

    return (
        <View style={styles.tabBarContainer}>
            {tabs.map((tab, index) => (
                <TouchableOpacity key={index} onPress={() => handleTabPress(tab.route)}>
                    <View style={[
                        styles.tabItem,
                        activeTab === tab.route ? styles.activeTab : styles.inactiveTab
                    ]}>
                        <Icon
                            name={tab.icon}
                            size={24}
                            color={activeTab === tab.route ? '#ffffff' : '#208DC0'}
                        />
                        <Text style={activeTab === tab.route ? styles.activeTabText : styles.inactiveTabText}>
                            {tab.label}
                        </Text>
                    </View>
                </TouchableOpacity>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    tabBarContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 10,
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderColor: '#dddddd',
    },
    tabItem: {
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 15,
    },
    activeTab: {
        backgroundColor: '#208DC0',
        borderRadius: 15,
    },
    inactiveTab: {
        backgroundColor: '#f0f0f0',
    },
    activeTabText: {
        color: '#ffffff',
        fontWeight: 'bold',
    },
    inactiveTabText: {
        color: '#208DC0',
        fontWeight: 'bold',
    },
    activeIndicator: {
        width: 30,
        height: 3,
        backgroundColor: '#ffffff',
        marginTop: 5,
        borderRadius: 2,
    },
});

export default TabBarWithActiveHighlight;
