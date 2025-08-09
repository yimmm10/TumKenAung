import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform, ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { getAuth, onAuthStateChanged, updateProfile, signOut } from 'firebase/auth';
import { db, storage } from '../../firebaseconfig'; // ปรับ path ให้ตรงโปรเจกต์คุณ
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const auth = getAuth();
  const [uid, setUid] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // fields
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [email, setEmail] = useState('');

  const [editMode, setEditMode] = useState(false);

  // โหลดข้อมูล user (Auth + Firestore)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        Alert.alert('ยังไม่ได้ล็อกอิน', 'กรุณาเข้าสู่ระบบก่อน');
        return;
      }
      setUid(user.uid);
      setEmail(user.email ?? '');
      try {
        // 1) เอาค่าจาก Auth มาก่อน
        setDisplayName(user.displayName ?? '');
        setPhotoURL(user.photoURL ?? '');

        // 2) ดึงโปรไฟล์ใน Firestore (ถ้าไม่มีจะสร้าง)
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email ?? '',
            displayName: user.displayName ?? '',
            photoURL: user.photoURL ?? '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            role: 'user'
          });
        } else {
          const data = snap.data();
          if (data?.displayName) setDisplayName(data.displayName);
          if (data?.photoURL) setPhotoURL(data.photoURL);
        }
      } catch (e) {
        console.log(e);
        Alert.alert('ดึงข้อมูลไม่สำเร็จ', e.message);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const requestImagePermission = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('ต้องการสิทธิ์เข้าถึงรูปภาพ', 'โปรดอนุญาตการเข้าถึงรูปภาพเพื่ออัปโหลดรูปโปรไฟล์');
        return false;
      }
    }
    return true;
  };

  const pickAndUploadImage = async () => {
    try {
      const ok = await requestImagePermission();
      if (!ok) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      setSaving(true);

      // อัปโหลดรูป -> Storage (ทับไฟล์เดิม)
      const url = await uploadImageToStorage(asset.uri, `users/${uid}/profile.jpg`);
      // อัปเดต Auth + Firestore
      await applyPhotoURL(url);

      setPhotoURL(url);
      Alert.alert('สำเร็จ', 'เปลี่ยนรูปโปรไฟล์แล้ว');
    } catch (e) {
      console.log(e);
      Alert.alert('อัปโหลดรูปไม่สำเร็จ', e.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadImageToStorage = async (uri, path) => {
    const res = await fetch(uri);
    const blob = await res.blob();

    const storageRef = ref(storage, path); // ใช้ชื่อคงที่ทับรูปเดิม (profile.jpg)
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  };

  const applyPhotoURL = async (url) => {
    const user = auth.currentUser;
    if (!user) return;
    await updateProfile(user, { photoURL: url });
    await updateDoc(doc(db, 'users', user.uid), { photoURL: url, updatedAt: serverTimestamp() });
  };

  const saveDisplayName = async () => {
    if (!displayName.trim()) {
      Alert.alert('กรอกชื่อ', 'โปรดระบุชื่อที่ต้องการแสดง');
      return;
    }
    try {
      setSaving(true);
      const user = auth.currentUser;
      if (!user) return;

      // อัปเดต Auth
      await updateProfile(user, { displayName: displayName.trim() });
      // อัปเดต Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
        updatedAt: serverTimestamp(),
      });

      setEditMode(false);
      Alert.alert('บันทึกแล้ว', 'อัปเดตชื่อเรียบร้อย');
    } catch (e) {
      console.log(e);
      Alert.alert('บันทึกไม่สำเร็จ', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('ยืนยันออกจากระบบ', 'คุณต้องการออกจากระบบหรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ออกจากระบบ',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
            // เปลี่ยนชื่อ route ให้ตรงกับแอปคุณ (เช่น 'Login' หรือ 'Auth')
            if (navigation && navigation.reset) {
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            } else if (navigation && navigation.navigate) {
              navigation.navigate('Login');
            }
          } catch (e) {
            Alert.alert('เกิดข้อผิดพลาด', e.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>กำลังโหลดโปรไฟล์…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <Text style={styles.header}>โปรไฟล์</Text>

      {/* Avatar */}
      <View style={styles.avatarWrap}>
        {photoURL ? (
          <Image source={{ uri: photoURL }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Text style={styles.avatarEmptyText}>ไม่มีรูป</Text>
          </View>
        )}
        <TouchableOpacity style={styles.changePhotoBtn} onPress={pickAndUploadImage} disabled={saving}>
          <Text style={styles.changePhotoText}>{saving ? 'กำลังอัปโหลด…' : 'เปลี่ยนรูป'}</Text>
        </TouchableOpacity>
      </View>

      {/* Name + Email */}
      <View style={styles.infoBlock}>
        <Text style={styles.label}>อีเมล</Text>
        <Text style={styles.emailText}>{email || '-'}</Text>

        <Text style={[styles.label, { marginTop: 16 }]}>ชื่อที่แสดง</Text>
        {editMode ? (
          <>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              style={styles.input}
              placeholder="กรอกชื่อที่ต้องการแสดง"
            />
            <View style={styles.row}>
              <TouchableOpacity style={[styles.actionBtn, styles.saveBtn]} onPress={saveDisplayName} disabled={saving}>
                <Text style={styles.actionText}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={() => setEditMode(false)} disabled={saving}>
                <Text style={styles.actionText}>ยกเลิก</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.row}>
            <Text style={styles.nameText}>{displayName || '-'}</Text>
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditMode(true)}>
              <Text style={styles.editText}>แก้ไข</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>ออกจากระบบ</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ===================== Styles ===================== */
const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 60,
    backgroundColor: '#fff',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  avatarWrap: { alignItems: 'center', marginBottom: 16 },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#eee',
  },
  avatarEmpty: { justifyContent: 'center', alignItems: 'center' },
  avatarEmptyText: { color: '#888' },
  changePhotoBtn: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2f4f2f',
  },
  changePhotoText: { color: '#fff', fontWeight: '600' },
  infoBlock: { marginTop: 8 },
  label: { color: '#666', fontSize: 13 },
  emailText: { fontSize: 15, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  nameText: { fontSize: 20, fontWeight: '700', flex: 1 },
  editBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f0f0f0',
  },
  editText: { fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, marginTop: 6,
  },
  actionBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
  },
  saveBtn: { backgroundColor: '#2f4f2f' },
  cancelBtn: { backgroundColor: '#999' },
  actionText: { color: '#fff', fontWeight: '700' },
  logoutBtn: {
    marginTop: 30,
    backgroundColor: '#d9534f',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
