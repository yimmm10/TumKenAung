// screens/Admin/AdminVendorShopScreen.js
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, TextInput, RefreshControl, Linking, Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseconfig';

export default function AdminVendorShopScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const vendorId = params?.vendorId;

  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState(null);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: vendor?.name ? `รายละเอียดร้าน: ${vendor.name}` : 'รายละเอียดร้าน (แอดมิน)',
      headerRight: undefined, // ไม่มีตะกร้า
    });
  }, [navigation, vendor?.name]);

  const load = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);

    // ดึงข้อมูลร้าน
    const venSnap = await getDoc(doc(db, 'vendors', vendorId));
    setVendor(venSnap.exists() ? { id: venSnap.id, ...venSnap.data() } : null);

    // subscribe stock แบบ realtime
    const unsub = onSnapshot(collection(db, 'vendors', vendorId, 'stock'), (snap) => {
      const arr = snap.docs.map(d => {
        const p = d.data() || {};
        return {
          id: d.id,
          name: p.name ?? '—',
          price: Number(p.pricePerKg ?? p.price ?? 0),
          unit: p.unit ?? '',
          quantity: Number(p.quantity ?? 0),
          imageUrl: p.imageURL || p.imageUrl || p.image || null,
        };
      });
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(p => (p.name || '').toLowerCase().includes(q));
  }, [items, search]);

  const callShop = () => {
    if (!vendor?.phone) return;
    Linking.openURL(`tel:${vendor.phone}`);
  };
  const openInGoogleMaps = () => {
    if (vendor?.lat == null || vendor?.lng == null) return;
    const lat = vendor.lat, lng = vendor.lng;
    const url = Platform.select({
      ios: `comgooglemaps://?q=${lat},${lng}`,
      android: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });
    Linking.openURL(url);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Image source={ item.imageUrl ? { uri: item.imageUrl } : require('../../assets/placeholder.png') } style={styles.image} />
      <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.price}>
        {item.price ? `${item.price.toLocaleString()} ฿` : '—'} {item.unit ? `/${item.unit}` : ''}
      </Text>
      <Text style={styles.qty}>คงเหลือ: {Number.isFinite(item.quantity) ? item.quantity : 0}</Text>
      {/* ไม่มี onPress / ไม่มีปุ่มซื้อ */}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', paddingTop: (insets.top||0) }}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8 }}>กำลังโหลดข้อมูลร้าน…</Text>
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
            {/* รูปร้าน + ข้อมูลหลัก */}
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              {vendor.photoURL ? (
                <Image source={{ uri: vendor.photoURL }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}><Text>🏪</Text></View>
              )}
              <View style={{ flex:1, marginLeft: 12 }}>
                <Text style={styles.vendorName}>
                  {vendor.name || 'ร้านไม่ระบุ'}
                  {vendor.approved === true ? '  ✅' : '  ⏳'}
                </Text>
                <Text style={styles.vendorSub} numberOfLines={2}>
                  {vendor.address || '—'}
                </Text>
                <Text style={styles.vendorSub}>
                  พิกัด: {vendor.lat != null && vendor.lng != null ? `${vendor.lat.toFixed(6)}, ${vendor.lng.toFixed(6)}` : '—'}
                </Text>
                <Text style={styles.vendorSub}>
                  เวลาเปิดทำการ: {vendor.openHours || '—'}
                </Text>
                <Text style={styles.vendorSub}>
                  บริการจัดส่ง: {vendor.deliveryEnabled ? 'มี' : 'เฉพาะรับที่ร้าน'}
                </Text>
              </View>
            </View>

            {/* ปุ่มแอคชัน (เฉพาะการตรวจสอบ) */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={callShop} disabled={!vendor.phone}>
                <Ionicons name="call-outline" size={16} />
                <Text style={styles.actionTxt}>{vendor.phone ? 'โทรหาร้าน' : 'ไม่มีเบอร์'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={openInGoogleMaps}
                disabled={vendor.lat == null || vendor.lng == null}
              >
                <Ionicons name="navigate-outline" size={16} />
                <Text style={styles.actionTxt}>เปิดใน Google Maps</Text>
              </TouchableOpacity>
            </View>

            {/* ค้นหาในสต็อก */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} style={{ marginRight: 6, opacity: 0.6 }} />
              <TextInput
                style={{ flex: 1, paddingVertical: 6 }}
                placeholder="ค้นหาสินค้าในร้านนี้ (โหมดแอดมิน – อ่านอย่างเดียว)"
                value={search}
                onChangeText={setSearch}
              />
              {!!search && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.sectionTitle}>รายการสินค้าในสต็อก ({filtered.length})</Text>
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

  header: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor:'#F5F5F5' },
  avatarPlaceholder: { alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'#EEE' },
  vendorName: { fontSize:18, fontWeight:'700' },
  vendorSub: { color:'#6B7280', marginTop: 2 },

  actionRow: { flexDirection:'row', gap:12, marginTop: 10 },
  actionBtn: { flexDirection:'row', alignItems:'center', gap:6, paddingVertical:8, paddingHorizontal:12, borderWidth:1, borderColor:'#E5E7EB', borderRadius:999 },
  actionTxt: { fontWeight:'600' },

  searchBox: { flexDirection:'row', alignItems:'center', marginTop: 12, borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, paddingHorizontal:10, backgroundColor:'#FAFAFA' },
  sectionTitle: { marginTop: 12, fontWeight:'700', fontSize: 16 },

  card: {
    width: CARD_W, borderWidth:1, borderColor:'#EEE', borderRadius:12, padding:8, backgroundColor:'#fff',
  },
  image: { width: CARD_W-16, height: CARD_W-16, borderRadius:8, backgroundColor:'#F5F5F5' },
  name: { marginTop:6, fontSize:13, lineHeight:16 },
  price: { marginTop:2, fontWeight:'700' },
  qty: { marginTop:2, color:'#6B7280' },
});
