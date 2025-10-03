// screens/User/UserRecipeDetail.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert, Platform
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../firebaseconfig';
import {
  doc, getDoc, collection, getDocs, updateDoc, deleteDoc
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

/* ---------- THEME ---------- */
const THEME = {
  bg: '#fefae0',
  card: '#ffffff',
  green: '#6a994e',
  greenDark: '#386641',
  yellow: '#ffd166',
  yellowDeep: '#f4ce4a',
  text: '#111827',
  line: '#e5e7eb',
  warn: '#b45309',
};

/* ---------- UNIT HELPERS ---------- */
const normalize = (s) => String(s || '').trim().toLowerCase();
// เพิ่ม/แก้ใน UNIT_MAP
const UNIT_MAP = {
  // ----- มวล (ฐาน = กรัม) -----
  'g': { cat: 'mass', base: 'g', k: 1 },
  'กรัม': { cat: 'mass', base: 'g', k: 1 },

  'kg': { cat: 'mass', base: 'g', k: 1000 },
  'กก.': { cat: 'mass', base: 'g', k: 1000 },
  'กิโลกรัม': { cat: 'mass', base: 'g', k: 1000 },
  'กิโล': { cat: 'mass', base: 'g', k: 1000 },        // เพิ่ม synonym

  'ขีด': { cat: 'mass', base: 'g', k: 100 },          // ✅ 1 ขีด = 100 กรัม
  'hg': { cat: 'mass', base: 'g', k: 100 },            // เฮกโตกรัม

  'oz': { cat: 'mass', base: 'g', k: 28.3495 },        // ออนซ์สากล
  'ออนซ์': { cat: 'mass', base: 'g', k: 28.3495 },

  'lb': { cat: 'mass', base: 'g', k: 453.59237 },      // ปอนด์
  'ปอนด์': { cat: 'mass', base: 'g', k: 453.59237 },

  // ----- ปริมาตร (ฐาน = มิลลิลิตร) -----
  'ml': { cat: 'vol', base: 'ml', k: 1 },
  'มล.': { cat: 'vol', base: 'ml', k: 1 },
  'cc': { cat: 'vol', base: 'ml', k: 1 },              // ซีซี = ml
  'ซีซี': { cat: 'vol', base: 'ml', k: 1 },

  'l': { cat: 'vol', base: 'ml', k: 1000 },
  'ลิตร': { cat: 'vol', base: 'ml', k: 1000 },

  'ช้อนชา': { cat: 'vol', base: 'ml', k: 5 },
  'ช้อนกาแฟ': { cat: 'vol', base: 'ml', k: 5 },      // synonym
  'tsp': { cat: 'vol', base: 'ml', k: 5 },

  'ชต.': { cat: 'vol', base: 'ml', k: 15 },
  'ช้อนโต๊ะ': { cat: 'vol', base: 'ml', k: 15 },
  'ช้อนแกง': { cat: 'vol', base: 'ml', k: 15 },      // synonym
  'tbsp': { cat: 'vol', base: 'ml', k: 15 },

  'ถ้วย': { cat: 'vol', base: 'ml', k: 240 },

  // ----- หน่วยนับ (ชิ้น/ตัว) (ฐาน = pc) -----
  'ชิ้น': { cat: 'piece', base: 'pc', k: 1 },
  'ตัว': { cat: 'piece', base: 'pc', k: 1 },
  'ฟอง': { cat: 'piece', base: 'pc', k: 1 },
  'หัว': { cat: 'piece', base: 'pc', k: 1 },
  'ลูก': { cat: 'piece', base: 'pc', k: 1 },
  'กลีบ': { cat: 'piece', base: 'pc', k: 1 },
  'กำมือ': { cat: 'piece', base: 'pc', k: 1 },
  'pc': { cat: 'piece', base: 'pc', k: 1 },
};

const unitInfo = (u) => UNIT_MAP[normalize(u)] || null;
const canAutoConvert = (a, b) => {
  const A = unitInfo(a), B = unitInfo(b);
  return A && B && A.cat === B.cat;
};
const convert = (val, fromU, toU) => {
  if (fromU === toU) return { ok: true, value: Number(val) };
  const A = unitInfo(fromU), B = unitInfo(toU);
  if (!A || !B || A.cat !== B.cat) return { ok: false, value: NaN };
  return { ok: true, value: (Number(val) * A.k) / B.k };
};
const parseQtyStr = (s) => {
  const str = String(s || '').trim();
  if (!str) return { qty: 0, unit: '' };
  const m = str.match(/^(-?\d+(\.\d+)?)\s*(.+)?$/);
  if (!m) return { qty: 0, unit: '' };
  return { qty: Number(m[1]), unit: (m[3] || '').trim() };
};
const parseThaiDate = (dateStr) => {
  if (!dateStr || dateStr === '-') return null;
  const MM = { 'ม.ค.':0,'ก.พ.':1,'มี.ค.':2,'เม.ย.':3,'พ.ค.':4,'มิ.ย.':5,'ก.ค.':6,'ส.ค.':7,'ก.ย.':8,'ต.ค.':9,'พ.ย.':10,'ธ.ค.':11 };
  const m = dateStr.match(/(\d{1,2})\s+([^\s]+)\s+(\d{4})/);
  if (!m) return null;
  const d = parseInt(m[1],10), mon = MM[m[2]], y = parseInt(m[3],10) - 543;
  if (mon == null) return null;
  return new Date(y, mon, d);
};

/* ---------- SCREEN ---------- */
export default function UserRecipeDetail() {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const auth = getAuth();

  const initRecipe = route.params?.recipe || null;
  const recipeId = route.params?.recipeId || initRecipe?.id || null;

  const [recipe, setRecipe] = useState(initRecipe);
  const [loading, setLoading] = useState(!initRecipe && !!recipeId);
  const [error, setError] = useState('');

  const ingredients = useMemo(
    () => (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []).map(x => ({
      name: x?.name || x?.title || '-', qty: Number(x?.qty || 0), unit: x?.unit || ''
    })),
    [recipe]
  );
  const seasonings = useMemo(() => Array.isArray(recipe?.seasonings) ? recipe.seasonings : [], [recipe]);
  const tools = useMemo(() => Array.isArray(recipe?.tools) ? recipe.tools : [], [recipe]);
  const steps = useMemo(() => Array.isArray(recipe?.steps) ? recipe.steps : [], [recipe]);
  const tags = useMemo(() => Array.isArray(recipe?.tags) ? recipe.tags : [], [recipe]);

  /* ----- Portion (บนหน้าแรก) ----- */
  const [portions, setPortions] = useState(1);
  const scaledIngredients = useMemo(() => {
    const p = Math.max(1, portions);
    return ingredients.map(i => ({
      name: i.name, qty: Number((i.qty * p).toFixed(3)), unit: i.unit
    }));
  }, [ingredients, portions]);

  /* ----- โหลดสต็อกผู้ใช้ (ใช้สำหรับ checkbox วัตถุดิบ) ----- */
  const [stockMap, setStockMap] = useState({});
  const [stockLoading, setStockLoading] = useState(false);
  const loadStock = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      setStockLoading(true);
      const snap = await getDocs(collection(db, 'users', uid, 'userIngredient'));
      const stock = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const map = {};
      for (const it of stock) {
        const key = normalize(it.name);
        const { qty, unit } = parseQtyStr(it.quantity || '');
        const exp = parseThaiDate(it.expiry || null) || new Date(8640000000000000);
        if (!map[key]) map[key] = [];
        map[key].push({ id: it.id, name: it.name, qty: Number(qty || 0), unit: unit || '', expiry: exp, raw: it });
      }
      Object.values(map).forEach(list => list.sort((a,b)=>a.expiry-b.expiry));
      setStockMap(map);
    } finally {
      setStockLoading(false);
    }
  };
  useEffect(() => { loadStock(); }, []);

  /* ----- ทำเมนูนี้ (modal หักของจากตู้) ----- */
  const [cookOpen, setCookOpen] = useState(false);
  const [useRows, setUseRows] = useState([]);
  const [insufficient, setInsufficient] = useState([]);
  const [hints, setHints] = useState({});
  const [checking, setChecking] = useState(false);

  const openCook = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) { Alert.alert('กรุณาเข้าสู่ระบบ'); return; }
    try {
      setChecking(true);
      const rows = ingredients.map((ing) => {
        const reqQty = Number((Number(ing.qty || 0) * Math.max(1, portions)).toFixed(3));
        const reqUnit = ing.unit || '';
        const key = normalize(ing.name);

        let haveQtyConv = 0;
        let mismatch = false;
        const group = stockMap[key] || [];

        for (const g of group) {
          if (canAutoConvert(g.unit, reqUnit)) {
            const cv = convert(g.qty, g.unit, reqUnit);
            haveQtyConv += cv.ok ? cv.value : 0;
          } else {
            mismatch = true;
          }
        }

        const defUse = Math.min(reqQty, haveQtyConv || 0);
        return {
          name: ing.name,
          reqQty, reqUnit,
          haveQty: haveQtyConv, haveUnit: reqUnit,
          useQty: defUse, useUnit: reqUnit,
          group, mismatch,
        };
      });

      const insuff = rows.filter(r => r.useQty < r.reqQty);
      setInsufficient(insuff);
      setUseRows(rows);
      setCookOpen(true);
    } catch {
      Alert.alert('เกิดข้อผิดพลาด', 'โหลดของในตู้ไม่สำเร็จ');
    } finally {
      setChecking(false);
    }
  };

  const setManualHint = (name, targetCat, valuePerPiece, baseUnit = 'g') => {
    setHints((h) => ({ ...h, [normalize(name)]: { cat: targetCat, perPiece: Number(valuePerPiece), base: baseUnit } }));
    setUseRows((prev) => prev.map(r => {
      if (normalize(r.name) !== normalize(name)) return r;
      const group = r.group || [];
      let have = 0;
      for (const g of group) {
        const gi = unitInfo(g.unit);
        if (gi?.cat === 'piece' && targetCat === 'mass') {
          const baseVal = g.qty * valuePerPiece;
          const cv = convert(baseVal, baseUnit, r.reqUnit);
          have += cv.ok ? cv.value : 0;
        } else if (gi?.cat === 'piece' && targetCat === 'vol') {
          const baseVal = g.qty * valuePerPiece;
          const cv = convert(baseVal, baseUnit, r.reqUnit);
          have += cv.ok ? cv.value : 0;
        } else if (gi && canAutoConvert(g.unit, r.reqUnit)) {
          const cv = convert(g.qty, g.unit, r.reqUnit);
          have += cv.ok ? cv.value : 0;
        }
      }
      const newUse = Math.min(r.reqQty, have);
      return { ...r, haveQty: have, haveUnit: r.reqUnit, useQty: newUse, mismatch: false };
    }));
  };

  const deductStock = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) { Alert.alert('กรุณาเข้าสู่ระบบ'); return; }

    const snap = await getDocs(collection(db, 'users', uid, 'userIngredient'));
    const stock = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const liveMap = {};
    for (const it of stock) {
      const key = normalize(it.name);
      const { qty, unit } = parseQtyStr(it.quantity || '');
      const exp = parseThaiDate(it.expiry || null) || new Date(8640000000000000);
      if (!liveMap[key]) liveMap[key] = [];
      liveMap[key].push({ id: it.id, name: it.name, qty: Number(qty || 0), unit: unit || '', expiry: exp, raw: it });
    }
    Object.values(liveMap).forEach(list => list.sort((a,b)=>a.expiry-b.expiry));

    const toUse = useRows.filter(r => r.useQty > 0).map(r => ({ ...r }));

    for (const row of toUse) {
      let need = Number(row.useQty);
      const key = normalize(row.name);
      const group = liveMap[key] || [];
      if (!group.length || need <= 0) continue;

      for (const g of group) {
        if (need <= 0) break;

        let useInStockUnit = 0;
        const gi = unitInfo(g.unit);
        const ri = unitInfo(row.useUnit);
        const hint = hints[key];

        if (canAutoConvert(row.useUnit, g.unit)) {
          const cv = convert(need, row.useUnit, g.unit);
          if (!cv.ok) continue;
          useInStockUnit = cv.value;
        } else if (ri?.cat !== gi?.cat && gi?.cat === 'piece' && hint && hint.cat) {
          const base = convert(need, row.useUnit, hint.base);
          if (!base.ok || !hint.perPiece) continue;
          useInStockUnit = base.value / hint.perPiece;
        } else if (ri?.cat === 'piece' && gi?.cat !== 'piece' && hint && hint.cat) {
          const baseValue = need * hint.perPiece;
          const cv = convert(baseValue, hint.base, g.unit);
          if (!cv.ok) continue;
          useInStockUnit = cv.value;
        } else {
          continue;
        }

        const remain = g.qty - useInStockUnit;
        const colRef = collection(db, 'users', uid, 'userIngredient');
        const docRef = doc(colRef, g.id);

        if (remain > 0) {
          await updateDoc(docRef, { quantity: `${Number(remain.toFixed(3))} ${g.unit}` });
          g.qty = remain;
          const back = convert(useInStockUnit, g.unit, row.useUnit);
          need -= back.ok ? back.value : 0;
        } else {
          await deleteDoc(docRef);
          const back = convert(g.qty, g.unit, row.useUnit);
          need -= back.ok ? back.value : 0;
          g.qty = 0;
        }
      }
    }

    Alert.alert('สำเร็จ', 'หักวัตถุดิบจากตู้เย็นเรียบร้อย');
    setCookOpen(false);
    loadStock();
  };

  /* ---------- UI ---------- */
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={THEME.green} />
        <Text style={{ marginTop: 8, color: '#666' }}>กำลังโหลดข้อมูล…</Text>
      </View>
    );
  }
  if (error || !recipe) {
    return (
      <View style={styles.centered}>
        <Text>{error || 'ไม่พบข้อมูลสูตรอาหาร'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 10 }}>
          <Text style={{ color: THEME.green, fontWeight: '600' }}>ย้อนกลับ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }} edges={['top','bottom']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        keyboardShouldPersistTaps="always"
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {recipe.title || 'ไม่มีชื่อเมนู'}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        {/* รูปบนสุด */}
        <Image
          source={recipe.imageUrl ? { uri: recipe.imageUrl } : require('../../assets/images/sample-food.jpg')}
          style={styles.heroImage}
        />

        {/* Portion แถบยาว */}
        <View style={styles.portionBar}>
          <Text style={styles.portionBarLabel}>จำนวน</Text>
          <View style={styles.portionBarCtrls}>
            <TouchableOpacity onPress={() => setPortions(Math.max(1, portions-1))} style={styles.roundBtn}>
              <Text style={styles.roundTxt}>-</Text>
            </TouchableOpacity>
            <Text style={styles.portionNum}>{portions}</Text>
            <TouchableOpacity onPress={() => setPortions(portions+1)} style={styles.roundBtn}>
              <Text style={styles.roundTxt}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* วัตถุดิบ (Checkbox ถ้ามีของในตู้) */}
        <Text style={styles.sectionTitle}>วัตถุดิบ</Text>
        <View style={styles.cardList}>
          {scaledIngredients.map((i, idx) => {
            const key = normalize(i.name);
            const group = stockMap[key] || [];
            const hasAny = group.length > 0;

            // รวมของในตู้ที่ "แปลงหน่วยเป็นหน่วยของสูตรได้"
            let haveConv = 0;
            for (const g of group) {
              if (canAutoConvert(g.unit, i.unit)) {
                const cv = convert(g.qty, g.unit, i.unit);
                if (cv.ok) haveConv += cv.value;
              }
            }

            const insufficient = hasAny && haveConv + 1e-9 < i.qty; // มีของแต่ไม่พอ

            return (
              <View key={idx} style={styles.checkboxRow}>
                <Ionicons
                  name={hasAny ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={hasAny ? '#166534' : '#9ca3af'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkboxText} numberOfLines={2}>
                    {i.name}  {i.qty} {i.unit}
                  </Text>

                  {insufficient && (
                    <Text style={styles.warnLine}>
                      มีอยู่ {Number(haveConv.toFixed(2))} {i.unit} • ต้องใช้ {i.qty} {i.unit}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
          {stockLoading && (
            <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginTop:6 }}>
              <ActivityIndicator size="small" color="#111" />
              <Text style={{ color:'#64748B' }}>กำลังเช็คของในตู้…</Text>
            </View>
          )}
        </View>

        {/* เครื่องปรุง (dot) */}
        {seasonings.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>เครื่องปรุง</Text>
            <View style={styles.cardList}>
              {seasonings.map((s, idx) => (
                <View key={idx} style={styles.dotRow}>
                  <View style={styles.dot} />
                  <Text style={styles.dotText}>{String(s)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* อุปกรณ์ (dot) */}
        {tools.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>อุปกรณ์</Text>
            <View style={styles.cardList}>
              {tools.map((t, idx) => (
                <View key={idx} style={styles.dotRow}>
                  <View style={styles.dot} />
                  <Text style={styles.dotText}>{String(t)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* วิธีทำ */}
        {steps.length > 0 && (
          <>
            <Text style={styles.sectionTitleAlt}>วิธีทำ</Text>
            {steps.map((s, idx) => (
              <View key={idx} style={styles.stepCard}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{idx+1}</Text>
                </View>
                <Text style={styles.stepText}>{String(s)}</Text>
              </View>
            ))}
          </>
        )}

        {/* แท็ก */}
        {Array.isArray(tags) && tags.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>แท็ก</Text>
            <View style={styles.tagContainer}>
              {tags.map((tag, idx) => (
                <Text key={idx} style={styles.tag}>{String(tag)}</Text>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/*  Comment FAB === */}
<TouchableOpacity
  style={[styles.commentFab, { bottom: 76 + insets.bottom }]}
  onPress={() => navigation.navigate('CommentScreen', {
    recipeId: recipeId || recipe?.id,
    recipeTitle: recipe?.title || '',
  })}
  activeOpacity={0.9}
>
  <Ionicons name="chatbubble-ellipses" size={18} color="#111" />
  <Text style={styles.commentFabTxt}>คอมเมนต์</Text>
</TouchableOpacity>


      {/* Footer action */}
      <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
        <TouchableOpacity style={styles.cookBtn} onPress={openCook} disabled={checking || stockLoading}>
          {checking || stockLoading ? <ActivityIndicator color="#111" /> : (
            <>
              <Ionicons name="restaurant" size={18} color="#111" />
              <Text style={styles.cookBtnTxt}>ทำเมนูนี้</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal หักจากตู้ (เหมือนเดิม) */}
      <Modal visible={cookOpen} animationType="slide" transparent onRequestClose={() => setCookOpen(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { paddingBottom: 12 + insets.bottom * 0.6 }]}>
            <View style={{ paddingRight: 36 }}>
              <Text style={styles.modalTitle}>ทำเมนูนี้</Text>
              <Text style={styles.modalSub}>{recipe.title || ''} • {portions} ที่</Text>
              <TouchableOpacity style={styles.modalClose} onPress={() => setCookOpen(false)}>
                <Ionicons name="close" size={22} color="#111" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 8 }}>
              {useRows.map((r, idx) => (
                <View key={idx} style={styles.useRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ingName}>{r.name}</Text>
                    <Text style={styles.ingMeta}>
                      ต้องใช้ {Number(r.reqQty.toFixed(3))} {r.reqUnit} • ในตู้ {Number((r.haveQty || 0).toFixed(3))} {r.haveUnit}
                    </Text>
                  </View>

                  <View style={styles.useEdit}>
                    <TouchableOpacity
                      onPress={() => setUseRows(rows => rows.map((x,i)=> i===idx? { ...x, useQty: Math.max(0, Number((x.useQty - 1).toFixed(3))) } : x))}
                      style={[styles.smallBtn, { opacity: r.useQty<=0?0.5:1 }]}
                    >
                      <Text style={styles.smallBtnTxt}>-</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.useInput}
                      keyboardType="numeric"
                      value={String(Number(r.useQty.toFixed(3)))}
                      onChangeText={(t)=> {
                        const v = Math.max(0, Number(t.replace(',', '.')) || 0);
                        setUseRows(rows => rows.map((x,i)=> i===idx? { ...x, useQty: v } : x));
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setUseRows(rows => rows.map((x,i)=> i===idx? { ...x, useQty: Number((x.useQty + 1).toFixed(3)) } : x))}
                      style={styles.smallBtn}
                    >
                      <Text style={styles.smallBtnTxt}>+</Text>
                    </TouchableOpacity>
                    <Text style={{ marginLeft: 6 }}>{r.useUnit}</Text>
                  </View>

                  {r.mismatch && (
                    <TouchableOpacity
                      style={styles.hintBtn}
                      onPress={() => {
                        if (Platform.OS === 'ios') {
                          Alert.prompt(
                            `ตั้งอัตราส่วนสำหรับ “${r.name}”`,
                            'ใส่ค่าประมาณ: 1 ชิ้น/ตัว ≈ กี่กรัม (หรือมิลลิลิตร)',
                            (text) => {
                              const per = Number(text.replace(',', '.')) || 0;
                              if (per > 0) setManualHint(r.name, 'mass', per, 'g');
                            }
                          );
                        } else {
                          Alert.alert('ตั้งอัตราส่วน', 'บน Android/เว็บ ถ้าต้องการกล่องกรอกตัวเลข แจ้งได้เลยครับ เดี๋ยวผมเพิ่ม input modal ให้');
                        }
                      }}
                    >
                      <MaterialIcons name="tune" size={16} color={THEME.greenDark} />
                      <Text style={styles.hintBtnTxt}>ตั้งอัตราส่วน</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.confirmBtn} onPress={deductStock}>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.confirmTxt}>ยืนยันหักวัตถุดิบ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
    backgroundColor: '#fff', borderRadius: 14, padding: 10,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2
  },
  headerTitle: { fontSize: 18, fontWeight: '800', marginLeft: 10, color: THEME.text, flex: 1 },

  heroImage: { width: '100%', height: 200, borderRadius: 12, backgroundColor:'#eee', marginBottom: 10 },

  portionBar: {
    backgroundColor: THEME.yellow, borderRadius: 12, padding: 12,
    flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: 12
  },
  portionBarLabel: { fontWeight:'800', color:'#111', fontSize:16 },
  portionBarCtrls: { flexDirection:'row', alignItems:'center', gap:8 },
  roundBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems:'center', justifyContent:'center' },
  roundTxt: { fontWeight:'900', color:'#111' },
  portionNum: { fontWeight:'900', minWidth: 30, textAlign:'center', color: THEME.greenDark, fontSize:16 },

  sectionTitle: {
    backgroundColor: THEME.yellowDeep, color: '#111', fontWeight: '900',
    paddingHorizontal: 12, paddingVertical: 6, borderTopLeftRadius: 10, borderTopRightRadius: 10,
    marginTop: 10
  },
  sectionTitleAlt: {
    backgroundColor: THEME.yellowDeep, color: '#111', fontWeight: '900',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginTop: 10, marginBottom: 8
  },

  cardList: {
    backgroundColor:'#fff', borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
    borderWidth: 1, borderColor: THEME.line, padding: 10, marginBottom: 8
  },

  // ingredient checkbox row
  checkboxRow: { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:6 },
  checkboxText: { color:'#111', fontWeight:'600', flex: 1 },

  // dot list
  dotRow: { flexDirection:'row', alignItems:'flex-start', gap:8, paddingVertical:6 },
  dot: { width:6, height:6, borderRadius:3, backgroundColor:'#111', marginTop:7 },
  dotText: { color:'#111', flex:1 },

  // steps
  stepCard: {
    backgroundColor:'#fff', borderRadius: 12, padding: 12, borderWidth:1, borderColor: THEME.line,
    flexDirection:'row', alignItems:'flex-start', gap: 10, marginTop: 8
  },
  stepBadge: { backgroundColor:'#111', width: 26, height: 26, borderRadius: 13, alignItems:'center', justifyContent:'center' },
  stepBadgeText: { color:'#fff', fontWeight:'800' },
  stepText: { color: THEME.text, flex: 1 },

  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  tag: {
    backgroundColor: '#dff0d8', color: '#2e7d32',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginRight: 8, marginBottom: 6, fontSize: 12
  },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff', padding: 12,
    borderTopWidth: 1, borderTopColor: THEME.line
  },
  cookBtn: {
    backgroundColor: THEME.yellow, borderRadius: 999, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8
  },
  cookBtnTxt: { fontWeight: '800', color: '#111', marginLeft: 8 },

  /* modal */
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center' },
  modalCard: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16, padding: 16, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111' },
  modalSub: { color: '#64748B', marginTop: 2 },
  modalClose: { position: 'absolute', right: -8, top: -8, padding: 6 },

  useRow: { borderWidth: 1, borderColor: THEME.line, borderRadius: 12, padding: 10, marginTop: 10 },
  ingName: { fontWeight: '800', color: '#111' },
  ingMeta: { color: '#475569', marginTop: 2 },

  useEdit: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  smallBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems:'center', justifyContent:'center' },
  smallBtnTxt: { fontWeight: '900', color: '#111' },
  useInput: { marginHorizontal: 6, minWidth: 72, textAlign: 'center', borderWidth: 1, borderColor: THEME.line, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8 },

  confirmBtn: {
    marginTop: 12, backgroundColor: THEME.green, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8
  },
  confirmTxt: { color: '#fff', fontWeight: '800', marginLeft: 6 },
  warnLine: {
  color: '#d97706',  
  marginTop: 2,
  fontSize: 12,
  fontWeight: '700',
},
// === NEW: styles for comment FAB ===
commentFab: {
  position: 'absolute',
  right: 16,
  // bottom ถูกกำหนดแบบ dynamic ตอนใช้งาน
  backgroundColor: THEME.yellow,
  borderRadius: 999,
  paddingVertical: 12,
  paddingHorizontal: 16,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
},
commentFabTxt: { fontWeight: '800', color: '#111' },

});
