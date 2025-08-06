// screens/vendor/VendorHomeScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { collection, getCountFromServer } from 'firebase/firestore';
import { db } from '../../firebaseconfig';
import styles from '../SharedStyles';

export default function VendorHomeScreen() {
  const [counts, setCounts] = useState({ orders: 0, stock: 0, reviews: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const o = await getCountFromServer(collection(db, 'orders'));
        const s = await getCountFromServer(collection(db, 'stock'));
        const r = await getCountFromServer(collection(db, 'reviews'));
        setCounts({ orders: o.data().count, stock: s.data().count, reviews: r.data().count });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchCounts();
  }, []);

  if (loading) return <ActivityIndicator style={styles.container} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>สรุปร้านค้า</Text>
      <Text>คำสั่งซื้อคงค้าง: {counts.orders}</Text>
      <Text>รายการสต็อก: {counts.stock}</Text>
      <Text>รีวิวใหม่: {counts.reviews}</Text>
    </View>
  );
}
