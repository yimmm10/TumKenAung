// screens/PreviewScreen.js
import React from 'react';
import { View, Image, StyleSheet, Button } from 'react-native';

export default function PreviewScreen({ route, navigation }) {
  const { photoUri } = route.params;

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: photoUri }}
        style={styles.image}
        resizeMode="contain"
      />
      <Button title="ถ่ายใหม่" onPress={() => navigation.replace('MainTabs', { screen: 'Camera' })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center',
  },
  image: {
    width: '100%', height: '80%',
  },
});
