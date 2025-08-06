import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseconfig';
import styles from './SharedStyles';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigation = useNavigation();

  const handleLogin = async () => {
    try {
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);

      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (!userSnap.exists()) {
        throw new Error('ไม่พบข้อมูลผู้ใช้');
      }
      const { role } = userSnap.data();

      if (role === 'admin') {
        navigation.replace('Admin');    // AdminTabNavigator
      } else if (role === 'vendor') {
        navigation.replace('Vendor');   // VendorTabNavigator
      } else {
        navigation.replace('Main');     // MainTabNavigator (User)
      }

    } catch (err) {
      Alert.alert('Login Error', err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require('../assets/logo.png')} style={styles.logo} />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="อีเมล"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="รหัสผ่าน"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>ลงชื่อเข้าใช้</Text>
      </TouchableOpacity>
      <View style={styles.linksContainer}>
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.linkText}>ลงทะเบียน</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Forgot')}>
          <Text style={styles.linkText}>ลืมรหัสผ่าน?</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
