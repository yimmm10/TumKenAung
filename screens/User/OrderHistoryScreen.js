// screens/User/OrderHistoryScreen.js
import React, { useEffect, useState, useMemo } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, FlatList,
  ActivityIndicator, TouchableOpacity
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, orderBy, onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../../firebaseconfig';

const THEME = {
  green:  '#769128',
  orange: '#FFA920',
  yellow: '#FBDB58',
  text:   '#1C1917',
  muted:  '#6B7280',
  line:   '#E5E7EB',
  card:   '#FFFFFF',
  bg:     '#F9FAFB',
};

const statusMeta = {
  awaiting_verification: { label: 'รอตรวจสอบสลิป', bg: '#FEF3C7', fg: '#92400E' },
  paid:                  { label: 'ชำระแล้ว',       bg: '#DCFCE7', fg: '#065F46' },
  cod_pending:           { label: 'ชำระปลายทาง',    bg: '#E5E7EB', fg: '#374151' },
  pending:               { label: 'กำลังดำเนินการ',   bg: '#DBEAFE', fg: '#1E40AF' },
  canceled:              { label: 'ยกเลิก',          bg: '#FEE2E2', fg: '#991B1B' },
};

export default function OrderHistoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders]   = useState([]);

  useEffect(() => {
    navigation.setOptions({
      title: 'ประวัติการสั่งซื้อ',
      headerStyle: { backgroundColor: THEME.green },
      headerTintColor: '#fff',
      headerTitleStyle: { color: '#fff', fontWeight: '700' },
    });
  }, [navigation]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', uid),
    );

    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(rows);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const renderItem = ({ item }) => {
    const placedAt = item.placedAt?.toDate ? item.placedAt.toDate() : (item.placedAt ? new Date(item.placedAt) : null);
    const when = placedAt ? placedAt.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
    const meta = statusMeta[item.paymentStatus] || { label: item.paymentStatus || '-', bg: '#EEE', fg: '#333' };

    const itemLine = (arr = []) => {
      if (!arr.length) return '-';
      const firstTwo = arr.slice(0, 2).map(it => `${it.name} x${it.qty}`).join(', ');
      return arr.length > 2 ? `${firstTwo} และอีก ${arr.length - 2} รายการ` : firstTwo;
    };

    return (
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>คำสั่งซื้อ #{item.id.slice(-6).toUpperCase()}</Text>
          <View style={[styles.badge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.badgeText, { color: meta.fg }]}>{meta.label}</Text>
          </View>
        </View>

        <Text style={styles.when}>{when}</Text>
        <Text style={styles.vendor}>{item.vendorName || '-'}</Text>

        <View style={styles.sep} />

        <Text style={styles.items} numberOfLines={2}>{itemLine(item.items)}</Text>

        <View style={styles.rowBetween}>
          <Text style={styles.totalLabel}>ยอดรวม</Text>
          <Text style={styles.totalValue}>฿{Number(item.total || 0).toLocaleString('th-TH')}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.center}><ActivityIndicator size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {orders.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={48} color={THEME.muted} />
          <Text style={{ color: THEME.muted, marginTop: 8 }}>ยังไม่มีประวัติการสั่งซื้อ</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: '800', color: THEME.text },
  when: { marginTop: 2, color: THEME.muted, fontSize: 12 },
  vendor: { marginTop: 2, color: THEME.text },

  sep: { height: 1, backgroundColor: THEME.line, marginVertical: 8 },

  items: { color: THEME.text },

  totalLabel: { color: THEME.muted, fontWeight: '600' },
  totalValue: { fontWeight: '800', color: THEME.green },

  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 },
  badgeText: { fontWeight: '700', fontSize: 12 },

  detailBtn: {
    marginTop: 10, backgroundColor: THEME.green, borderRadius: 10,
    paddingVertical: 8, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6
  },
  detailBtnText: { color: '#fff', fontWeight: '700' },
});
