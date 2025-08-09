// screens/User/AddEditRecipe.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ScrollView, Alert, ActivityIndicator, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import { db, storage } from '../../firebaseconfig';
import {
  addDoc, collection, doc, getDoc, setDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const THEME = {
  bg: '#f2f2d9',
  card: '#fbf6e3',
  green: '#5e7f1a',
  greenDark: '#3e5a0b',
  yellow: '#ffd44d',
  gray: '#98a2b3',
  danger: '#c83d3d',
};

const CATEGORIES = ['สูตรทำกินเอง', 'สูตรทางบ้าน', 'สูตรรักษ์สุขภาพ'];

/** ตรวจสอบสิทธิ์ admin
 *  1) เช็ค custom claims: role/admin
 *  2) ไม่เจอ → เช็ค Firestore: users/{uid}.role === 'admin'
 */
async function checkIsAdmin(db, auth) {
  try {
    const token = await auth.currentUser?.getIdTokenResult?.();
    if (token?.claims?.role === 'admin' || token?.claims?.admin === true) return true;

    const uid = auth.currentUser?.uid;
    if (!uid) return false;
    const snap = await getDoc(doc(db, 'users', uid));
    const role = snap.exists() ? snap.data()?.role : null;
    return role === 'admin';
  } catch (e) {
    console.warn('checkIsAdmin error:', e?.message);
    return false;
  }
}

export default function AddEditRecipe({ route, navigation }) {
  const recipeId = route?.params?.recipeId ?? null;

  const auth = getAuth();
  const uid = auth.currentUser?.uid || null;
  const displayName = auth.currentUser?.displayName || 'Unknown';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // ฟอร์มหลัก
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [imageUrl, setImageUrl] = useState('');
  const [imagePath, setImagePath] = useState(''); // path ใน storage (ไว้ลบ/แก้)

  // รายการย่อย
  const [ingredients, setIngredients] = useState([]); // [{name, part, qty, unit}]
  const [seasonings, setSeasonings] = useState([]);   // string[]
  const [equipments, setEquipments] = useState([]);   // string[]
  const [steps, setSteps] = useState([]);             // string[]

  // โหลดสิทธิ์
  useEffect(() => {
    (async () => setIsAdmin(await checkIsAdmin(db, auth)))();
  }, []);

  // โหลดเดิมถ้ามี recipeId
  useEffect(() => {
    (async () => {
      try {
        if (!recipeId) {
          setLoading(false);
          return;
        }
        const snap = await getDoc(doc(db, 'recipes', recipeId));
        if (!snap.exists()) {
          Alert.alert('ไม่พบเมนู', 'รายการนี้ถูกลบไปแล้ว');
          navigation.goBack();
          return;
        }
        const d = snap.data();
        setTitle(d.title || '');
        setSummary(d.summary || '');
        setCategory(d.category || CATEGORIES[0]);
        setImageUrl(d.imageUrl || '');
        setImagePath(d.imagePath || '');

        setIngredients(Array.isArray(d.ingredients) ? d.ingredients : []);
        setSeasonings(Array.isArray(d.seasonings) ? d.seasonings : []);
        setEquipments(Array.isArray(d.equipments) ? d.equipments : []);
        setSteps(Array.isArray(d.steps) ? d.steps : []);
      } catch (e) {
        console.error('load recipe error:', e);
        Alert.alert('โหลดข้อมูลไม่สำเร็จ', 'โปรดลองใหม่');
      } finally {
        setLoading(false);
      }
    })();
  }, [recipeId]);

  // ===== helper จัดการแถว =====
  const addRow = (setter, template) => setter((prev) => [...prev, template]);
  const removeRow = (setter, idx) => setter((prev) => prev.filter((_, i) => i !== idx));
  const updateRow = (setter, idx, key, val) =>
    setter((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));
  const updateRowStr = (setter, idx, val) =>
    setter((prev) => prev.map((s, i) => (i === idx ? val : s)));

  // ===== เลือกรูป + อัปโหลด =====
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('ไม่ได้รับอนุญาต', 'ต้องอนุญาตการเข้าถึงรูปภาพก่อน');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (res.canceled) return;
    const asset = res.assets?.[0];
    if (!asset) return;
    try {
      setSaving(true);
      // สร้าง path: recipes/<uid>/<timestamp>.jpg
      const path = `recipes/${uid || 'guest'}/${Date.now()}.jpg`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      // ถ้ามีรูปเดิม ให้ลบทิ้ง
      if (imagePath) {
        try { await deleteObject(ref(storage, imagePath)); } catch {}
      }

      setImageUrl(url);
      setImagePath(path);
    } catch (e) {
      console.error('upload image error:', e);
      Alert.alert('อัปโหลดรูปไม่สำเร็จ', 'โปรดลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  // ===== บันทึก (มี Moderation Flow) =====
  const onSave = async () => {
    if (!title.trim()) {
      Alert.alert('กรอกไม่ครบ', 'กรุณาใส่ชื่อเมนู');
      return;
    }
    if (!uid) {
      Alert.alert('ยังไม่ได้ล็อกอิน', 'โปรดเข้าสู่ระบบก่อนบันทึกเมนู');
      return;
    }

    try {
      setSaving(true);

      const basePayload = {
        title: title.trim(),
        summary: summary.trim(),
        category,
        imageUrl: imageUrl || '',
        imagePath: imagePath || '',
        ingredients,
        seasonings,
        equipments,
        steps,
        uid,
        authorName: displayName || 'Unknown',
        updatedAt: serverTimestamp(),
        ...(recipeId ? {} : { createdAt: serverTimestamp() }),
      };

      const payload = isAdmin
        ? { ...basePayload, status: 'approved', approvedBy: uid, approvedAt: serverTimestamp() }
        : { ...basePayload, status: 'pending', submittedBy: uid, submittedAt: serverTimestamp(), approvedBy: null, approvedAt: null };

      if (recipeId) {
        // แก้ไข: admin คง approved / user → กลับเป็น pending และเข้าคิว
        const finalPayload = isAdmin
          ? { ...payload, status: 'approved', approvedBy: uid, approvedAt: serverTimestamp() }
          : { ...payload, status: 'pending', approvedBy: null, approvedAt: null };

        await setDoc(doc(db, 'recipes', recipeId), finalPayload, { merge: true });

        if (!isAdmin) {
          await addDoc(collection(db, 'moderationQueue'), {
            type: 'recipe_update',
            recipeId,
            data: finalPayload,
            submittedBy: uid,
            submittedAt: serverTimestamp(),
          });
        }
      } else {
        // เพิ่มใหม่
        const newRef = await addDoc(collection(db, 'recipes'), payload);

        if (!isAdmin) {
          await addDoc(collection(db, 'moderationQueue'), {
            type: 'recipe_create',
            recipeId: newRef.id,
            data: payload,
            submittedBy: uid,
            submittedAt: serverTimestamp(),
          });
        }
      }

      Alert.alert(
        'สำเร็จ',
        isAdmin ? 'บันทึกเมนูและเผยแพร่เรียบร้อย' : 'ส่งเมนูเข้ารออนุมัติเรียบร้อย',
        [{ text: 'ตกลง', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      console.error('save recipe error:', e);
      Alert.alert('บันทึกไม่สำเร็จ', 'โปรดลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  // ===== ลบเมนู =====
  const onDelete = async () => {
    if (!recipeId) return;
    Alert.alert('ยืนยันการลบ', `ลบ “${title || 'เมนู'}” ?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ', style: 'destructive', onPress: async () => {
          try {
            await deleteDoc(doc(db, 'recipes', recipeId));
            if (imagePath) {
              try { await deleteObject(ref(storage, imagePath)); } catch {}
            }
            navigation.goBack();
          } catch (e) {
            console.error('delete recipe error:', e);
            Alert.alert('ลบไม่สำเร็จ', 'โปรดลองใหม่');
          }
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { flex: 1, backgroundColor: THEME.bg }]}>
        <ActivityIndicator size="large" color={THEME.green} />
        <Text style={{ marginTop: 8, color: THEME.greenDark }}>กำลังโหลด…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Ionicons name="chevron-back" size={22} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{recipeId ? 'แก้ไขสูตรอาหาร' : 'เพิ่มสูตรอาหาร'}</Text>
        {!!recipeId ? (
          <TouchableOpacity onPress={onDelete} style={{ padding: 6 }}>
            <MaterialIcons name="delete" size={22} color={THEME.danger} />
          </TouchableOpacity>
        ) : <View style={{ width: 28 }} /> }
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        {/* การ์ดฟอร์ม */}
        <View style={styles.card}>
          {/* รูป */}
          <TouchableOpacity style={styles.imageBox} onPress={pickImage} activeOpacity={0.8}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.image} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image" size={26} color={THEME.gray} />
                <Text style={{ color: THEME.gray, marginTop: 6 }}>เลือกรูป</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* ชื่อ + คำอธิบาย */}
          <Label text="ชื่อเมนู" />
          <TextInput
            style={styles.input}
            placeholder="Placeholder"
            value={title}
            onChangeText={setTitle}
          />
          <Label text="คำอธิบาย" />
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Placeholder"
            multiline
            value={summary}
            onChangeText={setSummary}
          />

          {/* หมวดหมู่ */}
          <Label text="หมวดหมู่" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && { color: '#fff' }]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* วัตถุดิบ */}
          <SectionHeader
            title="วัตถุดิบ"
            onAdd={() => setIngredients((prev) => [...prev, { name: '', part: '', qty: '', unit: '' }])}
          />
          {ingredients.map((it, idx) => (
            <RowIngredient
              key={idx}
              value={it}
              onChange={(key, val) => setIngredients((prev) => prev.map((x, i) => i === idx ? { ...x, [key]: val } : x))}
              onRemove={() => setIngredients((prev) => prev.filter((_, i) => i !== idx))}
            />
          ))}

          {/* เครื่องปรุง */}
          <SectionHeader title="เครื่องปรุง" onAdd={() => setSeasonings((prev) => [...prev, ''])} />
          {seasonings.map((s, idx) => (
            <RowSimple
              key={idx}
              value={s}
              onChange={(val) => setSeasonings((prev) => prev.map((x, i) => i === idx ? val : x))}
              onRemove={() => setSeasonings((prev) => prev.filter((_, i) => i !== idx))}
              placeholder="เช่น ซอสหอยนางรม 1 ช้อนโต๊ะ"
            />
          ))}

          {/* อุปกรณ์ */}
          <SectionHeader title="อุปกรณ์" onAdd={() => setEquipments((prev) => [...prev, ''])} />
          {equipments.map((s, idx) => (
            <RowSimple
              key={idx}
              value={s}
              onChange={(val) => setEquipments((prev) => prev.map((x, i) => i === idx ? val : x))}
              onRemove={() => setEquipments((prev) => prev.filter((_, i) => i !== idx))}
              placeholder="เช่น กระทะ ตะหลิว"
            />
          ))}

          {/* วิธีทำ */}
          <SectionHeader title="วิธีทำ" onAdd={() => setSteps((prev) => [...prev, ''])} />
          {steps.map((s, idx) => (
            <RowSimple
              key={idx}
              value={s}
              onChange={(val) => setSteps((prev) => prev.map((x, i) => i === idx ? val : x))}
              onRemove={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}
              placeholder={`ขั้นตอนที่ ${idx + 1}`}
            />
          ))}

          {/* ปุ่มบันทึก */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: THEME.green }]}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>บันทึก</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#c0c7d1' }]}
              onPress={() => navigation.goBack()}
              disabled={saving}
            >
              <Text style={styles.btnText}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ------------ small components ------------ */
const Label = ({ text }) => (
  <Text style={{ color: THEME.greenDark, marginTop: 10, marginBottom: 6, fontWeight: '700' }}>{text}</Text>
);

const SectionHeader = ({ title, onAdd }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <TouchableOpacity onPress={onAdd} style={styles.addIcon}>
      <Ionicons name="add" size={18} color="#333" />
    </TouchableOpacity>
  </View>
);

const RowSimple = ({ value, onChange, onRemove, placeholder }) => (
  <View style={styles.row}>
    <TextInput
      style={[styles.input, { flex: 1 }]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
    />
    <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
      <MaterialIcons name="delete" size={20} color="#fff" />
    </TouchableOpacity>
  </View>
);

const RowIngredient = ({ value, onChange, onRemove }) => (
  <View style={styles.rowIng}>
    <TextInput
      style={[styles.input, styles.colName]}
      placeholder="ชื่อ (เช่น ไข่ไก่)"
      value={value.name}
      onChangeText={(t) => onChange('name', t)}
    />
    <TextInput
      style={[styles.input, styles.colPart]}
      placeholder="ส่วน (เช่น ฟอง/หัว)"
      value={value.part}
      onChangeText={(t) => onChange('part', t)}
    />
    <TextInput
      style={[styles.input, styles.colQty]}
      placeholder="ปริมาณ"
      keyboardType="numeric"
      value={String(value.qty ?? '')}
      onChangeText={(t) => onChange('qty', t)}
    />
    <TextInput
      style={[styles.input, styles.colUnit]}
      placeholder="หน่วย"
      value={value.unit}
      onChangeText={(t) => onChange('unit', t)}
    />
    <TouchableOpacity onPress={onRemove} style={styles.removeBtnSmall}>
      <MaterialIcons name="delete" size={18} color="#fff" />
    </TouchableOpacity>
  </View>
);

/* ----------------- styles ----------------- */
const styles = StyleSheet.create({
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    backgroundColor: THEME.yellow,
  },
  headerTitle: { fontWeight: '800', fontSize: 16, color: '#333' },

  card: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },

  imageBox: {
    alignSelf: 'center', width: 140, height: 140,
    borderRadius: 12, overflow: 'hidden', backgroundColor: '#eee', marginBottom: 10
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  input: {
    backgroundColor: '#f6efc7',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.select({ ios: 10, android: 8 }),
    fontSize: 14,
  },

  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#fff', borderRadius: 22, marginRight: 8, marginBottom: 8,
    borderWidth: 1, borderColor: '#eee'
  },
  chipActive: { backgroundColor: THEME.green, borderColor: THEME.green },
  chipText: { color: '#333', fontWeight: '600' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, marginBottom: 6
  },
  sectionTitle: { fontWeight: '800', color: THEME.greenDark },
  addIcon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ffeaa7'
  },

  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  removeBtn: {
    marginLeft: 8, backgroundColor: THEME.danger,
    paddingHorizontal: 10, paddingVertical: 10, borderRadius: 16
  },

  rowIng: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  colName: { flex: 1.1, marginRight: 6 },
  colPart: { width: 90, marginRight: 6 },
  colQty: { width: 80, marginRight: 6 },
  colUnit: { width: 80, marginRight: 6 },
  removeBtnSmall: { backgroundColor: THEME.danger, padding: 8, borderRadius: 16 },

  actionRow: { flexDirection: 'row', marginTop: 18, justifyContent: 'center' },
  btn: {
    minWidth: 120, paddingVertical: 12, paddingHorizontal: 18,
    borderRadius: 22, alignItems: 'center', marginHorizontal: 6
  },
  btnText: { color: '#fff', fontWeight: '700' },

  center: { alignItems: 'center', justifyContent: 'center' },
});
