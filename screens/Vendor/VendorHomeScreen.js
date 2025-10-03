import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { collection, getCountFromServer, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../firebaseconfig';
import VendorScreen from './VendorScreen';
import S from './VendorStyles';

export default function VendorHomeScreen() {
  const [uid, setUid] = useState(null);
  const [counts, setCounts] = useState({ orders: 0, stock: 0, reviews: 0 });
  const [lowStock, setLowStock] = useState([]);
  const [expiredSoon, setExpiredSoon] = useState([]);
  const [loading, setLoading] = useState(true);

  const toDate = (v) => {
    if (!v) return null;
    if (v?.toDate) return v.toDate();
    if (v instanceof Date) return v;
    const d = new Date(v);
    return isNaN(d) ? null : d;
  };
  const inNextDays = (date, days = 3) => {
    const d = toDate(date);
    if (!d) return false;
    const now = new Date();
    const end = new Date();
    end.setDate(now.getDate() + days);
    const startMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dMid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endMid = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    return dMid >= startMid && dMid <= endMid;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid || null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const ordersCol = collection(db, 'vendors', uid, 'orders');
        const stockCol  = collection(db, 'vendors', uid, 'stock');
        const reviewsCol= collection(db, 'vendors', uid, 'reviews');

        const [oc, sc, rc] = await Promise.all([
          getCountFromServer(ordersCol),
          getCountFromServer(stockCol),
          getCountFromServer(reviewsCol),
        ]);
        setCounts({ orders: oc.data().count, stock: sc.data().count, reviews: rc.data().count });

        const snap = await getDocs(stockCol);
        const stockItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const low = stockItems.filter(i => Number(i.quantity ?? 0) <= 5);
        const exp = stockItems
          .filter(i => inNextDays(i.expiryDate, 3))
          .map(i => ({
            ...i,
            expiryDateText: (() => {
              const d = toDate(i.expiryDate);
              return d ? d.toLocaleDateString() : '-';
            })()
          }));

        setLowStock(low);
        setExpiredSoon(exp);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  if (loading) return <VendorScreen><ActivityIndicator /></VendorScreen>;

  return (
    <VendorScreen scroll>
      <View style={S.sectionRow}>
        <View style={S.sectionBar} /><Text style={S.sectionTitle}>ภาพรวมร้าน</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 18 }}>
        <View style={[S.card, S.shadow, { flex: 1 }]}>
          <Text style={S.stockName}>คำสั่งซื้อทั้งหมด</Text>
          <Text style={{ fontSize: 24, fontWeight: '800', marginTop: 6 }}>{counts.orders}</Text>
        </View>
        <View style={[S.card, S.shadow, { flex: 1 }]}>
          <Text style={S.stockName}>สินค้าในคลัง</Text>
          <Text style={{ fontSize: 24, fontWeight: '800', marginTop: 6 }}>{counts.stock}</Text>
        </View>
        <View style={[S.card, S.shadow, { flex: 1 }]}>
          <Text style={S.stockName}>รวมรีวิวทั้งหมด</Text>
          <Text style={{ fontSize: 24, fontWeight: '800', marginTop: 6 }}>{counts.reviews}</Text>
        </View>
      </View>

      {/* สินค้าใกล้หมด */}
      <View style={{ marginBottom: 18 }}>
        <View style={S.sectionRow}>
          <View style={S.sectionBar} />
          <Text style={S.sectionTitle}>สินค้าใกล้หมดสต็อก</Text>
        </View>
        <View style={[S.card, S.shadow]}>
          {lowStock.length === 0 ? (
            <Text style={S.expiryText}>ไม่มี</Text>
          ) : (
            lowStock.map(i => (
              <Text key={i.id} style={{ marginBottom: 4 }}>
                • {i.name} ({i.quantity} {i.unit})
              </Text>
            ))
          )}
        </View>
      </View>

      {/* จะหมดอายุใน 3 วัน */}
      <View>
        <View style={S.sectionRow}>
          <View style={S.sectionBar} />
          <Text style={S.sectionTitle}>จะหมดอายุใน 3 วัน</Text>
        </View>
        <View style={[S.card, S.shadow]}>
          {expiredSoon.length === 0 ? (
            <Text style={S.expiryText}>ไม่มี</Text>
          ) : (
            expiredSoon.map(i => (
              <Text key={i.id} style={{ marginBottom: 4 }}>
                • {i.name} (หมดอายุ: {i.expiryDateText})
              </Text>
            ))
          )}
        </View>
      </View>
    </VendorScreen>
  );
}
