// screens/Vendor/ReviewsScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../../firebaseconfig';
import VendorScreen from './VendorScreen';
import S from './VendorStyles';

const StarRow = ({ value = 0, size = 16 }) => (
  <View style={{ flexDirection: 'row' }}>
    {[1, 2, 3, 4, 5].map(n => (
      <Text key={n} style={{ fontSize: size, marginRight: 2 }}>{n <= value ? '⭐' : '☆'}</Text>
    ))}
  </View>
);

export default function ReviewsScreen() {
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const rowsRef = useRef([]); // กัน snapshot cache แรกทับผล
  const [filter, setFilter] = useState(0); // 0=ทั้งหมด, 1..5

  useEffect(() => onAuthStateChanged(auth, (u) => setUid(u?.uid || null)), []);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    // เลี่ยง index: ไม่ใช้ orderBy ที่ server
    const qy = query(
      collection(db, 'reviews'),
      where('vendorId', '==', uid)
    );

    const unsub = onSnapshot(
      qy,
      { includeMetadataChanges: true },
      (snap) => {
        // ถ้าเป็น cache ล้วน ๆ และเรายังไม่มีข้อมูลจาก server เลย → รอรอบ server ก่อน (อย่า set ว่าง)
        if (snap.metadata.fromCache && !snap.metadata.hasPendingWrites && rowsRef.current.length === 0) {
          return;
        }

        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // เรียงใหม่ → เก่า ฝั่ง client
        list.sort((a, b) => {
          const ta = a.createdAt?.toDate?.() ? a.createdAt.toDate().getTime() : 0;
          const tb = b.createdAt?.toDate?.() ? b.createdAt.toDate().getTime() : 0;
          return tb - ta;
        });

        rowsRef.current = list;
        setRows(list);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return unsub;
  }, [uid]);

  const summary = useMemo(() => {
    const counts = { 1:0, 2:0, 3:0, 4:0, 5:0 }; let sum = 0;
    rows.forEach(r => { const s = Math.min(5, Math.max(1, Number(r.rating || 0))); counts[s]++; sum += s; });
    const total = rows.length;
    return { total, avg: total ? (sum / total) : 0, counts };
  }, [rows]);

  const list = useMemo(() => rows.filter(r => !filter || Number(r.rating) === filter), [rows, filter]);

  if (loading || !uid) {
    return (
      <VendorScreen>
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>กำลังโหลดรีวิว...</Text>
        </View>
      </VendorScreen>
    );
  }

  return (
    <VendorScreen>
      <View style={S.sectionRow}><View style={S.sectionBar} /><Text style={S.sectionTitle}>รีวิวจากลูกค้า</Text></View>

      <View style={[S.card, S.shadow, { marginBottom: 12 }]}>
        <Text style={{ fontWeight: '700', fontSize: 16 }}>★ {summary.avg.toFixed(1)} / 5  ({summary.total} รีวิว)</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          {[5, 4, 3, 2, 1].map(star => (
            <TouchableOpacity
              key={star}
              onPress={() => setFilter(f => f === star ? 0 : star)}
              style={[styles.badge, filter === star && styles.badgeActive]}
            >
              <Text style={[styles.badgeTxt, filter === star && styles.badgeTxtActive]}>{star} ⭐ {summary.counts[star]}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setFilter(0)} style={[styles.badge, filter === 0 && styles.badgeActive]}>
            <Text style={[styles.badgeTxt, filter === 0 && styles.badgeTxtActive]}>ทั้งหมด</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={S.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700' }}>{item.userName || 'ผู้ใช้ไม่ระบุ'}</Text>
              <StarRow value={Number(item.rating || 0)} />
            </View>
            {!!item.text && <Text style={{ marginTop: 6, color: '#374151' }}>{item.text}</Text>}
            {!!item.createdAt?.toDate && (
              <Text style={{ marginTop: 6, color: '#9CA3AF', fontSize: 12 }}>
                {item.createdAt.toDate().toLocaleString('th-TH')}
              </Text>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={{ opacity: 0.6, marginTop: 6, marginLeft: 4 }}>ยังไม่มีรีวิว</Text>}
      />
    </VendorScreen>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', marginRight: 8, marginTop: 8 },
  badgeActive: { backgroundColor: '#111', borderColor: '#111' },
  badgeTxt: { color: '#111', fontWeight: '600' },
  badgeTxtActive: { color: '#fff' },
});
