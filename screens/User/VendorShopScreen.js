// screens/User/VendorShopScreen.js
import React, { useEffect, useLayoutEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, TextInput, RefreshControl, Linking, Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  collection, doc, getDoc, onSnapshot
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../firebaseconfig';
import { useNavigation, useRoute } from '@react-navigation/native';
import ProductCard from '../../components/ProductCard';

export default function VendorShopScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const vendorId = params?.vendorId;

  const insets = useSafeAreaInsets();

  const [uid, setUid] = useState(null);
  const [cartCount, setCartCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState(null);
  const [items, setItems] = useState([]);
  const [userLoc, setUserLoc] = useState(null);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // ---------- auth + cart badge ----------
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

  // ---------- header ----------
  useLayoutEffect(() => {
    navigation.setOptions({
      title: vendor?.name || '',
      headerTitle: vendor?.name ? vendor.name : 'ร้านค้า',
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Cart')} style={{ paddingRight: 12 }}>
          <View>
            <Ionicons name="cart-outline" size={22} />
            {cartCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ),
    });
  }, [navigation, vendor?.name, cartCount]);

  // ---------- utils ----------
  const toRad = (v) => (v * Math.PI) / 180;
  const haversineKm = (a, b, c, d) => {
    if ([a,b,c,d].some((n) => typeof n !== 'number')) return null;
    const R = 6371, dLat = toRad(c - a), dLon = toRad(d - b);
    const A = Math.sin(dLat/2)**2 + Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(dLon/2)**2;
    return 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A)) * R;
  };
  const distLabel = (km) => km == null ? '—' : km < 1 ? `${Math.round(km*1000)} ม.` : `${km.toFixed(1)} กม.`;

  // ---------- fetch vendor + items ----------
  const load = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);

    // user location
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    } catch {}

    // vendor
    const venSnap = await getDoc(doc(db, 'vendors', vendorId));
    setVendor(venSnap.exists() ? { id: venSnap.id, ...venSnap.data() } : null);

    // subscribe stock realtime
    const unsub = onSnapshot(collection(db, 'vendors', vendorId, 'stock'), (snap) => {
      const arr = snap.docs.map(d => {
        const p = d.data();
        return {
          id: d.id,
          vendorId,
          name: p?.name ?? '—',
          price: Number(p?.pricePerKg ?? p?.price ?? 0),
          unit: p?.unit ?? '',
          quantity: Number(p?.quantity ?? 0),
          imageUrl: p?.imageURL || p?.imageUrl || p?.image || null,
        };
      });
      // เรียงตามชื่อ
      arr.sort((a,b) => a.name.localeCompare(b.name));
      setItems(arr);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [vendorId]);

  useEffect(() => {
    const unsub = load();
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // ---------- derived ----------
  const distanceKm = useMemo(() => {
    if (!vendor || !userLoc || vendor.lat == null || vendor.lng == null) return null;
    return haversineKm(userLoc.lat, userLoc.lng, vendor.lat, vendor.lng);
  }, [vendor, userLoc]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(p => (p.name || '').toLowerCase().includes(q));
  }, [items, search]);

  // ---------- actions ----------
  const callShop = () => {
    if (!vendor?.phone) return;
    Linking.openURL(`tel:${vendor.phone}`);
  };
  const openDirections = () => {
    if (vendor?.lat == null || vendor?.lng == null) return;
    const lat = vendor.lat, lng = vendor.lng;
    const url = Platform.select({
      ios: `http://maps.apple.com/?ll=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}`,
      default: `https://maps.google.com/?q=${lat},${lng}`,
    });
    Linking.openURL(url);
  };
  // ✅ ปุ่มใหม่: ไปหน้ารีวิว
  const openReviews = () => navigation.navigate('Reviews', { vendorId });

  // ---------- render ----------
  const renderItem = ({ item }) => (
    <ProductCard
      name={item.name}
      price={item.price}
      imageUrl={item.imageUrl}
      vendorName={vendor?.name}
      onPress={() => navigation.navigate('ProductDetail', { vendorId: item.vendorId, stockId: item.id })}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: (insets.top||0) }}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8 }}>กำลังโหลดร้านค้า…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!vendor) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: (insets.top||0) }}>
        <View style={styles.center}><Text>ไม่พบร้านค้า</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <FlatList
        ListHeaderComponent={
          <View style={styles.header}>
            {/* รูปร้าน */}
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              {vendor.photoURL ? (
                <Image source={{ uri: vendor.photoURL }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}><Text>🏪</Text></View>
              )}
              <View style={{ flex:1, marginLeft: 12 }}>
                <Text style={styles.vendorName}>{vendor.name || 'ร้านไม่ระบุ'}</Text>
                <Text style={styles.vendorSub} numberOfLines={1}>
                  {vendor.address || '—'}
                </Text>
                <Text style={styles.vendorSub}>
                  {distanceKm != null ? `${distLabel(distanceKm)} • ` : ''}{vendor.openHours || 'เวลาทำการไม่ระบุ'}
                </Text>
                <Text style={styles.vendorSub}>
                  บริการจัดส่ง: {vendor.deliveryEnabled ? 'มี' : 'เฉพาะรับที่ร้าน'}
                </Text>
              </View>
            </View>

            {/* ปุ่มการกระทำ (เพิ่มปุ่มรีวิวร้านไว้ "ข้างๆ" โทร/นำทาง) */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={callShop} disabled={!vendor.phone}>
                <Ionicons name="call-outline" size={16} />
                <Text style={styles.actionTxt}>{vendor.phone ? 'โทรหาร้าน' : 'ไม่มีเบอร์'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={openDirections} disabled={vendor.lat == null || vendor.lng == null}>
                <Ionicons name="navigate-outline" size={16} />
                <Text style={styles.actionTxt}>นำทาง</Text>
              </TouchableOpacity>

              {/* ✅ ปุ่มรีวิวร้าน */}
              <TouchableOpacity style={styles.actionBtn} onPress={openReviews}>
                <Ionicons name="chatbox-ellipses-outline" size={16} />
                <Text style={styles.actionTxt}>รีวิวร้าน</Text>
              </TouchableOpacity>
            </View>

            {/* ค้นหาสินค้าในร้าน */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} style={{ marginRight: 6, opacity: 0.6 }} />
              <TextInput
                style={{ flex: 1, paddingVertical: 6 }}
                placeholder="ค้นหาสินค้าในร้านนี้"
                value={search}
                onChangeText={setSearch}
              />
              {!!search && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.sectionTitle}>สินค้าทั้งหมด ({filtered.length})</Text>
          </View>
        }
        data={filtered}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 12 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<View style={{ padding: 24, alignItems:'center' }}><Text>ยังไม่มีสินค้า</Text></View>}
      />
    </View>
  );
}

const CARD_W = 170;

const styles = StyleSheet.create({
  center: { flex:1, alignItems:'center', justifyContent:'center' },
  badge: {
    position: 'absolute', top: -6, right: -10,
    backgroundColor: '#EF4444', minWidth: 16, height: 16,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color:'#fff', fontSize:10, fontWeight:'700' },

  header: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor:'#F5F5F5' },
  avatarPlaceholder: { alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'#EEE' },
  vendorName: { fontSize:18, fontWeight:'700' },
  vendorSub: { color:'#6B7280', marginTop: 2 },

  actionRow: { flexDirection:'row', gap:12, marginTop: 10, flexWrap:'wrap' },
  actionBtn: { flexDirection:'row', alignItems:'center', gap:6, paddingVertical:8, paddingHorizontal:12, borderWidth:1, borderColor:'#E5E7EB', borderRadius:999 },
  actionTxt: { fontWeight:'600' },

  searchBox: { flexDirection:'row', alignItems:'center', marginTop: 12, borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:10, backgroundColor:'#FAFAFA' },
  sectionTitle: { marginTop: 12, fontWeight:'700', fontSize: 16 },

  // ถ้าใช้ ProductCard ที่เป็นสี่เหลี่ยมจัตุรัสอยู่แล้ว ไม่ต้องแก้สไตล์เพิ่ม
  card: {
    width: CARD_W, borderWidth:1, borderColor:'#EEE', borderRadius:12, padding:8, backgroundColor:'#fff',
  },
  image: { width: CARD_W-16, height: CARD_W-16, borderRadius:8, backgroundColor:'#F5F5F5' },
  name: { marginTop:6, fontSize:13, lineHeight:16 },
  price: { marginTop:2, fontWeight:'700' },
});
