// screens/User/AddEditRecipeScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ScrollView, Alert, ActivityIndicator, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

import { db, storage } from '../../firebaseconfig';
import {
  addDoc, collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import Tag from '../../components/Tag';

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
const sanitize = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** ตรวจสอบสิทธิ์ admin */
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

  const [tags, setTags]   = useState([]);
  const [tagInput, setTagInput] = useState('');
  // ฟอร์มหลัก
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  const [imageUrl, setImageUrl] = useState('');
  const [imagePath, setImagePath] = useState(''); // path ใน storage

  // รายการย่อย
  const [ingredients, setIngredients] = useState([]); // [{name, part, qty, unit}]
  const [seasonings, setSeasonings] = useState([]);   // string[]
  const [equipments, setEquipments] = useState([]);   // string[]
  const [steps, setSteps] = useState([]);             // string[]

  // ตัวเลือกวัตถุดิบจาก Firestore -> ingredientOptions
  const [ingOptions, setIngOptions] = useState([]);   // [{id, name, defaultUnit, defaultPart}]
  const [ingOptLoading, setIngOptLoading] = useState(true);
  const [openUnitIdx, setOpenUnitIdx] = useState(null);
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
        setDescription(d.description || '');
        setImageUrl(d.imageUrl || '');
        setImagePath(d.imagePath || '');

        setIngredients(Array.isArray(d.ingredients) ? d.ingredients : []);
        setSeasonings(Array.isArray(d.seasonings) ? d.seasonings : []);
        setEquipments(Array.isArray(d.equipments) ? d.equipments : []);
        setSteps(Array.isArray(d.steps) ? d.steps : []);
        setTags(Array.isArray(d?.tags) ? d.tags : []);
      } catch (e) {
        console.error('load recipe error:', e);
        Alert.alert('โหลดข้อมูลไม่สำเร็จ', 'โปรดลองใหม่');
      } finally {
        setLoading(false);
      }
    })();
  }, [recipeId, navigation]);

  // โหลด ingredientOptions ทั้งชุดแล้วกรองในเครื่อง
  useEffect(() => {
  (async () => {
    try {
      setIngOptLoading(true);
      const snap = await getDocs(collection(db, 'ingredientOptions'));
      const rows = snap.docs.map(d => {
        const x = d.data() || {};
        const name = sanitize(
          x.name ?? x.label ?? x.title ?? x.text ?? x.value ?? ''
        );
        // รองรับ units เป็น array
        const unitsArr = Array.isArray(x.units) ? x.units.map(sanitize).filter(Boolean) : [];
        const defaultUnit = sanitize(x.defaultUnit ?? x.unit ?? (unitsArr[0] ?? ''));
        const defaultPart = sanitize(x.defaultPart ?? x.part ?? '');
        return {
          id: d.id,
          name,
          defaultUnit,
          defaultPart,
          units: unitsArr,
        };
      }).filter(o => o.name);  // ต้องมีชื่อถึงจะเอา
      rows.sort((a, b) => a.name.localeCompare(b.name, 'th'));
      setIngOptions(rows);
    } catch (e) {
      console.warn('load ingredientOptions error:', e?.message);
    } finally {
      setIngOptLoading(false);
    }
  })();
}, []);

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
      const path = `recipes/${uid || 'guest'}/${Date.now()}.jpg`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

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
        description: description.trim(),
        imageUrl: imageUrl || '',
        imagePath: imagePath || '',
        tags: tags.filter(Boolean),
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

  const addTag = () => {
  const v = (tagInput || '').trim();
  if (!v) return;
  // กันซ้ำ และจำกัดจำนวน (เช่น 8 แท็ก)
  if (tags.includes(v)) return;
  if (tags.length >= 8) return Alert.alert('ใส่แท็กได้สูงสุด 8 รายการ');
  setTags(prev => [...prev, v]);
  setTagInput('');
};
const removeTag = (idx) => {
  setTags(prev => prev.filter((_, i) => i !== idx));
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

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="always">
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
            value={description}
            onChangeText={setDescription}
          />
          <Text style={styles.sectionTitle}>ประเภทอาหาร / แท็ก</Text>
          <View style={{ flexDirection:'row', alignItems:'center', marginBottom: 8 }}>
            <TextInput
              style={[styles.input, { flex:1, marginRight:8 }]}
              placeholder="พิมพ์แล้วกด + เช่น แกง, ต้ม, เผ็ดน้อย"
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              returnKeyType="done"
            />
            <TouchableOpacity onPress={addTag} activeOpacity={0.85}>
              <Ionicons name="add-circle-outline" size={28} color="#4CAF50" />
            </TouchableOpacity>
          </View>

          {/* ตัวอย่างหมวดที่กดเลือกเร็ว ๆ */}
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom: 8 }}>
            {['แกง','ผัด','ทอด','ต้ม','ยำ','นึ่ง','สุขภาพ','มังสวิรัติ'].map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => { setTagInput(''); if (!tags.includes(s)) setTags(prev => [...prev, s]); }}
                style={{ paddingHorizontal:12, paddingVertical:6, borderRadius:16, backgroundColor:'#FFF7DB', borderWidth:1, borderColor:'#E6E8EC' }}
              >
                <Text style={{ color:'#6B7280' }}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* แสดงแท็กที่เลือกแล้ว */}
          <View style={{ flexDirection:'row', flexWrap:'wrap' }}>
            {tags.map((t, i) => (
              <Tag key={i} label={t} onRemove={() => removeTag(i)} />
            ))}
          </View>

          {/* วัตถุดิบ */}
          <SectionHeader
            title="วัตถุดิบ"
            onAdd={() => setIngredients((prev) => [...prev, { _id: String(Date.now()),name: '', qty: '', unit: '' }])}
          />
          {ingredients.map((it, idx) => (
            <RowIngredient
              key={it._id ?? idx}
              rowIndex={idx}
              openUnitIdx={openUnitIdx}
              setOpenUnitIdx={setOpenUnitIdx}
              value={it}
              onChange={(key, val) => setIngredients((prev) => prev.map((x, i) => i === idx ? { ...x, [key]: val } : x))}
              onRemove={() => setIngredients((prev) => prev.filter((_, i) => i !== idx))}
              options={ingOptions}
              optionsLoading={ingOptLoading}
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

/** แถววัตถุดิบ (มี Auto-suggest จาก ingredientOptions) */
/** แถววัตถุดิบ (แก้เวอร์ชันนี้) */
const RowIngredient = ({
  value, onChange, onRemove,
  options = [], optionsLoading = false,
  rowIndex, openUnitIdx, setOpenUnitIdx
}) => {
  const [focused, setFocused] = useState(false);
  const unitOpen = openUnitIdx === rowIndex;

  const nameText = String(value?.name || '');
  const query = nameText.trim().toLowerCase();

  // หา option ที่ตรงกับชื่อเพื่อดึง units
  const matchedOption = useMemo(() => {
    const n = (value?.name || '').trim().toLowerCase();
    if (!n) return null;
    // ใช้ “เท่ากันเป๊ะ” ก่อน ถ้าไม่เจอค่อย fallback เป็น includes
    return (
      options.find(o => (o.name || '').toLowerCase() === n) ||
      options.find(o => (o.name || '').toLowerCase().includes(n)) ||
      null
    );
  }, [options, value?.name]);

  const unitList = useMemo(() => {
    if (!matchedOption) return [];
    if (Array.isArray(matchedOption.units) && matchedOption.units.length) {
      return matchedOption.units;
    }
    return matchedOption.defaultUnit ? [matchedOption.defaultUnit] : [];
  }, [matchedOption]);

  // รายการแนะนำชื่อ
  const suggestions = useMemo(() => {
    if (!focused || !query) return [];
    const found = options.filter(o => (o.name || '').toLowerCase().includes(query));
    return found.slice(0, 8);
  }, [options, query, focused]);

  const pickSuggestion = (opt) => {
    onChange('name', opt.name);
    // เติมหน่วยเริ่มต้นถ้ายังไม่มี
    const firstUnit = (opt.units && opt.units.length) ? opt.units[0] : opt.defaultUnit;
    if (!value?.unit && firstUnit) onChange('unit', firstUnit);
    // ปิด suggestion และเปิด dropdown หน่วยทันที
    setFocused(false);
    setOpenUnitIdx(rowIndex);
  };

  return (
    <View
      style={[
        styles.rowIng,
        unitOpen ? { zIndex: 2000, elevation: 16 } : { zIndex: 1000 - rowIndex }
      ]}
    >
      {/* ชื่อวัตถุดิบ + Suggestion */}
      <View style={[styles.colNameWrap, { flex: 1.2 }]}>
        <TextInput
          style={[styles.input]}
          placeholder="ชื่อ (เช่น ไข่ไก่)"
          value={value.name}
          onChangeText={(t) => { onChange('name', t); setOpenUnitIdx(null); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
        />
        {focused && (
          <View style={styles.suggestBox}>
            {optionsLoading ? (
              <View style={styles.suggestLoading}>
                <ActivityIndicator size="small" color={THEME.greenDark} />
                <Text style={{ marginLeft: 6, color: '#475569' }}>กำลังโหลดตัวเลือก…</Text>
              </View>
            ) : suggestions.length > 0 ? (
              suggestions.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={styles.suggestItem}
                  activeOpacity={0.8}
                  onPressIn={() => pickSuggestion(opt)}
                >
                  <Text style={styles.suggestText} numberOfLines={1}>
                    {opt.name || opt.id}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.suggestEmpty}>
                <Text style={{ color: '#64748B' }}>ไม่พบ “{nameText}”</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <TextInput
        style={[styles.input, styles.colQty]}
        placeholder="ปริมาณ"
        keyboardType="numeric"
        value={String(value.qty ?? '')}
        onChangeText={(t) => onChange('qty', t)}
      />

      {/* หน่วย */}
      <View style={styles.unitWrap}>
        <TouchableOpacity
          style={styles.unitBox}
          activeOpacity={0.8}
          onPress={() => {
            // ปิด suggestion เผื่อมันบังปุ่ม
            setFocused(false);
            setOpenUnitIdx(unitOpen ? null : rowIndex);
          }}
        >
          <Text style={styles.unitText} numberOfLines={1}>
            {value.unit ? String(value.unit) : 'เลือกหน่วย'}
          </Text>
          <Ionicons name={unitOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#111" />
        </TouchableOpacity>

        {unitOpen && (
          <View style={styles.unitDropdown}>
            {unitList.length ? (
              unitList.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={styles.unitItem}
                  activeOpacity={0.8}
                  onPressIn={() => { onChange('unit', u); setOpenUnitIdx(null); }}
                >
                  <Text style={styles.unitItemText}>{u}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.unitEmpty}>
                <Text style={styles.unitEmptyText}>ไม่มีหน่วยสำหรับวัตถุดิบนี้</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <TouchableOpacity onPress={onRemove} style={styles.removeBtnSmall}>
        <MaterialIcons name="delete" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};


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

  rowIng: {
  flexDirection:'row',
  alignItems:'center',
  marginBottom: 8,
  position: 'relative',     
  overflow: 'visible',
},
  // เดิม: colName เป็นสไตล์ให้ TextInput โดยตรง → ปรับเป็น wrapper เพื่อวาง Suggestion
  colNameWrap: {
    flex: 1.1,
    marginRight: 6,
    position: 'relative',
    zIndex: 1500, // ให้อยู่เหนือ input อื่น
  },
  colQty: { width: 80, marginRight: 6 },
  colUnit: { width: 80, marginRight: 6 },
  removeBtnSmall: { backgroundColor: THEME.danger, padding: 8, borderRadius: 16 },

  // Suggestion dropdown
  suggestBox: {
  position: 'absolute', left: 0, right: 0, top: 44,
  backgroundColor: '#fff',
  borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB',
  shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,       // ✅ Android
  zIndex: 1600,      // ✅ iOS/Android ใหม่
  maxHeight: 240,
},
  colNameWrap: { flex: 1.1, marginRight: 6, position: 'relative', zIndex: 9999 },
  suggestLoading: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12,
  },
  suggestItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  suggestText: { flex: 1, color: '#111' },
  suggestMeta: { color: '#64748B', marginLeft: 8, fontSize: 12 },
  suggestEmpty: { paddingVertical: 10, paddingHorizontal: 12 },
  
  actionRow: { flexDirection: 'row', marginTop: 18, justifyContent: 'center' },
  btn: {
    minWidth: 120, paddingVertical: 12, paddingHorizontal: 18,
    borderRadius: 22, alignItems: 'center', marginHorizontal: 6
  },
  btnText: { color: '#fff', fontWeight: '700' },

  center: { alignItems: 'center', justifyContent: 'center' },
  // ใน styles.suggestBox แทนที่ด้วย
  suggestBox: {
    position: 'absolute',
    left: 0, right: 0, top: 44,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,     // ⬅️ สำคัญบน Android
    zIndex: 9999,     // ⬅️ สำคัญบน iOS/Android ใหม่
    maxHeight: 240,
  },
  // และใน styles.colNameWrap ให้มี zIndex สูงไว้ด้วย
  colNameWrap: {
    flex: 1.1, marginRight: 6, position: 'relative', zIndex: 9999,
  },
  // กล่องรอบ ๆ ช่องหน่วย
unitWrap: {
  width: 96,
  marginRight: 6,
  position: 'relative',
  zIndex: 1700,         // ให้ลอยเหนือคอมโพเนนต์อื่น
},
unitBox: {
  backgroundColor: '#f6efc7',
  borderRadius: 22,
  paddingHorizontal: 12,
  paddingVertical: Platform.select({ ios: 10, android: 8 }),
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
unitText: { color: '#111', maxWidth: 70 },
unitDropdown: {
  position: 'absolute',
  left: 0, right: 0,
  top: 44,                // สูงพอให้ลงใต้ปุ่ม
  backgroundColor: '#fff',
  borderRadius: 12,
  borderWidth: 1, borderColor: '#E5E7EB',
  overflow: 'hidden',
  shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
  shadowOffset: { width: 0, height: 6 },
  elevation: 8,          // Android
  zIndex: 9999,
  maxHeight: 220,
},
unitItem: {
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
},
unitItemText: { color: '#111' },
unitEmpty: { paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center' },
unitEmptyText: { color: '#64748B' },


});
