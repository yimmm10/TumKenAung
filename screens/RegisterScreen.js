// screens/RegisterScreen.js
import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseconfig';

export default function RegisterScreen() {
  const navigation = useNavigation();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [username, setUsername]   = useState('');
  const [role, setRole]           = useState('user'); // ← state สำหรับเลือก Role

  const handleRegister = async () => {
    if (!email || !password || !username) {
      return Alert.alert('กรุณากรอกข้อมูลให้ครบ');
    }
    try {
      // 1. สร้างบัญชี Auth
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid  = cred.user.uid;

      // 2. บันทึกข้อมูลลง Firestore (collection users)
      await setDoc(doc(db, 'users', uid), {
        username:  username.trim(),
        email:     email.trim(),
        role,                                  // ← บันทึก role ตามที่เลือก
        createdAt: serverTimestamp(),
      });

      Alert.alert('สมัครสำเร็จ', `สมัครเป็น ${role === 'user' ? 'ผู้ใช้' : 'ร้านค้า'} เรียบร้อย`);
      navigation.replace('Login');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>สร้างบัญชีใหม่</Text>

        <Text style={styles.label}>อีเมล</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>รหัสผ่าน</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>ชื่อผู้ใช้</Text>
        <TextInput
          style={styles.input}
          placeholder="ชื่อที่จะแสดง"
          value={username}
          onChangeText={setUsername}
        />

        <Text style={styles.label}>ลงทะเบียนเป็น</Text>
        <View style={styles.roleContainer}>
         <TouchableOpacity
           style={[
             styles.roleBtn,
             role === 'user' && styles.roleBtnActive
           ]}
           onPress={() => setRole('user')}
         >
           <Text
             style={[
              styles.roleText,
               role === 'user' && styles.roleTextActive
             ]}
           >ผู้ใช้ทั่วไป</Text>
         </TouchableOpacity>

         <TouchableOpacity
           style={[
             styles.roleBtn,
             role === 'vendor' && styles.roleBtnActive
           ]}
           onPress={() => setRole('vendor')}
         >
           <Text
             style={[
              styles.roleText,
               role === 'vendor' && styles.roleTextActive
             ]}
           >ร้านค้า</Text>
         </TouchableOpacity>
       </View>

        <TouchableOpacity style={styles.button} onPress={handleRegister}>
          <Text style={styles.buttonText}>ลงทะเบียน</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#425010',
  },
  container: {
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    color: '#Ffff',
  },
  label: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 14,
    color: '#fff',
  },
  roleContainer: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   marginBottom: 24,
 },
 roleBtn: {
   flex: 1,
   paddingVertical: 12,
   borderWidth: 1,
   borderColor: '#ddd',
   borderRadius: 6,
   marginHorizontal: 4,
   alignItems: 'center',
   backgroundColor: '#fff',
 },
 roleBtnActive: {
   backgroundColor: '#769128',
   borderColor: '#769128',
 },
 roleText: {
   fontSize: 16,
   color: '#555',
 },
 roleTextActive: {
   color: '#fff',
   fontWeight: '600',
 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 24,
  },
  picker: {
    height: 44,
    width: '100%',
  },
  button: {
    backgroundColor: '#FFA920',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    textAlign: 'center',
    color: '#FBDB58',
    marginTop: 8,
  },
});
