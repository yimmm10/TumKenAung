// screens/CameraScreen.js
import React from 'react';
import { View, Button, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function CameraScreen({ navigation }) {
  const openCamera = async () => {
    // ขอสิทธิ์กล้อง
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('สิทธิ์ไม่พอ', 'แอปต้องการสิทธิ์เข้าถึงกล้อง');
      return;
    }

    // เปิดกล้อง
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      saveToPhotos: true,
    });

    console.log('Camera result:', result);
    // SDK ใหม่: result.canceled, result.assets = [ { uri, ... } ]
    if (!result.canceled && result.assets?.length > 0) {
      const uri = result.assets[0].uri;
      navigation.navigate('Preview', { photoUri: uri });
    }
  };

  return (
    <View style={styles.container}>
      <Button title="เปิดกล้อง" onPress={openCamera} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16,
  },
});
