// screens/User/AddEditIngredientScreen.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Image, Platform, Alert, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db, storage } from '../../firebaseconfig';
import { getAuth } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import RNModal from 'react-native-modal';
import { Asset } from 'expo-asset';

// ===== helper: ย้อนกลับแบบปลอดภัย =====
const goBackSafe = (navigation, fallbackRoute = 'FridgeScreen', params) => {
  if (navigation?.canGoBack?.()) {
    navigation.goBack();
  } else if (navigation?.reset) {
    navigation.reset({ index: 0, routes: [{ name: fallbackRoute, params }] });
  } else {
    navigation?.navigate?.(fallbackRoute, params);
  }
};

const sanitize = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const BUILTIN_IMAGES = [
  { key: 'none',  label: 'ไม่ใช้รูป',  src: null },
  { key: 'veg',   label: 'ผัก/ผลไม้', src: require('../../assets/veg.png') },
  { key: 'meat',  label: 'เนื้อสัตว์', src: require('../../assets/meat.png') },
  { key: 'carb',  label: 'ข้าว/แป้ง',  src: require('../../assets/carb.png') },
  { key: 'dairy', label: 'นม/ชีส',     src: require('../../assets/dairy.png') },
];
const getLocalUriFromModule = async (mod) => {
  const asset = await Asset.fromModule(mod).downloadAsync();
  return asset.localUri || asset.uri;
};

export default function AddEditIngredientScreen({ navigation, route }) {
  const editingItem = route.params?.item || null;

  // ==== คีย์สำคัญ: โหมดกลุ่มหรือเดี่ยว ====
  const targetGroupId =
    route.params?.targetGroupId ||
    editingItem?.targetGroupId ||
    null; // ถ้ามีค่า = โหมดกลุ่ม
  const isGroupMode = !!targetGroupId;

  const [userId, setUserId] = useState('');

  // ฟิลด์หลัก
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('หน่วย');
  const [imageUri, setImageUri] = useState(null);
  const [showBuiltinModal, setShowBuiltinModal] = useState(false);
  const getLocalUriFromModule = async (mod) => {
    const asset = await Asset.fromModule(mod).downloadAsync();
    return asset.localUri || asset.uri;  
  };
  const [expiry, setExpiry] = useState('');

  // date picker (เฉพาะวันหมดอายุ)
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [expiryDate, setExpiryDate] = useState(new Date());

  // web date modal (เฉพาะ expiry)
  const [webDateType, setWebDateType] = useState(null);
  const [webDay, setWebDay] = useState('');
  const [webMonth, setWebMonth] = useState('');
  const [webYear, setWebYear] = useState('');

  // modal เลือกหน่วย
  const [showUnitModal, setShowUnitModal] = useState(false);

  // typeahead ชื่อวัตถุดิบ (ingredientOptions)
  const [ingOptions, setIngOptions] = useState([]);   // {id, name, units[], defaultUnit}
  const [ingOptLoading, setIngOptLoading] = useState(true);
  const [nameFocused, setNameFocused] = useState(false);

  // ดึง user
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      setUserId(user.uid);
    } else {
      Alert.alert('ไม่พบผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');
      goBackSafe(navigation, 'Login');
    }
  }, [navigation]);

  // โหลดตัวเลือก ingredientOptions
  useEffect(() => {
    (async () => {
      try {
        setIngOptLoading(true);
        const snap = await getDocs(collection(db, 'ingredientOptions'));
        const rows = snap.docs.map(d => {
          const x = d.data() || {};
          const name = sanitize(x.name ?? x.label ?? x.title ?? x.text ?? x.value ?? '');
          const unitsArr = Array.isArray(x.units) ? x.units.map(sanitize).filter(Boolean) : [];
          const defaultUnit = sanitize(x.defaultUnit ?? x.unit ?? (unitsArr[0] ?? ''));
          return { id: d.id, name, units: unitsArr, defaultUnit };
        }).filter(o => o.name);
        rows.sort((a, b) => a.name.localeCompare(b.name, 'th'));
        setIngOptions(rows);
      } catch (e) {
        console.warn('load ingredientOptions error:', e?.message);
      } finally {
        setIngOptLoading(false);
      }
    })();
  }, []);

  // โหลดค่าเดิมตอนแก้ไข
  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name || '');

      const [qty, unitPart] = (editingItem.quantity || '').split(' ');
      setQuantity(qty || '');
      setUnit(unitPart || 'หน่วย');

      setImageUri(editingItem.image || null);
      setExpiry(editingItem.expiry || '');

      // แปลงวันหมดอายุ (ถ้ามี)
      if (editingItem.expiry && editingItem.expiry !== '-') {
        const d = parseThaiDate(editingItem.expiry);
        if (d) setExpiryDate(d);
      }
    }
  }, [editingItem]);

  // helper: parse วันที่รูปแบบไทย (เช่น 5 ก.ย. 2567)
  const parseThaiDate = (dateStr) => {
    if (!dateStr || dateStr === '-') return null;
    const thaiMonths = {
      'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3, 'พ.ค.': 4, 'มิ.ย.': 5,
      'ก.ค.': 6, 'ส.ค.': 7, 'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11
    };
    const match = dateStr.match(/(\d{1,2})\s+([^\s]+)\s+(\d{4})/);
    if (!match) return null;
    const day = parseInt(match[1], 10);
    const monthStr = match[2];
    const year = parseInt(match[3], 10) - 543;
    const month = thaiMonths[monthStr];
    if (month === undefined) return null;
    return new Date(year, month, day);
  };

  // format เป็น th-TH (พ.ศ.)
  const formatDate = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // เปลี่ยนวันหมดอายุ
  const onDateChange = (event, selectedDate) => {
    if (event?.type === 'dismissed') {
      setShowExpiryPicker(false);
      return;
    }
    const date = selectedDate || new Date();
    setExpiryDate(date);
    setExpiry(formatDate(date));
    setShowExpiryPicker(false);
  };

  // date modal (web) เฉพาะ expiry
  const openWebDate = () => {
    const base = expiryDate;
    setWebDay(String(base.getDate()).padStart(2, '0'));
    setWebMonth(String(base.getMonth() + 1).padStart(2, '0'));
    setWebYear(String(base.getFullYear()));
    setWebDateType('expiry');
  };
  const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };
  const quickPick = (days) => {
    const picked = addDays(new Date(), days);
    const todayMid = new Date(); todayMid.setHours(0,0,0,0);
    if (picked < todayMid) return;
    setWebDay(String(picked.getDate()).padStart(2, '0'));
    setWebMonth(String(picked.getMonth() + 1).padStart(2, '0'));
    setWebYear(String(picked.getFullYear()));
  };
  const confirmWebDate = () => {
    const d = parseInt(webDay, 10);
    const m = parseInt(webMonth, 10);
    const y = parseInt(webYear, 10);
    const invalid = !d || !m || !y || m < 1 || m > 12 || d < 1 || d > 31;
    if (invalid) { Alert.alert('วันที่ไม่ถูกต้อง', 'กรุณากรอกวัน/เดือน/ปีให้ถูกต้อง'); return; }
    const chosen = new Date(y, m - 1, d);
    if (isNaN(chosen.getTime())) { Alert.alert('วันที่ไม่ถูกต้อง', 'ไม่สามารถแปลงวันที่ได้'); return; }
    const todayMid = new Date(); todayMid.setHours(0,0,0,0);
    if (chosen < todayMid) { Alert.alert('ไม่ถูกต้อง', 'วันหมดอายุต้องไม่น้อยกว่าวันนี้'); return; }
    setExpiryDate(chosen);
    setExpiry(formatDate(chosen));
    setWebDateType(null);
  };

  // —— คำนวณ suggestion & หน่วยตามชื่อที่เลือก ——
  const nameQuery = name.trim().toLowerCase();
  const nameSuggestions = useMemo(() => {
    if (!nameFocused || !nameQuery) return [];
    return ingOptions
      .filter(o => (o.name || '').toLowerCase().includes(nameQuery))
      .slice(0, 8);
  }, [nameFocused, nameQuery, ingOptions]);

  const matchedOption = useMemo(() => {
    const n = name.trim().toLowerCase();
    if (!n) return null;
    return ingOptions.find(o => (o.name || '').toLowerCase() === n) || null;
  }, [name, ingOptions]);

  const unitList = useMemo(() => {
    if (!matchedOption) return [];
    if (Array.isArray(matchedOption.units) && matchedOption.units.length) return matchedOption.units;
    return matchedOption.defaultUnit ? [matchedOption.defaultUnit] : [];
  }, [matchedOption]);

  const pickSuggestion = (opt) => {
    setName(opt.name);
    const firstUnit = (opt.units && opt.units.length) ? opt.units[0] : opt.defaultUnit;
    if (!unit || unit === 'หน่วย') setUnit(firstUnit || 'หน่วย');
    setNameFocused(false);
  };

  // เลือกรูปภาพ / ถ่ายรูป
  const pickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!res.canceled && res.assets[0]) setImageUri(res.assets[0].uri);
    } catch (error) {
      console.error('pickImage:', error);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถเลือกรูปภาพได้');
    }
  };
  const takePhoto = async () => {
    try {
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!res.canceled && res.assets[0]) setImageUri(res.assets[0].uri);
    } catch (error) {
      console.error('takePhoto:', error);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถถ่ายรูปได้');
    }
  };
  const showImagePicker = () => {
    Alert.alert('เลือกรูปภาพ', 'คุณต้องการเลือกรูปภาพจากไหน?', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ถ่ายรูป', onPress: takePhoto },
      { text: 'เลือกจากอัลบั้ม', onPress: pickImage },
      { text: 'เลือกรูประบบ', onPress: () => setShowBuiltinModal(true) },
    ]);
  };

  // ================== บันทึก ==================
  const handleSave = async () => {
    try {
      if (!userId) { Alert.alert('เกิดข้อผิดพลาด', 'ไม่พบข้อมูลผู้ใช้'); return; }
      if (!name.trim()) { Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อวัตถุดิบ'); return; }
      if (!quantity.trim()) { Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกปริมาณ'); return; }

      // เตรียม path/collection ตามโหมด
      const colRef = isGroupMode
        ? collection(db, 'groups', targetGroupId, 'groupIngredient')
        : collection(db, 'users', userId, 'userIngredient');

      // ใช้ docId เดิมถ้าแก้ไข / หรือ gen auto-id เมื่อเพิ่มใหม่
      const docRef = editingItem ? doc(colRef, editingItem.id) : doc(colRef);
      const id = docRef.id;

      // อัปโหลดรูปถ้ามี
      let imageUrl = editingItem?.image || '';
      let imagePath = editingItem?.imagePath || '';
      if (imageUri && imageUri !== editingItem?.image) {
        try {
          const res = await fetch(imageUri);
          const blob = await res.blob();
          imagePath = isGroupMode
            ? `groupIngredients/${targetGroupId}/${id}.jpg`
            : `ingredients/${userId}/${id}.jpg`;
          const imageRef = ref(storage, imagePath);
          await uploadBytes(imageRef, blob, { contentType: blob.type || 'image/jpeg' });
          imageUrl = await getDownloadURL(imageRef);
        } catch (uploadErr) {
          console.warn('อัปโหลดรูปไม่สำเร็จ (ยังคงบันทึกข้อมูลได้):', uploadErr?.message || uploadErr);
        }
      }

      const ownerId = editingItem?.ownerId || userId;
      const addedBy = editingItem?.addedBy || userId;

      const newItem = {
        id,
        name: name.trim(),
        // เอาหมวดหมู่ออก: เก็บเป็น '-' เพื่อความเข้ากันได้กับข้อมูลเก่า (หรือจะลบฟิลด์นี้ภายหลังก็ได้)
        category: editingItem?.category ?? '-',
        quantity: `${quantity.trim()} ${unit}`,
        // เอาวันที่ผลิตออก: บันทึกเป็น '-' ไว้
        production: '-',
        expiry: expiry || '-',
        image: imageUrl || '',
        imagePath: imagePath || '',
        updatedAt: new Date().toISOString(),
        ...(editingItem ? {} : { createdAt: new Date().toISOString() }),
        ...(isGroupMode ? { ownerId, addedBy, targetGroupId } : { addedBy: userId })
      };

      await setDoc(docRef, newItem, { merge: true });
      Alert.alert('สำเร็จ', 'บันทึกข้อมูลวัตถุดิบเรียบร้อยแล้ว');
      setTimeout(
        () => goBackSafe(navigation, 'FridgeScreen', isGroupMode ? { mode: 'group' } : { mode: 'solo' }),
        250
      );
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('เกิดข้อผิดพลาด', error?.message || 'ไม่สามารถบันทึกข้อมูลได้');
    }
  };

  // ================== ลบ ==================
  const handleDelete = async () => {
    if (!editingItem) return;
    Alert.alert(
      'ยืนยันการลบ',
      `คุณต้องการลบ "${editingItem.name}" ใช่หรือไม่?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              const colRef = isGroupMode
                ? collection(db, 'groups', targetGroupId, 'groupIngredient')
                : collection(db, 'users', userId, 'userIngredient');

              if (editingItem.imagePath) {
                try { await deleteObject(ref(storage, editingItem.imagePath)); } catch (e) {
                  console.warn('ลบรูปจาก Storage ไม่สำเร็จ:', e?.code || e?.message);
                }
              }
              await deleteDoc(doc(colRef, editingItem.id));
              Alert.alert('สำเร็จ', 'ลบวัตถุดิบเรียบร้อยแล้ว');
              setTimeout(
                () => goBackSafe(navigation, 'FridgeScreen', isGroupMode ? { mode: 'group' } : { mode: 'solo' }),
                250
              );
            } catch (err) {
              console.error('ลบไม่สำเร็จ:', err);
              Alert.alert('เกิดข้อผิดพลาด', err?.message || 'ไม่สามารถลบวัตถุดิบได้');
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => goBackSafe(navigation, 'FridgeScreen', isGroupMode ? { mode: 'group' } : { mode: 'solo' })}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {editingItem ? (isGroupMode ? 'แก้ไข (ตู้กลุ่ม)' : 'แก้ไขวัตถุดิบ') : (isGroupMode ? 'เพิ่ม (ตู้กลุ่ม)' : 'เพิ่มวัตถุดิบ')}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* รูปภาพ */}
      <TouchableOpacity onPress={showImagePicker} style={styles.imageContainer}>
        <Image
          source={imageUri ? { uri: imageUri } : require('../../assets/images/placeholder.png')}
          style={styles.image}
        />
        <View style={styles.imageOverlay}>
          <Ionicons name="camera" size={32} color="#fff" />
          <Text style={styles.imageOverlayText}>
            {imageUri ? 'เปลี่ยนรูป' : 'เพิ่มรูป'}
          </Text>
        </View>
      </TouchableOpacity>
      {/* แถวไอคอนรูประบบ (เหมือนตัวอย่าง) */}
<View style={styles.iconRow}>
  {BUILTIN_IMAGES.map((it) => {
    const selected =
      (it.src && imageUri && imageUri.includes(it.key)) // เผื่อคุณตั้งชื่อไฟล์อัปโหลดตาม key
      || (!it.src && !imageUri);                        // กรณีปุ่มว่าง
    return (
      <TouchableOpacity
        key={it.key}
        style={[styles.iconButton, selected && styles.iconButtonActive]}
        activeOpacity={0.85}
        onPress={async () => {
          if (!it.src) {
            // ไม่ใช้รูป
            setImageUri(null);
            return;
          }
          const uri = await getLocalUriFromModule(it.src);
          setImageUri(uri); // ตั้งรูปตัวอย่างทันที
        }}
      >
        {it.src ? (
          <Image source={it.src} style={styles.iconImage} />
        ) : (
          <View style={styles.iconPlaceholder}>
            <Ionicons name="image" size={18} color="#9aa1ad" />
          </View>
        )}
      </TouchableOpacity>
    );
  })}
</View>

      {/* ฟอร์ม */}
      <View style={styles.form}>

        {/* ชื่อวัตถุดิบ + Suggestion */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>ชื่อวัตถุดิบ *</Text>
          <View style={styles.nameWrap}>
            <TextInput
              placeholder="เช่น มะเขือเทศ, ไก่, นม"
              value={name}
              onChangeText={(t) => {
                setName(t);
                setNameFocused(true);   // ✅ พิมพ์เมื่อไหร่ เปิด suggestion ทันที
              }}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setTimeout(() => setNameFocused(false), 120)}
              style={styles.input}
            />
            {nameFocused && (
              <View style={styles.suggestBox}>
                {ingOptLoading ? (
                  <View style={styles.suggestLoading}>
                    <Text style={{ color: '#475569' }}>กำลังโหลดตัวเลือก…</Text>
                  </View>
                ) : nameSuggestions.length ? (
                  nameSuggestions.map((opt) => (
                    <TouchableOpacity
                      key={opt.id}
                      style={styles.suggestItem}
                      activeOpacity={0.8}
                      onPressIn={() => {         // กดเลือกแล้วปิด dropdown ได้เหมือนเดิม
                        pickSuggestion(opt);
                        setNameFocused(false);
                      }}
                    >
                      <Text style={styles.suggestText} numberOfLines={1}>
                        {opt.name || opt.id}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : name.trim() ? (
                  <View style={styles.suggestEmpty}>
                    <Text style={{ color: '#64748B' }}>ไม่พบ “{name}”</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

        </View>

        {/* ปริมาณ + หน่วย (หน่วยจาก ingredientOptions ของชื่อที่เลือก) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>ปริมาณ *</Text>
          <View style={styles.quantityRow}>
            <TextInput
              placeholder="จำนวน"
              value={quantity}
              onChangeText={setQuantity}
              style={[styles.input, styles.quantityInput]}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={styles.unitButton}
              onPress={() => setShowUnitModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.unitButtonText} numberOfLines={1}>{unit || 'หน่วย'}</Text>
              <Ionicons name="chevron-down" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* วันหมดอายุ */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>วันหมดอายุ</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => Platform.OS === 'web' ? openWebDate() : setShowExpiryPicker(true)}
          >
            <Text style={styles.dateButtonText}>
              {expiry || 'เลือกวันหมดอายุ'}
            </Text>
            <Ionicons name="calendar-outline" size={20} color="#e74c3c" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ปุ่มดำเนินการ */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => goBackSafe(navigation, 'FridgeScreen', isGroupMode ? { mode: 'group' } : { mode: 'solo' })}
        >
          <Text style={styles.cancelButtonText}>ยกเลิก</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Ionicons name="checkmark" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.saveButtonText}>บันทึก</Text>
        </TouchableOpacity>
      </View>

      {/* ปุ่มลบ (เฉพาะแก้ไข) */}
      {editingItem && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.deleteButtonText}>ลบวัตถุดิบ</Text>
        </TouchableOpacity>
      )}

      {/* Date Picker (mobile) */}
      {Platform.OS !== 'web' && showExpiryPicker && (
        <DateTimePicker
          value={expiryDate}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}

      {/* Modal เลือกหน่วย (จาก units ของวัตถุดิบที่เลือก) */}
      <RNModal
        isVisible={showUnitModal}
        onBackdropPress={() => setShowUnitModal(false)}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>เลือกหน่วย</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {unitList.length ? unitList.map((u) => (
              <TouchableOpacity
                key={u}
                style={[
                  styles.modalItem,
                  unit === u && styles.modalItemSelected
                ]}
                onPress={() => { setUnit(u); setShowUnitModal(false); }}
              >
                <Text style={[
                  styles.modalItemText,
                  unit === u && styles.modalItemTextSelected
                ]}>
                  {u}
                </Text>
                {unit === u && <Ionicons name="checkmark" size={20} color="#6a994e" />}
              </TouchableOpacity>
            )) : (
              <View style={{ paddingVertical: 10 }}>
                <Text style={{ color: '#64748B', textAlign: 'center' }}>ไม่มีหน่วยสำหรับวัตถุดิบนี้</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </RNModal>

      {/* Modal เลือกวันที่ (web) */}
      {Platform.OS === 'web' && (
        <RNModal
          isVisible={!!webDateType}
          onBackdropPress={() => setWebDateType(null)}
          style={styles.modal}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>เลือกวันหมดอายุ</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <TouchableOpacity style={styles.quickBtn} onPress={() => quickPick(0)}>
                <Text style={styles.quickBtnText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtn} onPress={() => quickPick(7)}>
                <Text style={styles.quickBtnText}>+7 วัน</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtn} onPress={() => quickPick(30)}>
                <Text style={styles.quickBtnText}>+30 วัน</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <TextInput
                style={[styles.input, { flex: 1, textAlign: 'center' }]}
                placeholder="วัน"
                keyboardType="number-pad"
                value={webDay}
                onChangeText={setWebDay}
                maxLength={2}
              />
              <TextInput
                style={[styles.input, { flex: 1, textAlign: 'center' }]}
                placeholder="เดือน"
                keyboardType="number-pad"
                value={webMonth}
                onChangeText={setWebMonth}
                maxLength={2}
              />
              <TextInput
                style={[styles.input, { flex: 1.4, textAlign: 'center' }]}
                placeholder="ปี (ค.ศ.)"
                keyboardType="number-pad"
                value={webYear}
                onChangeText={setWebYear}
                maxLength={4}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.cancelButton, { flex: 1 }]} onPress={() => setWebDateType(null)}>
                <Text style={styles.cancelButtonText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { flex: 1 }]} onPress={confirmWebDate}>
                <Ionicons name="checkmark" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>ตกลง</Text>
              </TouchableOpacity>
            </View>
          </View>
        </RNModal>
        
      )}
      {/* Modal เลือกรูประระบบ */}
      <RNModal
        isVisible={showBuiltinModal}
        onBackdropPress={() => setShowBuiltinModal(false)}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>เลือกรูประบบ</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {BUILTIN_IMAGES.map((it) => (
              <TouchableOpacity
                key={it.key}
                style={styles.builtinItem}
                activeOpacity={0.8}
                onPress={async () => {
                  try {
                    const uri = await getLocalUriFromModule(it.src);
                    setImageUri(uri);            // ตั้งรูปให้ preview
                    setShowBuiltinModal(false);  // ปิด modal
                  } catch (e) {
                    Alert.alert('ผิดพลาด', 'ไม่สามารถเลือกรูประบบได้');
                  }
                }}
              >
                <Image source={it.src} style={{ width: 64, height: 64 }} />
                <Text style={{ marginTop: 6 }}>{it.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity style={[styles.cancelButton, { flex: 1 }]} onPress={() => setShowBuiltinModal(false)}>
              <Text style={styles.cancelButtonText}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </View>
      </RNModal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFF8E1'  // เขียวกลาง
  },
  
  // Header แบบ Buy.js
  header: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 20, 
    paddingTop: 50, 
    paddingBottom: 20, 
    backgroundColor: '#425010',  // เขียวเข้ม
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 3,
  },
  backButton: { 
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#FFF'  // ขาว
  },
  placeholder: { width: 40 },

  // Image container
  imageContainer: { 
    margin: 20, 
    borderRadius: 16, 
    overflow: 'hidden', 
    position: 'relative',
    borderWidth: 2,
    borderColor: '#F7F0CE',  // เหลืองอ่อน
  },
  image: { 
    width: '100%', 
    height: 200, 
    resizeMode: 'cover', 
    backgroundColor: '#FEF9C3'  // เหลืองอ่อนมาก
  },
  imageOverlay: {
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0,
    backgroundColor: 'rgba(66, 80, 16, 0.8)',  // เขียวเข้มโปร่งแสง
    paddingVertical: 12, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  imageOverlayText: { 
    color: '#FFF', 
    fontSize: 14, 
    fontWeight: '600', 
    marginTop: 4 
  },

  // Icon row (รูประบบ)
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 10,
  },
  iconButton: {
    width: 56, 
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',  // ขาว
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  iconButtonActive: {
    borderColor: '#F7F0CE',  // เหลืองอ่อน
    backgroundColor: '#FEF9C3',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  iconImage: { 
    width: 44, 
    height: 44, 
    resizeMode: 'contain' 
  },
  iconPlaceholder: {
    width: 44, 
    height: 44, 
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', 
    justifyContent: 'center',
  },

  // Form
  form: { 
    paddingHorizontal: 20,
    backgroundColor: '#FFF8E1',  // เขียวกลาง
  },
  inputGroup: { 
    marginBottom: 20 
  },
  label: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#000000ff',  // ขาว
    marginBottom: 8 
  },
  input: {
    borderWidth: 1, 
    borderColor: '#F7F0CE',  // เหลืองอ่อน
    borderRadius: 12, 
    padding: 16, 
    backgroundColor: '#FFF', 
    fontSize: 16,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2, 
    elevation: 1,
  },

  // Name suggestion
  nameWrap: { 
    position: 'relative', 
    zIndex: 9999 
  },
  suggestBox: {
    position: 'absolute', 
    left: 0, 
    right: 0, 
    top: 54,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1, 
    borderColor: '#F7F0CE',  // เหลืองอ่อน
    overflow: 'hidden',
    shadowColor: '#000', 
    shadowOpacity: 0.08, 
    shadowRadius: 8, 
    shadowOffset: { width: 0, height: 6 },
    elevation: 8, 
    zIndex: 9999, 
    maxHeight: 220,
  },
  suggestItem: {
    paddingVertical: 10, 
    paddingHorizontal: 12,
    borderBottomWidth: 1, 
    borderBottomColor: '#F1F5F9',
  },
  suggestText: { 
    color: '#425010',  // เขียวเข้ม
    fontWeight: '500'
  },
  suggestLoading: { 
    paddingVertical: 12, 
    paddingHorizontal: 12, 
    alignItems: 'center' 
  },
  suggestEmpty: { 
    paddingVertical: 12, 
    paddingHorizontal: 12, 
    alignItems: 'center' 
  },

  // Quantity row
  quantityRow: { 
    flexDirection: 'row', 
    gap: 12 
  },
  quantityInput: { 
    flex: 2 
  },
  unitButton: {
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    borderWidth: 1, 
    borderColor: '#F7F0CE',  // เหลืองอ่อน
    borderRadius: 12, 
    padding: 16, 
    backgroundColor: '#FFF',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2, 
    elevation: 1,
  },
  unitButtonText: { 
    fontSize: 16, 
    color: '#425010',  // เขียวเข้ม
    fontWeight: '600',
    maxWidth: 100 
  },

  // Date button
  dateButton: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    borderWidth: 1, 
    borderColor: '#F7F0CE',  // เหลืองอ่อน
    borderRadius: 12, 
    padding: 16, 
    backgroundColor: '#FFF',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2, 
    elevation: 1,
  },
  dateButtonText: { 
    fontSize: 16, 
    color: '#425010',  // เขียวเข้ม
    fontWeight: '500'
  },

  // Buttons
  buttonContainer: { 
    flexDirection: 'row', 
    gap: 12, 
    paddingHorizontal: 20, 
    paddingVertical: 20,
    backgroundColor: '#FFF8E1',  // เขียวกลาง
  },
  cancelButton: { 
    flex: 1, 
    backgroundColor: '#FFF', 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#425010'  // เขียวเข้ม
  },
  saveButton: {
    flex: 1, 
    backgroundColor: '#425010',  // เขียวเข้ม
    padding: 16, 
    borderRadius: 12,
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  saveButtonText: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#FFF' 
  },

  deleteButton: {
    backgroundColor: '#d62828', 
    padding: 16, 
    borderRadius: 12,
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    marginHorizontal: 20, 
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  deleteButtonText: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#FFF' 
  },

  // Modal
  modal: { 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContent: { 
    backgroundColor: '#FFF', 
    borderRadius: 16, 
    padding: 20, 
    width: '80%', 
    maxHeight: '70%',
    borderWidth: 2,
    borderColor: '#F7F0CE',  // เหลืองอ่อน
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    textAlign: 'center', 
    marginBottom: 16, 
    color: '#425010'  // เขียวเข้ม
  },
  modalItem: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingVertical: 12, 
    paddingHorizontal: 8, 
    borderRadius: 8, 
    marginBottom: 4,
  },
  modalItemSelected: { 
    backgroundColor: '#FEF9C3'  // เหลืองอ่อนมาก
  },
  modalItemText: { 
    fontSize: 16, 
    color: '#425010'  // เขียวเข้ม
  },
  modalItemTextSelected: { 
    color: '#425010',  // เขียวเข้ม
    fontWeight: '700' 
  },

  quickBtn: {
    backgroundColor: '#F7F0CE',  // เหลืองอ่อน
    paddingVertical: 10, 
    paddingHorizontal: 12,
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: '#E5E7EB',
  },
  quickBtnText: { 
    color: '#425010',  // เขียวเข้ม
    fontWeight: '600' 
  },
  
  builtinItem: {
    width: '46%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F7F0CE',  // เหลืองอ่อน
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});