// screens/User/Buy.js
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useLayoutEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Keyboard,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  collection,
  getDocs,
  collectionGroup,
  onSnapshot,
  // ⬇️ เพิ่มสำหรับ query เฉพาะร้านที่อนุมัติ
  query,
  where,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../firebaseconfig';
import { useNavigation } from '@react-navigation/native';

export default function Buy() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [userLoc, setUserLoc] = useState(null);

  const [vendorsById, setVendorsById] = useState({});
  const [items, setItems] = useState([]); // stock จากทุกร้าน (เฉพาะร้านที่อนุมัติ)
  const [uid, setUid] = useState(null);
  const [cartCount, setCartCount] = useState(0);

  // ---------- Header: Search + Cart ----------
  useLayoutEffect(() => {
  navigation.setOptions({
    headerTitle: () => (
      <View style={styles.headerWrap}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
        <View style={styles.headerSearchWrap}>
          <Ionicons name="search" size={18} style={{ marginRight: 6, opacity: 0.6 }} />
          <TextInput
            style={styles.headerSearchInput}
            placeholder="ค้นหาร้านค้า / สินค้า / ที่อยู่"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    ),
    headerRight: () => (
      <TouchableOpacity onPress={() => navigation.navigate('Cart')} style={{ paddingRight: 12 }}>
        <View>
          <Ionicons name="cart-outline" size={22} color="#FFF"/>
          {cartCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    ),
      headerStyle: { backgroundColor: '#425010' }, 
      headerTintColor: '#fff', 
      title: '',
      headerShown: true,
    });
  }, [navigation, cartCount, search]);

  // ---------- Auth & Cart ----------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid || null));
    return unsub;
  }, []);
  useEffect(() => {
    if (!uid) { setCartCount(0); return; }
    const unsub = onSnapshot(collection(db, 'users', uid, 'cart'), (snap) => {
      let sum = 0; snap.forEach(d => sum += Number(d.data()?.qty || 0));
      setCartCount(sum);
    });
    return unsub;
  }, [uid]);

  // ---------- Utils ----------
  const toRad = (v) => (v * Math.PI) / 180;
  const haversineKm = (a, b, c, d) => {
    if ([a, b, c, d].some((n) => typeof n !== 'number')) return null;
    const R = 6371, dLat = toRad(c - a), dLon = toRad(d - b);
    const A = Math.sin(dLat/2)**2 + Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(dLon/2)**2;
    return 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A)) * R;
  };
  const distLabel = (km) => (km == null ? '—' : km < 1 ? `${Math.round(km * 1000)} ม.` : `${km.toFixed(1)} กม.`);

  // ---------- Fetch ----------
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // ตำแหน่งผู้ใช้
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } else {
        setUserLoc(null);
      }

      // ร้านค้า: ดึงเฉพาะร้านที่ "approved == true"
      const venQ = query(collection(db, 'vendors'), where('approved', '==', true));
      const venSnap = await getDocs(venQ);
      const venMap = {};
      venSnap.forEach((d) => {
        const v = d.data();
        venMap[d.id] = {
          id: d.id,
          name: v?.name ?? 'ร้านไม่ระบุ',
          address: v?.address ?? '',
          openHours: v?.openHours ?? '',
          phone: v?.phone ?? '',
          photoURL: v?.photoURL ?? null,
          lat: v?.lat ?? v?.location?.lat ?? null,
          lng: v?.lng ?? v?.location?.lng ?? null,
          deliveryEnabled: !!v?.deliveryEnabled,
          uid: v?.uid ?? d.id,
          approved: true, // แน่นอนว่า true จาก query
        };
      });
      setVendorsById(venMap);

      // สินค้าจากทุก subcollection "stock"
      // ⬇️ กรองเฉพาะสินค้าของร้านที่อนุมัติเท่านั้น
      const stockSnap = await getDocs(collectionGroup(db, 'stock'));
      const rows = [];
      stockSnap.forEach((docSnap) => {
        const p = docSnap.data();
        const vendorRef = docSnap.ref.parent.parent;
        const vendorId = vendorRef?.id || p?.vendorId || p?.uid || null;
        if (!vendorId) return;
        if (!venMap[vendorId]) return; // ข้ามสินค้าของร้านที่ยังไม่อนุมัติ

        rows.push({
          id: docSnap.id,
          vendorId,
          name: p?.name ?? '—',
          price: Number(p?.pricePerKg ?? p?.price ?? 0),
          unit: p?.unit ?? '',
          quantity: Number(p?.quantity ?? 0),
          imageUrl: p?.imageURL || p?.imageUrl || p?.image || null,
        });
      });
      setItems(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // ---------- Group by Vendor + Filter + Sort ----------
  const sections = useMemo(() => {
    // รวมสินค้าเข้าร้าน
    const group = new Map();
    for (const it of items) {
      if (!group.has(it.vendorId)) group.set(it.vendorId, []);
      group.get(it.vendorId).push(it);
    }
    // แปลงเป็นอาเรย์ section พร้อมคำนวณระยะทาง + กรองด้วย search
    const q = search.trim().toLowerCase();
    const arr = [];
    group.forEach((products, vendorId) => {
      const v = vendorsById[vendorId];
      if (!v) return; // เผื่อข้อมูลงาน async ยังไม่พร้อม

      const km = (userLoc && v.lat != null && v.lng != null)
        ? haversineKm(userLoc.lat, userLoc.lng, v.lat, v.lng) : null;

      const matches =
        !q ||
        (v.name || '').toLowerCase().includes(q) ||
        (v.address || '').toLowerCase().includes(q) ||
        products.some(p => (p.name || '').toLowerCase().includes(q));

      if (!matches) return;

      arr.push({
        vendorId,
        vendor: v,
        distanceKm: km,
        distanceLabel: distLabel(km),
        products: products.sort((a, b) => a.name.localeCompare(b.name)),
      });
    });

    // เรียงร้านตามระยะทาง (ไม่มีระยะไปท้ายสุด)
    arr.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    return arr;
  }, [items, vendorsById, userLoc, search]);

  // ---------- UI ----------
  const renderProductThumb = (p) => (
    <TouchableOpacity
      key={p.id}
      style={styles.prodCard}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('ProductDetail', { vendorId: p.vendorId, stockId: p.id })}
    >
      {p.imageUrl ? (
        <Image source={{ uri: p.imageUrl }} style={styles.prodImg} />
      ) : (
        <View style={[styles.prodImg, styles.prodImgPlaceholder]}><Text style={{ opacity: 0.6 }}>ไม่มีรูป</Text></View>
      )}
      <Text style={styles.prodName} numberOfLines={2}>{p.name}</Text>
      <Text style={styles.prodPrice}>
        ฿{Number(p.price).toLocaleString('th-TH')}{p.unit ? `/${p.unit}` : ''}
      </Text>
    </TouchableOpacity>
  );

  const renderVendorSection = ({ item }) => {
    const v = item.vendor;
    return (
      <View style={styles.section}>
        {/* หัวร้าน */}
        <View style={styles.vendorHeader}>
          {v.photoURL ? (
            <Image source={{ uri: v.photoURL }} style={styles.vendorAvatar} />
          ) : (
            <View style={[styles.vendorAvatar, styles.avatarPlaceholder]}><Text>🏪</Text></View>
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.vendorName} numberOfLines={1}>{v.name || 'ร้านไม่ระบุ'}</Text>
            <Text style={styles.vendorMeta} numberOfLines={1}>
              {item.distanceLabel} • {v.openHours || '—'}
            </Text>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('VendorShop', { vendorId: item.vendorId })}>
            <Text style={styles.link}>ดูทั้งหมด</Text>
          </TouchableOpacity>
        </View>

        {/* แถวสินค้าแนวนอน */}
        <FlatList
          data={item.products}
          keyExtractor={(p) => p.id}
          renderItem={({ item: p }) => renderProductThumb(p)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 4, paddingRight: 4 }}
          ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView edges={['left','right','bottom']} style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8 }}>กำลังโหลดร้านค้าที่อนุมัติและสินค้า…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: -55, paddingBottom: -55 }}>
      <View style={styles.container}>
        <FlatList
          data={sections}
          keyExtractor={(sec) => sec.vendorId}
          renderItem={renderVendorSection}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text>ยังไม่มีร้านค้าที่ “ผ่านการอนุมัติ” หรือยังไม่มีสินค้า</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const CARD_W = 150;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#769128' }, // เหลืองอ่อน
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header wrap + logo
  headerWrap: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 32, height: 32, marginRight: 8, borderRadius: 6 },
  // Header search
  headerSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F0CE', // เหลืองอ่อน
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 220,
    maxWidth: 300,
  },
  headerSearchInput: { flex: 1, paddingVertical: 4, fontSize: 14 },

  // Badge cart
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#F7F0CE', // ส้ม
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Vendor section
  section: {
    backgroundColor: '#ffffffff', // เหลืองอ่อน
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  vendorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  vendorAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF7ED' },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  vendorName: { fontSize: 16, fontWeight: '700', color: '#1C1917' },
  vendorMeta: { color: '#78716C', marginTop: 2, fontSize: 12 },
  link: { color: '#769128', fontWeight: '600', fontSize: 13 },

  // Product pill/card
  prodCard: {
    width: CARD_W,
    borderRadius: 14,
    padding: 8,
    backgroundColor: '#FFFFFF',
  },
  prodImg: {
    width: CARD_W - 16,
    height: CARD_W - 16,
    borderRadius: 10,
    backgroundColor: '#FEF9C3',
  },
  prodImgPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  prodName: { marginTop: 6, fontSize: 13, fontWeight: '500', lineHeight: 16, color: '#1C1917' },
  prodPrice: { marginTop: 2, fontWeight: '700', color: '#769128' }, // เขียวสด
});
