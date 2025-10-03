// screens/User/ProductDetailScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator, Alert ,SafeAreaView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseconfig';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProductDetailScreen() {
  const insets     = useSafeAreaInsets();
  const { params } = useRoute();
  const navigation = useNavigation();
  const { vendorId, stockId } = params || {};

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState(null);
  const [item, setItem] = useState(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    navigation.setOptions({ title: 'รายละเอียดสินค้า' });
  }, [navigation]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const venSnap = await getDoc(doc(db, 'vendors', vendorId));
      const stockSnap = await getDoc(doc(db, 'vendors', vendorId, 'stock', stockId));
      setVendor(venSnap.exists() ? { id: venSnap.id, ...venSnap.data() } : null);
      setItem(stockSnap.exists() ? { id: stockSnap.id, ...stockSnap.data() } : null);
      setLoading(false);
    })();
  }, [vendorId, stockId]);

  const addToCart = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('กรุณาเข้าสู่ระบบ', 'ต้องเข้าสู่ระบบก่อนเพิ่มลงตะกร้า');
      return;
    }
    // ตรวจว่าในตะกร้าปัจจุบันเป็นร้านเดียวกันหรือไม่
    const cartCol = collection(db, 'users', user.uid, 'cart');
    const cur = await getDocs(cartCol);
    const otherVendor = cur.docs.find(d => d.data()?.vendorId && d.data().vendorId !== vendorId);
    if (otherVendor) {
      Alert.alert(
        'ตะกร้ามีสินค้าจากร้านอื่น',
        'ต้องแยกสั่งต่อร้าน คุณต้องการล้างตะกร้าแล้วเพิ่มสินค้าจากร้านนี้ไหม?',
        [
          { text: 'ยกเลิก', style: 'cancel' },
          {
            text: 'ล้างตะกร้าและเพิ่ม',
            style: 'destructive',
            onPress: async () => {
              // ลบทั้งหมด
              await Promise.all(cur.docs.map(d => deleteDoc(d.ref)));
              await actuallyAdd(user.uid);
            }
          }
        ]
      );
      return;
    }
    await actuallyAdd(user.uid);
  };

  const actuallyAdd = async (uid) => {
    const price = Number(item?.pricePerKg ?? item?.price ?? 0);
    const imageUrl = item?.imageURL || item?.imageUrl || item?.image || null;

    const id = `${vendorId}_${stockId}`;
    const ref = doc(db, 'users', uid, 'cart', id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const curQty = Number(snap.data().qty || 0);
      await setDoc(ref, { qty: curQty + qty }, { merge: true });
    } else {
      await setDoc(ref, {
        vendorId,
        vendorName: vendor?.name || 'ร้านไม่ระบุ',
        stockId,
        name: item?.name || '—',
        price,
        unit: item?.unit || '',
        imageUrl,
        qty,
      });
    }
    Alert.alert('เพิ่มลงตะกร้าแล้ว', '', [
      { text: 'ดูตะกร้า', onPress: () => navigation.navigate('Cart') },
      { text: 'โอเค' }
    ]);
  };

  if (loading || !item) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  const priceLabel = `฿${Number(item.pricePerKg ?? item.price ?? 0).toLocaleString('th-TH')}${item.unit ? `/${item.unit}` : ''}`;

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Image
        source={item.imageURL ? { uri: item.imageURL } : require('../../assets/images/placeholder.png')}
        style={styles.image}
      />
      <View style={{ padding: 16 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.price}>{priceLabel}</Text>
        {!!vendor?.name && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Ionicons name="storefront-outline" size={16} style={{ marginRight: 6 }} />
            <Text>{vendor.name}</Text>
          </View>
        )}

        <View style={styles.qtyRow}>
          <TouchableOpacity onPress={() => setQty(Math.max(1, qty - 1))} style={styles.qtyBtn}><Text>-</Text></TouchableOpacity>
          <Text style={styles.qtyVal}>{qty}</Text>
          <TouchableOpacity onPress={() => setQty(qty + 1)} style={styles.qtyBtn}><Text>+</Text></TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={addToCart}>
          <Ionicons name="cart-outline" size={18} style={{ marginRight: 6 }} />
          <Text style={{ color: '#fff', fontWeight: '600' }}>ใส่ตะกร้า</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: 260, backgroundColor: '#F5F5F5' },
  name: { fontSize: 18, fontWeight: '700' },
  price: { marginTop: 6, fontSize: 16, fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  qtyBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DDD', borderRadius: 8 },
  qtyVal: { width: 40, textAlign: 'center', fontSize: 16 },
  addBtn: { marginTop: 16, backgroundColor: '#0EA5E9', paddingVertical: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
