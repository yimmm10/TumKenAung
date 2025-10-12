// screens/User/SavedRecipesScreen.js
import React, { useLayoutEffect, useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Platform, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { db } from '../../firebaseconfig';
import { collection, onSnapshot, doc, deleteDoc, setDoc, query, where } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

// ---------- ธีม ----------
const THEME = {
  bg: '#fefae0',
  surface: '#FFFFFF',
  green: '#6a994e',
  greenDark: '#556b2f',
  yellow: '#f4a261',
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
  const [fridgeMap, setFridgeMap] = useState({}); 
  // ✅ กล่องค้นหา (ค้างอยู่บนจอเสมอ)
  const [search, setSearch] = useState('');

  // ----------------- Auth: uid -----------------
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
    return () => unsub();
  }, []);

  // ----------------- Recipes -----------------
  useEffect(() => {
    const colRef = collection(db, 'recipes');
    const qRef = query(colRef, where('status', '==', 'approved'));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRecipes(data);
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
      setFridgeMap({});
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
  
   // ----------------- Fridge items ของ user (ไว้เช็ค “ทำได้”) -----------------
 useEffect(() => {
   if (!uid) return;
   const colRef = collection(db, 'users', uid, 'userIngredient');
   const unsub = onSnapshot(
     colRef,
     (snap) => {
       const map = {};
      snap.docs.forEach((d) => {
        const x = d.data() || {};
        const raw = String(x.name || '');
        const k   = keyify(raw);
        if (k) {
          map[k] = true;          // คีย์นอร์มัลไลซ์
          map[raw.toLowerCase().trim()] = true; // กันกรณีโค้ดเก่าเรียกแบบเดิม
        }
      });
       setFridgeMap(map);
     },
     (err) => console.error('fridge error:', err)
   );
   return () => unsub();
 }, [uid]);
const keyify = (s = '') => {
  return String(s)
    .toLowerCase()
    .trim()
    // ตัดข้อความในวงเล็บออก เช่น "น้ำตาล (ทรายขาว)" -> "น้ำตาล"
    .replace(/\(.*?\)|\[.*?\]|\{.*?\}/g, '')
    // ตัดสัญลักษณ์/เครื่องหมายวรรคตอนทั่วไป
    .replace(/[~!@#$%^&*_\-+=|\\:;"'<>,.?/·•–—]/g, ' ')
    // รวมช่องว่างซ้ำให้เหลือช่องเดียว
    .replace(/\s+/g, ' ')
    // ลบช่องว่างทั้งหมดเพื่อคีย์เทียบ (กันกรณี "ใบ โหระพา" vs "ใบโหระพา")
    .replace(/\s/g, '');
};
const missingFromFridge = (recipe, map) => {
  const list = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  const names = list
    .map(it => (typeof it === 'string' ? it : (it?.name ?? it?.ingredientName ?? it?.title ?? '')))
    .map(n => keyify(n))
    .filter(Boolean);
  const uniq = Array.from(new Set(names));
  const missing = uniq.filter(n => !map[n]);
  return missing;
};
const canCookWithFridge = (recipe, map) => {
  const list = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  if (!list.length) return false;
  return list.every((it) => {
    const raw = (typeof it === 'string' ? it : (it?.name ?? it?.ingredientName ?? it?.title ?? ''));
    const k = keyify(raw);
    return !!map[k];
  });
};
  // ----------------- Filter + Search -----------------
  const filtered = useMemo(() => {
  const q = search.trim().toLowerCase();
   if (!q) return recipes;

   return recipes.filter((r) => {
     const title = String(r.title || '').toLowerCase();
     const author = String(r.authorName || '').toLowerCase();
     return title.includes(q) || author.includes(q);
   });
 }, [recipes, search]);

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
      setFavorites((prev) => ({ ...prev, [recipeId]: !wasFav }));

      try {
        const favRef = doc(db, 'users', uid, 'favorites', recipeId);
        if (wasFav) {
          await deleteDoc(favRef);
        } else {
          await setDoc(favRef, { createdAt: Date.now() });
        }
      } catch (e) {
        // rollback
        setFavorites((prev) => ({ ...prev, [recipeId]: wasFav }));
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
      Alert.alert('ยืนยันการลบ', `ลบ "${recipe.title || 'เมนู'}" ?`, [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'recipes', recipe.id));
              Alert.alert('สำเร็จ', 'ลบเมนูเรียบร้อยแล้ว');
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
    const isMyRecipe = isOwner(item);
    const missing = missingFromFridge(item, fridgeMap);
    const canCook = (Array.isArray(item.ingredients) && item.ingredients.length > 0 && missing.length === 0);
    const status = String(item.status || 'approved').toLowerCase();
   const statusColor =
     status === 'approved' ? '#16a34a' :
     status === 'pending'  ? '#f59e0b' :
     status === 'rejected' ? '#dc2626' : '#6b7280';

    // ✅ Description ใต้ชื่อเมนู (fallback หลายคีย์)
    const desc =
      item.description ||
      item.desc ||
      item.details ||
      item.shortDescription ||
      '';

    // ✅ ผู้เขียน: แสดงเฉพาะเมื่อมีจริง (ไม่ขึ้น "by Unknown")
    const author = String(item.authorName || '').trim();

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.card}
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
            {isMyRecipe && (
              <View style={styles.ownerBadge}>
                <Text style={styles.ownerBadgeText}>ของฉัน</Text>
              </View>
            )}
            
          </View>

          {/* ✅ คำบรรยายใต้ชื่อเมนู */}
          {!!desc && (
            <Text style={styles.cardSummary} numberOfLines={3}>
              {truncate(String(desc), 120)}
            </Text>
          )}
          {Array.isArray(item.ingredients) && item.ingredients.length > 0 && (
            canCook ? (
              <Text style={[styles.cardSummary, { color: THEME.green }]}>
                มีวัตถุดิบครบ {item.ingredients.length} รายการ พร้อมทำได้เลย
              </Text>
            ) : (
              <Text style={[styles.cardSummary, { color: '#dc2626' }]}>
                ขาดวัตถุดิบ {missing.length} รายการ
                {missing.length > 0 ? `: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}` : ''}
              </Text>
            )
          )}
          {/* แถวข้อมูลผู้เขียน/เวลา */}
          <View style={styles.metaRow}>
            {/* เว้นตำแหน่งซ้ายไว้ — แสดงเฉพาะเมื่อมีผู้เขียน */}
            {author ? <Text style={styles.authorText}>by {author}</Text> : <View />}

            {item.duration ? (
              <Text style={styles.durationText}>{item.duration} นาที</Text>
            ) : (
              <View />
            )}
          </View>

          {isMyRecipe && (
            <View style={styles.ownerActions}>
              <TouchableOpacity onPress={() => onEdit(item)} style={styles.ownerBtn}>
                <MaterialIcons name="edit" size={16} color={THEME.green} />
                <Text style={styles.ownerTxt}>แก้ไข</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDelete(item)} style={styles.ownerBtn}>
                <MaterialIcons name="delete" size={16} color="#d32f2f" />
                <Text style={[styles.ownerTxt, { color: '#d32f2f' }]}>ลบ</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  useLayoutEffect(() => {
  navigation.setOptions({
    headerTitle: () => (
      <View style={styles.headerTitleWrap}>
        <Image source={require('../../assets/logo.png')} style={styles.headerLogo} />
        <Text style={styles.headerTitleText}>สูตรอาหาร</Text>
      </View>
    ),
    headerRight: () => (
      <TouchableOpacity 
        onPress={onAdd} 
        style={styles.headerIconButton}
      >
        <Ionicons name="add-circle-outline" size={24} color="#FFF" />
      </TouchableOpacity>
    ),
    headerStyle: { backgroundColor: '#425010' },
    headerTintColor: '#fff',
    headerShown: true,
  });
}, [navigation]);

  // ----------------- UI -----------------
return (
  <SafeAreaView style={styles.safeContainer} edges={['left', 'right']}>
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#666" style={{ marginHorizontal: 8 }} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="ค้นหาชื่อเมนู หรือชื่อผู้เขียน"
          placeholderTextColor="#999"
          style={styles.searchInput}
          returnKeyType="search"
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')} style={{ paddingHorizontal: 8 }}>
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#F7F0CE" />
          <Text style={{ marginTop: 12, color: '#F7F0CE', fontSize: 16 }}>กำลังโหลดเมนู…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="restaurant-outline" size={64} color="#F7F0CE" />
              <Text style={styles.emptyTitle}>ไม่พบเมนูในหมวดนี้</Text>
            </View>
          }
        />
      )}
    </View>
  </SafeAreaView>
);
}

/* ======================= Styles ======================= */
const styles = StyleSheet.create({
  safeContainer: { 
    flex: 1, 
    backgroundColor: '#425010'  // เขียวเข้ม
  },
  container: { 
    flex: 1, 
    backgroundColor: '#FFF8E1' // เขียวกลาง
  },
  // เพิ่มใน styles
headerTitleWrap: {
  flexDirection: 'row',
  alignItems: 'center',
},
headerLogo: {
  width: 32,
  height: 32,
  marginRight: 8,
  borderRadius: 6,
},

headerTitleText: {
  color: '#FFF',
  fontSize: 18,
  fontWeight: 'bold',
},
headerIconButton: {
  paddingRight: 12,
  paddingLeft: 8,
},
  

  // Header (ใช้สไตล์จาก Buy.js)
  header: {
    height: 60,
    backgroundColor: '#425010',  // เขียวเข้ม
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  headerLeft: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  headerTitle: { 
    color: '#FFF', 
    fontSize: 20, 
    fontWeight: '800', 
    marginLeft: 10 
  },
  headerRight: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  headerIconBtn: { 
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)'
  },

  // Search (คล้าย Buy.js)
  searchWrap: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 40,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    color: '#425010',  // เขียวเข้ม
    paddingVertical: 6,
    fontSize: 14,
  },

  // Loading
  loadingWrap: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F7F0CE',  // เหลืองอ่อน
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#F7F0CE',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  emptyButtonText: {
    color: '#425010',  // เขียวเข้ม
    fontWeight: 'bold',
  },

  // Recipe cards (ใช้สไตล์การ์ดจาก Buy.js)
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  imageWrap: { 
    width: 100, 
    height: 100, 
    borderRadius: 14, 
    overflow: 'hidden', 
    backgroundColor: '#FEF9C3',  // เหลืองอ่อน
    position: 'relative'
  },
  cardImage: { 
    width: '100%', 
    height: '100%' 
  },
  starFab: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    padding: 6,
  },

  cardBody: { 
    flex: 1, 
    marginLeft: 14,
    justifyContent: 'space-between'
  },
  titleRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  cardTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: '#000000ff',  // ดำ
    flex: 1,
    minWidth: 0
  },
  ownerBadge: {
    backgroundColor: '#F7F0CE',  // เหลืองอ่อน
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  ownerBadgeText: {
    color: '#425010',  // เขียวเข้ม
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardSummary: { 
    color: '#666', 
    fontSize: 13, 
    lineHeight: 18,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorText: { 
    color: '#666', 
    fontSize: 12 
  },
  durationText: {
    color: '#769128',  // เขียวกลาง
    fontSize: 12,
    fontWeight: '600',
  },

  ownerActions: { 
    flexDirection: 'row', 
    gap: 16 
  },
  ownerBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4 
  },
  ownerTxt: { 
    fontSize: 12, 
    fontWeight: '600',
    color: '#769128'  // เขียวกลาง
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
});