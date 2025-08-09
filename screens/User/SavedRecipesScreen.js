// screens/User/SavedRecipesScreen.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Platform
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { db } from '../../firebaseconfig';
import { collection, onSnapshot, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

// ---------- หมวดหมู่ ----------
const CATEGORIES = ['ทั้งหมด', 'สูตรที่ชอบ', 'สูตรทำกินเอง', 'สูตรทางบ้าน', 'สูตรรักษ์สุขภาพ'];

// ---------- ธีม ----------
const THEME = {
  bg: '#F3F5E6',
  surface: '#FFFFFF',
  green: '#4F6F16',
  greenDark: '#3B520E',
  yellow: '#F4B400',
  chipBg: '#FFF7DB',
  text: '#2B2B2B',
  subText: '#6B7280',
  border: '#E6E8EC',
  shadow: '#000',
};

export default function SavedRecipesScreen() {
  const navigation = useNavigation();

  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);

  const [recipes, setRecipes] = useState([]);
  const [favorites, setFavorites] = useState({});
  const [category, setCategory] = useState('ทั้งหมด');

  // ----------------- Auth: uid -----------------
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
    return () => unsub();
  }, []);

  // ----------------- Recipes -----------------
  useEffect(() => {
    const colRef = collection(db, 'recipes');
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRecipes(data); //(data.filter(r => r.status === 'approved' || r.uid === uid)); //เจ้าของเห็นของตัวเองได้
        setLoading(false);
      },
      (err) => {
        console.error('recipes error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // ----------------- Favorites ของ user -----------------
  useEffect(() => {
    if (!uid) {
      setFavorites({});
      return;
    }
    const colRef = collection(db, 'users', uid, 'favorites');
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => (map[d.id] = true));
        setFavorites(map);
      },
      (err) => console.error('favorites error:', err)
    );
    return () => unsub();
  }, [uid]);

  // ----------------- Filter -----------------
  const filtered = useMemo(() => {
    if (category === 'ทั้งหมด') return recipes;
    if (category === 'สูตรที่ชอบ') {
      return recipes.filter(r => !!favorites[r.id]);
    }
    return recipes.filter(r => (r.category || 'สูตรทำกินเอง') === category);
  }, [recipes, category, favorites]);

  // ----------------- Helpers -----------------
  const isOwner = useCallback((recipe) => uid && recipe.uid === uid, [uid]);

  const toggleFavorite = useCallback(
    async (recipeId) => {
      if (!uid) {
        Alert.alert('ต้องเข้าสู่ระบบก่อน', 'กรุณาเข้าสู่ระบบเพื่อบันทึกรายการโปรด');
        return;
      }
      const wasFav = !!favorites[recipeId];

      // optimistic
      setFavorites(prev => ({ ...prev, [recipeId]: !wasFav }));

      try {
        const favRef = doc(db, 'users', uid, 'favorites', recipeId);
        if (wasFav) {
          await deleteDoc(favRef);
        } else {
          await setDoc(favRef, { createdAt: Date.now() });
        }
      } catch (e) {
        // rollback
        setFavorites(prev => ({ ...prev, [recipeId]: wasFav }));
        console.error('toggleFavorite error:', e);
        Alert.alert('ผิดพลาด', 'บันทึกรายการโปรดไม่สำเร็จ');
      }
    },
    [uid, favorites]
  );

  const favCount = Object.keys(favorites).length;

  const onDelete = useCallback(
    (recipe) => {
      if (!isOwner(recipe)) {
        Alert.alert('ลบไม่ได้', 'คุณลบได้เฉพาะเมนูที่คุณสร้างเอง');
        return;
      }
      Alert.alert('ยืนยันการลบ', `ลบ “${recipe.title || 'เมนู'}” ?`, [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'recipes', recipe.id));
            } catch (e) {
              console.error('delete recipe error:', e);
              Alert.alert('ผิดพลาด', 'ลบเมนูไม่สำเร็จ');
            }
          },
        },
      ]);
    },
    [isOwner]
  );

  const onEdit = useCallback(
    (recipe) => {
      if (!isOwner(recipe)) {
        Alert.alert('แก้ไขไม่ได้', 'คุณแก้ไขได้เฉพาะเมนูที่คุณสร้างเอง');
        return;
      }
      try {
        navigation.navigate('AddEditRecipe', { recipeId: recipe.id });
      } catch {
        Alert.alert('ยังไม่มีหน้าฟอร์ม', 'โปรดสร้างหน้าสำหรับแก้ไขเมนู (AddEditRecipe)');
      }
    },
    [isOwner, navigation]
  );

  const onAdd = useCallback(() => {
    try {
      navigation.navigate('AddEditRecipe', { recipeId: null });
    } catch {
      Alert.alert('ยังไม่มีหน้าฟอร์ม', 'โปรดสร้างหน้าสำหรับเพิ่มเมนู (AddEditRecipe)');
    }
  }, [navigation]);

  const truncate = (t = '', n = 100) => (t.length > n ? t.slice(0, n).trim() + '…' : t);

  // ----------------- Render item -----------------
  const renderItem = ({ item }) => {
    const fav = !!favorites[item.id];

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.card}
        // ให้เหมือนหน้า Home: ส่งทั้ง recipe และแนบ recipeId
        onPress={() => navigation.navigate('UserRecipeDetail', { recipe: item, recipeId: item.id })}
      >
        {/* รูป + ปุ่มดาว overlay */}
        <View style={styles.imageWrap}>
          <Image
            source={item.imageUrl ? { uri: item.imageUrl } : require('../../assets/images/placeholder.png')}
            style={styles.cardImage}
          />
          <TouchableOpacity
            style={styles.starFab}
            onPress={() => toggleFavorite(item.id)}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={fav ? 'star' : 'star-border'}
              size={18}
              color={fav ? THEME.yellow : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>

        {/* เนื้อหา */}
        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.cardTitle}>
              {item.title || 'เมนูไม่มีชื่อ'}
            </Text>
            {!!item.verified && (
              <Ionicons
                name="checkmark-done-circle"
                size={18}
                color={THEME.green}
                style={{ marginLeft: 6 }}
              />
            )}
          </View>

          {!!item.summary && (
            <Text style={styles.cardSummary} numberOfLines={3}>
              {truncate(item.summary, 120)}
            </Text>
          )}

          <Text style={styles.authorText}>by {item.authorName || 'Unknown'}</Text>

          {isOwner(item) && (
            <View style={styles.ownerActions}>
              <TouchableOpacity onPress={() => onEdit(item)} style={styles.ownerBtn}>
                <MaterialIcons name="edit" size={18} color={THEME.green} />
                <Text style={styles.ownerTxt}>แก้ไข</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDelete(item)} style={styles.ownerBtn}>
                <MaterialIcons name="delete" size={18} color="#C73A3A" />
                <Text style={[styles.ownerTxt, { color: '#C73A3A' }]}>ลบ</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ----------------- UI -----------------
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="restaurant" size={18} color="#fff" />
          <Text style={styles.headerTitle}>สูตรอาหาร</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onAdd} style={styles.headerIconBtn}>
            <Ionicons name="add-circle-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chips */}
      <View style={styles.chipBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipContent}
        >
          {CATEGORIES.map((c) => {
            const label = c === 'สูตรที่ชอบ' ? `${c} (${favCount})` : c;
            const active = category === c;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.chip, active && styles.chipActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={THEME.green} />
          <Text style={{ marginTop: 8, color: THEME.greenDark }}>กำลังโหลดเมนู…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ color: THEME.subText }}>ยังไม่มีเมนูในหมวดนี้</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

/* ======================= Styles ======================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },

  // Header
  header: {
    height: 56,
    backgroundColor: THEME.green,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: { shadowColor: THEME.shadow, shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 3 },
      default: {},
    }),
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginLeft: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { padding: 6 },

  // Chips
  chipBar: { paddingTop: 8, paddingBottom: 6 },
  chipContent: { paddingHorizontal: 12, alignItems: 'center' },
  chip: {
    backgroundColor: THEME.chipBg,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: THEME.yellow, borderColor: THEME.yellow },
  chipText: { color: THEME.text, fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  // Loading
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: THEME.surface,
    borderRadius: 14,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    ...Platform.select({
      ios: { shadowColor: THEME.shadow, shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 1 },
      default: {},
    }),
  },
  imageWrap: { width: 92, height: 92, borderRadius: 12, overflow: 'hidden', backgroundColor: '#EDEDED' },
  cardImage: { width: '100%', height: '100%' },
  starFab: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 999,
    padding: 4,
  },

  cardBody: { flex: 1, marginLeft: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginRight: 6 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: THEME.green, flexShrink: 1 },
  cardSummary: { color: THEME.text, marginTop: 6, fontSize: 13, lineHeight: 18 },
  authorText: { color: THEME.subText, fontSize: 12, marginTop: 8 },

  ownerActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  ownerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ownerTxt: { fontSize: 12, color: THEME.green },
});
