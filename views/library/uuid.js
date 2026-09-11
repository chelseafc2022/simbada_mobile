/**
 * Lightweight RFC4122 v4 compliant UUID generator for React Native
 * Tidak memerlukan node crypto atau react-native-get-random-values
 */
export const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export default uuidv4;
