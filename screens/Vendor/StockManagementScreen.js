// screens/Vendor/StockManagementScreen.js
import React, { useEffect, useState } from 'react';
import {
  View, FlatList, Text, ActivityIndicator, TouchableOpacity,
  TextInput, Modal, Button, ScrollView, Alert, Platform, Image, StyleSheet
} from 'react-native';
import {
  collection, getDocs, addDoc, query, orderBy,
  doc, updateDoc, deleteDoc, setDoc, deleteField
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, storage } from '../../firebaseconfig';
import { ref as sRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import VendorScreen from './VendorScreen';
import S from './VendorStyles';

// ===== helpers =====
const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);
const inNextDays = (date, days = 3) => {
  const d = toDate(date); if (!d) return false;
  const now = new Date(); const end = new Date();
  end.setDate(now.getDate() + days);
  const s = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return dd >= s && dd <= e;
};
const formatDate = (v) => {
  const d = toDate(v);
  return d ? d.toLocaleDateString() : '— ไม่มีข้อมูล —';
};

// อัปโหลดรูปไป Storage -> คืน { url, path }
async function uploadStockImage({ uid, stockId, uri }) {
  const resp = await fetch(uri);
  const blob = await resp.blob();
  const path = `vendors/${uid}/stock/${stockId}_${Date.now()}.jpg`;
  const r = sRef(storage, path);
  await uploadBytes(r, blob);
  const url = await getDownloadURL(r);
  return { url, path };
}

export default function StockManagementScreen() {
  const [uid, setUid] = useState(null);

  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);

  const [newItem, setNewItem] = useState({
    name: '', quantity: '', unit: '', pricePerKg: '', expiryDate: ''
  });

  // รูปภาพ
  const [localImage, setLocalImage] = useState(null); // uri ที่เพิ่งเลือก/ถ่าย
  const [existingImage, setExistingImage] = useState({ url: '', path: '' }); // ของเดิมในเอกสาร
  const [removeImage, setRemoveImage] = useState(false); // สั่งลบรูปเดิม

  // auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid || null));
    return unsub;
  }, []);

  // load
  useEffect(() => { if (uid) loadData(); }, [uid]);

  async function loadData() {
    setLoading(true);
    try {
      const col = collection(db, 'vendors', uid, 'stock');
      const snap = await getDocs(query(col, orderBy('name')));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(data);
      setFilteredItems(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let filtered = items;
    if (search) filtered = filtered.filter(i =>
      (i.name || '').toLowerCase().includes(search.toLowerCase())
    );
    if (filterLowStock) filtered = filtered.filter(i => Number(i.quantity ?? 0) <= 5);
    setFilteredItems(filtered);
  }, [search, filterLowStock, items]);

  // modal handlers
  function openAddModal() {
    setNewItem({ name: '', quantity: '', unit: '', pricePerKg: '', expiryDate: '' });
    setEditMode(false);
    setEditId(null);
    setLocalImage(null);
    setExistingImage({ url: '', path: '' });
    setRemoveImage(false);
    setShowAddModal(true);
  }

  function openEditModal(item) {
    setNewItem({
      name: item.name || '',
      quantity: String(item.quantity ?? ''),
      unit: item.unit || '',
      pricePerKg: String(item.pricePerKg ?? ''),
      expiryDate: (() => {
        const d = toDate(item.expiryDate); if (!d) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      })()
    });
    setEditId(item.id);
    setEditMode(true);
    setLocalImage(null);
    setExistingImage({ url: item.imageURL || '', path: item.imagePath || '' });
    setRemoveImage(false);
    setShowAddModal(true);
  }

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('ไม่ได้รับอนุญาต', 'โปรดอนุญาตการเข้าถึงรูปภาพ');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled) return;
    setLocalImage(result.assets[0].uri);
    setRemoveImage(false);
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('ไม่ได้รับอนุญาต', 'โปรดอนุญาตการใช้กล้อง');
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [1, 1], quality: 0.9,
    });
    if (result.canceled) return;
    setLocalImage(result.assets[0].uri);
    setRemoveImage(false);
  }

  function markRemoveImage() {
    if (localImage) {
      setLocalImage(null);
      return;
    }
    if (existingImage.url) {
      setRemoveImage(true);
    }
  }

  async function saveItem() {
    try {
      const parsedQty = parseFloat(newItem.quantity) || 0;
      const parsedPrice = parseFloat(newItem.pricePerKg) || 0;

      let expiry = null;
      if (newItem.expiryDate) {
        const d = new Date(newItem.expiryDate);
        if (isNaN(d)) return Alert.alert('รูปแบบวันที่ไม่ถูกต้อง', 'ใส่เป็น YYYY-MM-DD');
        expiry = d;
      }

      const normalized = {
        name: newItem.name.trim(),
        quantity: parsedQty,
        unit: newItem.unit.trim(),
        pricePerKg: parsedPrice,
        expiryDate: expiry,
      };

      const col = collection(db, 'vendors', uid, 'stock');

      if (editMode) {
        const refDoc = doc(col, editId);
        await updateDoc(refDoc, normalized);

        // ลบรูปเดิมถ้าถูกสั่งลบ
        if (removeImage && existingImage.path) {
          try { await deleteObject(sRef(storage, existingImage.path)); } catch (e) {}
          await updateDoc(refDoc, { imageURL: deleteField(), imagePath: deleteField() });
        }

        // อัปโหลดรูปใหม่ถ้าเลือกมา
        if (localImage) {
          // ถ้ามีรูปเดิม ให้ลบทิ้งก่อน (เผื่อกินพื้นที่)
          if (existingImage.path) { try { await deleteObject(sRef(storage, existingImage.path)); } catch (e) {} }
          const up = await uploadStockImage({ uid, stockId: editId, uri: localImage });
          await updateDoc(refDoc, { imageURL: up.url, imagePath: up.path });
        }
      } else {
        // ต้องสร้าง id เองเพื่อใช้เป็น path ใน Storage
        const refDoc = doc(col);
        await setDoc(refDoc, { ...normalized, createdAt: new Date() });

        if (localImage) {
          const up = await uploadStockImage({ uid, stockId: refDoc.id, uri: localImage });
          await updateDoc(refDoc, { imageURL: up.url, imagePath: up.path });
        }
      }

      setShowAddModal(false);
      setLocalImage(null);
      setRemoveImage(false);
      setExistingImage({ url: '', path: '' });
      loadData();
    } catch (e) {
      Alert.alert('บันทึกไม่สำเร็จ', e?.message || 'unknown');
    }
  }

  function confirmDelete(id, imagePath) {
    Alert.alert('ลบสินค้า', 'คุณแน่ใจหรือไม่ว่าต้องการลบสินค้า?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ', style: 'destructive', onPress: async () => {
          const col = collection(db, 'vendors', uid, 'stock');
          await deleteDoc(doc(col, id));
          if (imagePath) {
            try { await deleteObject(sRef(storage, imagePath)); } catch (e) {}
          }
          loadData();
        }
      }
    ]);
  }

  if (loading || !uid) {
    return (
      <VendorScreen>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </VendorScreen>
    );
  }

  return (
    <VendorScreen>
      <View style={S.sectionRow}>
        <View style={S.sectionBar} /><Text style={S.sectionTitle}>จัดการสต๊อกสินค้า</Text>
      </View>

      {/* ค้นหา + ฟิลเตอร์ */}
      <TextInput
        style={localStyles.input}
        placeholder="ค้นหาชื่อสินค้า"
        placeholderTextColor="#7A6F57"
        value={search}
        onChangeText={setSearch}
      />
      <TouchableOpacity onPress={() => setFilterLowStock(!filterLowStock)} style={{ marginBottom: 10 }}>
        <Text style={S.link}>{filterLowStock ? '🔁 แสดงทั้งหมด' : '⚠ แสดงเฉพาะที่ใกล้หมดสต็อก'}</Text>
      </TouchableOpacity>

      {/* รายการ */}
      <FlatList
        data={filteredItems}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }) => {
          const qty = Number(item.quantity ?? 0);
          const low = qty <= 5;
          const soon = inNextDays(item.expiryDate, 3);

          return (
            <View style={S.stockItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {/* รูปสินค้าเล็ก ๆ */}
                {item.imageURL ? (
                  <Image source={{ uri: item.imageURL }} style={localStyles.thumb} />
                ) : (
                  <View style={[localStyles.thumb, localStyles.thumbPlaceholder]}>
                    <Text style={{ opacity: 0.5 }}>ไม่มีรูป</Text>
                  </View>
                )}

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={S.stockTop}>
                    <Text style={S.stockName}>{item.name}</Text>
                    <Text style={S.stockQty}>{qty} {item.unit}</Text>
                  </View>

                  {Number(item.pricePerKg) > 0 && (
                    <Text style={{ marginTop: 4 }}>
                      ราคา: ฿{Number(item.pricePerKg).toLocaleString()}/กก.
                    </Text>
                  )}

                  <View style={[S.expiryRow, { flexWrap: 'wrap' }]}>
                    <Text style={S.expiryText}>หมดอายุ: </Text>
                    <Text style={soon ? S.expiryWarn : S.expiryText}>
                      {formatDate(item.expiryDate)}
                    </Text>

                    {soon && (
                      <View style={[localStyles.badge, localStyles.badgeDanger]}>
                        <Text style={localStyles.badgeDangerTxt}>ใกล้หมดอายุ</Text>
                      </View>
                    )}
                    {low && (
                      <View style={[localStyles.badge, localStyles.badgeOutline]}>
                        <Text style={localStyles.badgeOutlineTxt}>ใกล้หมดสต็อก</Text>
                      </View>
                    )}
                  </View>

                  <View style={S.linkRow}>
                    <TouchableOpacity onPress={() => openEditModal(item)}>
                      <Text style={S.link}>✏️ แก้ไข</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDelete(item.id, item.imagePath)}>
                      <Text style={[S.link, { color: '#C62828' }]}>🗑 ลบ</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={{ opacity: 0.6 }}>ไม่มีสินค้า</Text>}
        ListFooterComponent={
          <TouchableOpacity onPress={openAddModal} style={localStyles.footerAdd}>
            <Text style={S.link}>➕ เพิ่มสินค้าใหม่</Text>
          </TouchableOpacity>
        }
      />

      {/* Modal เพิ่ม/แก้ไข */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={localStyles.modalBg}>
          <View style={localStyles.modalCard}>
            <ScrollView>
              <Text style={localStyles.modalTitle}>{editMode ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</Text>

              {/* พรีวิวรูป */}
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                {localImage ? (
                  <Image source={{ uri: localImage }} style={localStyles.preview} />
                ) : existingImage.url ? (
                  <Image source={{ uri: existingImage.url }} style={localStyles.preview} />
                ) : (
                  <View style={[localStyles.preview, localStyles.thumbPlaceholder, { justifyContent: 'center' }]}>
                    <Text style={{ opacity: 0.6 }}>ยังไม่มีรูปสินค้า</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Button title="เลือกรูปจากเครื่อง" onPress={pickFromLibrary} />
                  <View style={{ width: 8 }} />
                  <Button title="ถ่ายภาพ" onPress={takePhoto} />
                </View>
                {(localImage || existingImage.url) && (
                  <View style={{ marginTop: 8 }}>
                    <Button
                      color="#C62828"
                      title="ลบรูปนี้"
                      onPress={markRemoveImage}
                    />
                  </View>
                )}
                {removeImage && !localImage ? (
                  <Text style={{ color: '#C62828', marginTop: 6 }}>จะลบรูปสินค้าเมื่อบันทึก</Text>
                ) : null}
              </View>

              {/* ฟอร์มข้อมูล */}
              <TextInput
                style={localStyles.input}
                placeholder="ชื่อสินค้า"
                placeholderTextColor="#7A6F57"
                value={newItem.name}
                onChangeText={t => setNewItem({ ...newItem, name: t })}
              />
              <TextInput
                style={localStyles.input}
                placeholder="จำนวน"
                placeholderTextColor="#7A6F57"
                keyboardType="numeric"
                value={newItem.quantity}
                onChangeText={t => setNewItem({ ...newItem, quantity: t })}
              />
              <TextInput
                style={localStyles.input}
                placeholder="หน่วย (เช่น กก., แพ็ค)"
                placeholderTextColor="#7A6F57"
                value={newItem.unit}
                onChangeText={t => setNewItem({ ...newItem, unit: t })}
              />
              <TextInput
                style={localStyles.input}
                placeholder="ราคา/กก. (บาท)"
                placeholderTextColor="#7A6F57"
                keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                value={newItem.pricePerKg}
                onChangeText={t => setNewItem({ ...newItem, pricePerKg: t })}
              />
              <TextInput
                style={localStyles.input}
                placeholder="วันหมดอายุ (YYYY-MM-DD)"
                placeholderTextColor="#7A6F57"
                value={newItem.expiryDate}
                onChangeText={t => setNewItem({ ...newItem, expiryDate: t })}
              />

              <View style={{ marginTop: 20 }}>
                <Button title={editMode ? 'อัปเดตสินค้า' : 'บันทึก'} onPress={saveItem} />
                <View style={{ height: 10 }} />
                <Button title="ยกเลิก" onPress={() => setShowAddModal(false)} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </VendorScreen>
  );
}

const localStyles = StyleSheet.create({
  input: {
    borderWidth: 1, borderColor: '#E7E2D3', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFF',
    marginBottom: 10,
  },
  modalBg: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCard: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 12, maxHeight: '85%', padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },

  footerAdd: { marginTop: 12, alignSelf: 'flex-start', paddingBottom: 8 },

  badge: {
    marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999, alignSelf: 'center'
  },
  badgeDanger: { backgroundColor: '#FCE4E4' },
  badgeDangerTxt: { color: '#C62828', fontSize: 12, fontWeight: '600' },
  badgeOutline: { borderWidth: 1, borderColor: '#C62828', backgroundColor: 'transparent' },
  badgeOutlineTxt: { color: '#C62828', fontSize: 12, fontWeight: '600' },

  // รูป
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#F5F5F5' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EEE' },
  preview: { width: 180, height: 180, borderRadius: 12, backgroundColor: '#F5F5F5' },
});
