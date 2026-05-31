/**
 * CompassView.js
 * Component kompas animasi yang menunjuk ke arah target
 * 
 * Props:
 * - heading: number - Heading device saat ini (derajat)
 * - bearing: number - Bearing ke target (derajat)
 * - distance: number - Jarak ke target (meter)
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

const CompassView = ({ heading = 0, bearing = 0, distance = 0 }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const arrowAnim = useRef(new Animated.Value(0)).current;

  // Rotasi kompas rose (berlawanan arah heading device)
  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: -heading,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [heading]);

  // Rotasi arrow ke arah target (bearing - heading)
  useEffect(() => {
    const arrowAngle = bearing - heading;
    Animated.timing(arrowAnim, {
      toValue: arrowAngle,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [heading, bearing]);

  const compassRotation = rotateAnim.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  const arrowRotation = arrowAnim.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  // Format jarak
  const formatDistance = (d) => {
    if (d >= 1000) {
      return `${(d / 1000).toFixed(2)} km`;
    }
    return `${Math.round(d)} m`;
  };

  return (
    <View style={styles.container}>
      {/* Compass Rose */}
      <Animated.View style={[styles.compassRose, { transform: [{ rotate: compassRotation }] }]}>
        {/* N, S, E, W markers */}
        <View style={styles.directionContainer}>
          <Text style={[styles.directionText, styles.north]}>N</Text>
          <Text style={[styles.directionText, styles.south]}>S</Text>
          <Text style={[styles.directionText, styles.east]}>E</Text>
          <Text style={[styles.directionText, styles.west]}>W</Text>
        </View>

        {/* Degree marks */}
        {[...Array(36)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.degreeMark,
              {
                transform: [
                  { rotate: `${i * 10}deg` },
                  { translateY: -110 },
                ],
              },
              i % 9 === 0 ? styles.majorMark : styles.minorMark,
            ]}
          />
        ))}

        {/* Compass circle */}
        <View style={styles.compassCircle}>
          <View style={styles.innerCircle} />
        </View>
      </Animated.View>

      {/* Direction Arrow (overlaid on top) */}
      <Animated.View style={[styles.arrowContainer, { transform: [{ rotate: arrowRotation }] }]}>
        <View style={styles.arrow} />
        <View style={styles.arrowPoint} />
      </Animated.View>

      {/* Center Info */}
      <View style={styles.centerInfo}>
        <Text style={styles.distanceText}>{formatDistance(distance)}</Text>
        <Text style={styles.bearingText}>{Math.round(bearing)}°</Text>
      </View>

      {/* Heading display */}
      <View style={styles.headingDisplay}>
        <Text style={styles.headingText}>Heading: {Math.round(heading)}°</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 280,
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  compassRose: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 3,
    borderColor: '#208DC0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(32, 141, 192, 0.05)',
  },
  directionContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  directionText: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#208DC0',
  },
  north: {
    top: 8,
    color: '#E74C3C',
    fontSize: 22,
    fontWeight: '900',
  },
  south: {
    bottom: 8,
  },
  east: {
    right: 12,
  },
  west: {
    left: 12,
  },
  degreeMark: {
    position: 'absolute',
    width: 2,
    backgroundColor: '#208DC0',
  },
  majorMark: {
    height: 15,
    width: 3,
    backgroundColor: '#208DC0',
  },
  minorMark: {
    height: 8,
    backgroundColor: 'rgba(32, 141, 192, 0.4)',
  },
  compassCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(32, 141, 192, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(32, 141, 192, 0.15)',
  },
  arrowContainer: {
    position: 'absolute',
    width: 40,
    height: 260,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  arrow: {
    width: 4,
    height: 90,
    backgroundColor: '#E74C3C',
    borderRadius: 2,
  },
  arrowPoint: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#E74C3C',
    marginTop: -10,
  },
  centerInfo: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 40,
    width: 80,
    height: 80,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#208DC0',
  },
  bearingText: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  headingDisplay: {
    position: 'absolute',
    bottom: -30,
    backgroundColor: 'rgba(32, 141, 192, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headingText: {
    fontSize: 12,
    color: '#208DC0',
    fontWeight: '600',
  },
});

export default CompassView;
