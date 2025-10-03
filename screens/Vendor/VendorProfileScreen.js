// screens/Vendor/VendorProfileScreen.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, Button, TextInput, Modal, ScrollView,
  TouchableOpacity, Alert, Image, ActivityIndicator,
  StyleSheet, Switch, Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import { db, auth, storage } from '../../firebaseconfig';
import VendorScreen from './VendorScreen';
import S from './VendorStyles';

export default function VendorProfileScreen() {
  const navigation = useNavigation();

  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingPhoto, setSavingPhoto] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    name: '', address: '', phone: '', openHours: '',
    deliveryEnabled: false, deliveryBaseFee: '', deliveryPerKm: '',
    coordText: '',          // พิกัดช่องเดียว "lat,lng"
    promptpayId: '',        // ✅ เลขบัญชี/PromptPay สำหรับ gen QR
    city: '',               // ✅ เมือง/จังหวัดสำหรับ QR
  });

  useEffect(() => {
    async function load() {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const snap = await getDoc(doc(db, 'vendors', uid));
        const data = snap.exists() ? snap.data() : {};
        setProfile(data);

        const coordText =
          typeof data.lat === 'number' && typeof data.lng === 'number'
            ? `${data.lat},${data.lng}`
            : '';

        setEditData({
          name: data.name || '',
          address: data.address || '',
          phone: data.phone || '',
          openHours: data.openHours || '',
          deliveryEnabled: !!data.deliveryEnabled,
          deliveryBaseFee: data.deliveryBaseFee != null ? String(data.deliveryBaseFee) : '',
          deliveryPerKm: data.deliveryPerKm != null ? String(data.deliveryPerKm) : '',
          coordText,
          promptpayId: data.promptpayId || '',     // ✅ preload
          city: data.city || '',                   // ✅ preload
        });
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const pickAndUploadPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('ไม่ได้รับอนุญาต', 'โปรดอนุญาตการเข้าถึงรูปภาพ');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (result.canceled) return;

      const uri = result.assets[0].uri;
      setSavingPhoto(true);

      const resp = await fetch(uri);
      const blob = await resp.blob();

      const uid = auth.currentUser.uid;
      const storageRef = ref(storage, `vendors/${uid}/profile_${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      const dataToSave = { ...profile, uid, photoURL: url };
      await setDoc(doc(db, 'vendors', uid), dataToSave, { merge: true });
      setProfile(dataToSave);
    } catch (e) {
      console.error(e);
      Alert.alert('อัปโหลดรูปไม่สำเร็จ', 'โปรดลองอีกครั้ง');
    } finally {
      setSavingPhoto(false);
    }
  };

  const clamp = (num, min, max) => Math.max(min, Math.min(max, num));
  const parseLatLngPairFromString = (s) => {
    // รองรับ "14.9799, 102.0977" หรือ "14.9799 102.0977"
    const m = String(s).trim().match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (!m) return null;
    return { lat: parseFloat(m[1]), lng: parseFloat(m[3]) };
  };

  const fillMyLocationToInput = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('ไม่ได้รับอนุญาต', 'โปรดอนุญาตการเข้าถึงตำแหน่ง');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setEditData((p) => ({ ...p, coordText: `${lat},${lng}` }));
    } catch (e) {
      console.warn(e);
      Alert.alert('ไม่สามารถดึงตำแหน่งได้', 'โปรดลองใหม่อีกครั้ง');
    }
  };

  const saveProfile = async () => {
    try {
      const uid = auth.currentUser.uid;

      // ตัดช่องว่างรอบๆ ค่าที่กรอก
      const trimmedPromptpay = (editData.promptpayId || '').trim();
      const trimmedCity = (editData.city || '').trim();

      const base = {
        uid,
        photoURL: profile.photoURL || '',
        name: editData.name || '',
        address: editData.address || '',
        phone: editData.phone || '',
        openHours: editData.openHours || '',
        deliveryEnabled: !!editData.deliveryEnabled,
        deliveryBaseFee: Number(editData.deliveryBaseFee || 0),
        deliveryPerKm: Number(editData.deliveryPerKm || 0),
        // ✅ บันทึกข้อมูลที่ใช้ gen QR
        promptpayId: trimmedPromptpay,  // mobile/บัตรปชช./e-wallet ที่ผูก PromptPay
        city: trimmedCity,              // ปรากฏใน QR (Cart ใช้อ่านเป็น merchantCity)
      };

      // พิกัดช่องเดียว (ไม่บังคับ)
      const coordRaw = (editData.coordText || '').trim();
      if (coordRaw) {
        const pair = parseLatLngPairFromString(coordRaw);
        if (!pair) {
          Alert.alert('รูปแบบพิกัดไม่ถูกต้อง', 'กรุณากรอกเป็น "ละติจูด,ลองจิจูด" เช่น 14.9799,102.0977');
          return;
        }
        let latNum = clamp(pair.lat, -90, 90);
        let lngNum = clamp(pair.lng, -180, 180);
        base.lat = latNum;
        base.lng = lngNum;

        // ถ้าที่อยู่ยังว่าง ลอง reverse geocode ให้อัตโนมัติ (ไม่บังคับ)
        if (!base.address) {
          try {
            const res = await Location.reverseGeocodeAsync({ latitude: latNum, longitude: lngNum });
            if (res && res.length > 0) {
              const g = res[0];
              const parts = [
                g.name, g.street, g.subregion, g.district, g.city, g.region, g.postalCode
              ].filter(Boolean);
              base.address = parts.join(' ');
            }
          } catch {}
        }
      }

      await setDoc(doc(db, 'vendors', uid), base, { merge: true });
      setProfile((prev) => ({ ...prev, ...base }));

      // sync ค่าในฟอร์มให้ตรงกับที่บันทึก
      const newCoordText =
        typeof base.lat === 'number' && typeof base.lng === 'number'
          ? `${base.lat},${base.lng}`
          : editData.coordText;
      setEditData((p) => ({
        ...p,
        coordText: newCoordText,
        promptpayId: base.promptpayId,
        city: base.city,
      }));

      setShowEditModal(false);
      Alert.alert('บันทึกสำเร็จ', 'ข้อมูลร้านถูกอัปเดตแล้ว');
    } catch (err) {
      console.error('Save Error:', err);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (e) {
      console.error(e);
      Alert.alert('ออกจากระบบไม่สำเร็จ', 'โปรดลองอีกครั้ง');
    }
  };

  if (loading) {
    return (
      <VendorScreen>
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>กำลังโหลดข้อมูล...</Text>
        </View>
      </VendorScreen>
    );
  }

  return (
    <VendorScreen>
      <View style={S.sectionRow}>
        <View style={S.sectionBar} />
        <Text style={S.sectionTitle}>ข้อมูลร้านค้า</Text>
      </View>

      <View style={[S.card, S.shadow, { alignItems: 'center' }]}>
        {/* รูปร้าน */}
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          {profile.photoURL ? (
            <Image
              source={{ uri: profile.photoURL }}
              style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: '#E7E2D3' }}
            />
          ) : (
            <View
              style={{
                width: 96, height: 96, borderRadius: 48, backgroundColor: '#FFF8DF',
                alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E7E2D3'
              }}
            >
              <Text style={{ fontSize: 22 }}>🏪</Text>
            </View>
          )}
          <TouchableOpacity onPress={pickAndUploadPhoto} style={{ marginTop: 8 }}>
            <Text style={S.link}>{savingPhoto ? 'กำลังอัปโหลด...' : '📷 เปลี่ยนรูปโปรไฟล์'}</Text>
          </TouchableOpacity>
        </View>

        {/* ข้อมูลร้าน */}
        <View style={{ alignSelf: 'stretch' }}>
          <Text style={S.stockName}>ชื่อร้าน: <Text style={{ fontWeight: '400' }}>{profile.name || 'ยังไม่ระบุ'}</Text></Text>
          <Text style={S.stockName}>ที่อยู่: <Text style={{ fontWeight: '400' }}>{profile.address || 'ยังไม่ระบุ'}</Text></Text>
          <Text style={S.stockName}>พิกัด: <Text style={{ fontWeight: '400' }}>
            {typeof profile.lat === 'number' && typeof profile.lng === 'number'
              ? `${profile.lat.toFixed(6)}, ${profile.lng.toFixed(6)}`
              : 'ยังไม่ระบุ'}</Text>
          </Text>
          <Text style={S.stockName}>เบอร์ติดต่อ: <Text style={{ fontWeight: '400' }}>{profile.phone || 'ยังไม่ระบุ'}</Text></Text>
          <Text style={S.stockName}>เวลาทำการ: <Text style={{ fontWeight: '400' }}>{profile.openHours || 'ยังไม่ระบุ'}</Text></Text>
          <Text style={S.stockName}>บริการจัดส่ง: <Text style={{ fontWeight: '400' }}>{profile.deliveryEnabled ? 'มี' : 'เฉพาะรับที่ร้าน'}</Text></Text>

          {/* ✅ แสดงเลขบัญชี/PromptPay สำหรับ QR */}
          <Text style={S.stockName}>เลขสำหรับ QR (PromptPay): <Text style={{ fontWeight: '400' }}>
            {profile.promptpayId || 'ยังไม่ระบุ'}
          </Text></Text>
          <Text style={S.stockName}>เมือง/จังหวัด (QR): <Text style={{ fontWeight: '400' }}>
            {profile.city || 'ยังไม่ระบุ'}
          </Text></Text>

          <View style={{ flexDirection: 'row', gap: 14, marginTop: 12 }}>
            <TouchableOpacity onPress={() => setShowEditModal(true)}>
              <Text style={S.link}>✏️ แก้ไขข้อมูลร้าน</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 16 }}>
            <Button title="ออกจากระบบ" color="#FF3B30" onPress={handleLogout} />
          </View>
        </View>
      </View>

      {/* Modal แก้ไขข้อมูลร้าน */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.modalTitle}>แก้ไขข้อมูลร้าน</Text>

              <TextInput
                placeholder="ชื่อร้าน"
                value={editData.name}
                onChangeText={t => setEditData({ ...editData, name: t })}
                style={inputStyle}
              />
              <TextInput
                placeholder="ที่อยู่"
                value={editData.address}
                onChangeText={t => setEditData({ ...editData, address: t })}
                style={inputStyle}
              />
              <TextInput
                placeholder="เบอร์โทร"
                keyboardType="phone-pad"
                value={editData.phone}
                onChangeText={t => setEditData({ ...editData, phone: t })}
                style={inputStyle}
              />
              <TextInput
                placeholder="เวลาทำการ (เช่น 9:00–18:00)"
                value={editData.openHours}
                onChangeText={t => setEditData({ ...editData, openHours: t })}
                style={inputStyle}
              />

              {/* การจัดส่ง */}
              <View style={styles.rowBetween}>
                <Text>ให้บริการจัดส่ง</Text>
                <Switch
                  value={!!editData.deliveryEnabled}
                  onValueChange={(v) => setEditData({ ...editData, deliveryEnabled: v })}
                />
              </View>

              {editData.deliveryEnabled ? (
                <>
                  <TextInput
                    placeholder="ค่าส่งพื้นฐาน (บาท)"
                    keyboardType="numeric"
                    value={editData.deliveryBaseFee}
                    onChangeText={(t) => setEditData({ ...editData, deliveryBaseFee: t })}
                    style={inputStyle}
                  />
                  <TextInput
                    placeholder="ค่าส่งต่อกม. (บาท)"
                    keyboardType="numeric"
                    value={editData.deliveryPerKm}
                    onChangeText={(t) => setEditData({ ...editData, deliveryPerKm: t })}
                    style={inputStyle}
                  />
                </>
              ) : null}

              {/* พิกัดช่องเดียว */}
              <View style={{ marginTop: 16, marginBottom: 6 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16 }}>พิกัดร้าน (ละติจูด,ลองจิจูด)</Text>
                <Text style={{ color: '#666', marginTop: 2 }}>
                  กรอกเช่น <Text style={{ fontStyle: 'italic' }}>14.9799,102.0977</Text> หรือเว้นว่างถ้าไม่ต้องการแก้ไขพิกัด
                </Text>
              </View>
              <TextInput
                placeholder="เช่น 14.9799,102.0977"
                keyboardType="numbers-and-punctuation"
                value={editData.coordText}
                onChangeText={(t) => setEditData((p) => ({ ...p, coordText: t }))}
                style={inputStyle}
              />

              {/* ✅ การชำระเงิน (สำหรับ Gen QR) */}
              <View style={{ marginTop: 16, marginBottom: 6 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16 }}>การชำระเงิน (QR/PromptPay)</Text>
                <Text style={{ color: '#666', marginTop: 2 }}>
                  กรอกเบอร์มือถือที่ผูก PromptPay หรือเลขบัตรประชาชน 13 หลัก (รองรับรูปแบบ 0XXXXXXXXX, 66XXXXXXXXX, 0066XXXXXXXXX หรือ 13 หลัก)
                </Text>
              </View>
              <TextInput
                placeholder="PromptPay / เลขบัญชีสำหรับ QR"
                keyboardType="numbers-and-punctuation"
                value={editData.promptpayId}
                onChangeText={(t) => setEditData((p) => ({ ...p, promptpayId: t }))}
                style={inputStyle}
              />
              <TextInput
                placeholder="เมือง/จังหวัด (เช่น Bangkok)"
                value={editData.city}
                onChangeText={(t) => setEditData((p) => ({ ...p, city: t }))}
                style={inputStyle}
              />

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <View style={{ flex: 1 }}>
                  <Button title="ใช้ตำแหน่งของฉัน (GPS)" onPress={fillMyLocationToInput} />
                </View>
              </View>

              <View style={{ marginTop: 20 }}>
                <Button title="บันทึก" onPress={saveProfile} />
                <View style={{ height: 10 }} />
                <Button title="ยกเลิก" onPress={() => setShowEditModal(false)} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </VendorScreen>
  );
}

const inputStyle = {
  borderWidth: 1, borderColor: '#E7E2D3', borderRadius: 10,
  paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFF',
  marginBottom: 10,
};

const styles = StyleSheet.create({
  modalBg: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCard: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 12, maxHeight: '85%', padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 10 },
});
