// screens/Vendor/OrdersScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, FlatList, Text, ActivityIndicator, TouchableOpacity,
  Modal, Button, StyleSheet, Linking, Alert, Platform, Image, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../firebaseconfig';
import VendorScreen from './VendorScreen';
import S from './VendorStyles';

/* ---------- helpers ---------- */
const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);
const formatDateTimeTH = (d) =>
  d ? d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const formatTHB = (n) => `฿${Number(n || 0).toLocaleString('th-TH')}`;

// แปลง items ให้เป็นอาเรย์มาตรฐาน (รองรับที่เก็บเป็น object)
const normalizeOrderItems = (raw) => {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : Object.values(raw);
  return list.map((it) => ({
    name: it?.name ?? it?.title ?? '—',
    qty: Number(it?.qty ?? it?.quantity ?? 0),
    unit: it?.unit ?? it?.unitName ?? '',
    price: Number(it?.price ?? it?.pricePerKg ?? 0),
  }));
};

const STATUS_LABEL = {
  pending: 'รอร้านยืนยัน',
  accepted: 'ร้านยืนยันแล้ว',
  ready_for_pickup: 'พร้อมรับที่ร้าน',
  out_for_delivery: 'กำลังจัดส่ง',
  completed: 'สำเร็จ',
  canceled: 'ยกเลิก',
};
const TAG_STYLE = {
  pending: { bg: '#FFF7ED', fg: '#C2410C' },
  accepted: { bg: '#ECFEFF', fg: '#155E75' },
  ready_for_pickup: { bg: '#F0FDF4', fg: '#166534' },
  out_for_delivery: { bg: '#EEF2FF', fg: '#3730A3' },
  completed: { bg: '#F1F5F9', fg: '#0F172A' },
  canceled: { bg: '#FEE2E2', fg: '#991B1B' },
};

/* ✅ Payment status meta สำหรับแสดง badge */
const PAY_STATUS_META = {
  awaiting_verification: { label: 'รอตรวจสอบสลิป', bg: '#FEF3C7', fg: '#92400E' },
  paid:                  { label: 'ชำระแล้ว',       bg: '#DCFCE7', fg: '#065F46' },
  rejected:              { label: 'ปฏิเสธสลิป',     bg: '#FEE2E2', fg: '#991B1B' },
  cod_pending:           { label: 'ชำระปลายทาง',    bg: '#E5E7EB', fg: '#374151' },
};

/* ---------- screen ---------- */
export default function OrdersScreen() {
  const [uid, setUid] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | pending | accepted | ready_for_pickup | out_for_delivery | completed | canceled
  const [selected, setSelected] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [slipOpen, setSlipOpen] = useState(false); // ✅ modal ดูสลิป

  // auth -> uid
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid || null));
    return unsub;
  }, []);

  // subscribe orders ของร้านนี้ (ไม่ใส่ orderBy เพื่อกันปัญหา index)
  useEffect(() => {
    if (!uid) return;
    setLoading(true); setErrorMsg('');
    const q = query(collection(db, 'orders'), where('vendorId', '==', uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // เรียงล่าสุดก่อนโดยใช้ placedAt (ถ้าไม่มีถือเป็น 0)
        rows.sort((a, b) => {
          const ad = toDate(a.placedAt)?.getTime?.() || 0;
          const bd = toDate(b.placedAt)?.getTime?.() || 0;
          return bd - ad;
        });
        setOrders(rows);
        setLoading(false);
      },
      (err) => { setErrorMsg(err?.message || 'โหลดคำสั่งซื้อไม่สำเร็จ'); setLoading(false); }
    );
    return unsub;
  }, [uid]);

  const filtered = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter((o) => (o.status || 'pending') === filter);
  }, [orders, filter]);

  const nextActions = (o) => {
    const f = o.fulfillment || 'pickup';
    const st = o.status || 'pending';
    const actions = [];
    if (st === 'pending') actions.push({ label: '✅ ยืนยันรับออเดอร์', next: 'accepted' });
    if (f === 'pickup') {
      if (st === 'accepted') actions.push({ label: '📦 พร้อมให้มารับ', next: 'ready_for_pickup' });
      if (st === 'ready_for_pickup') actions.push({ label: '✔️ ลูกค้ารับแล้ว (ปิดงาน)', next: 'completed' });
    } else {
      if (st === 'accepted') actions.push({ label: '🚚 ออกจัดส่ง', next: 'out_for_delivery' });
      if (st === 'out_for_delivery') actions.push({ label: '✔️ จัดส่งแล้ว (ปิดงาน)', next: 'completed' });
    }
    if (st !== 'completed' && st !== 'canceled') {
      actions.push({ label: '🛑 ยกเลิกออเดอร์', next: 'canceled', danger: true });
    }
    return actions;
  };

  const updateStatus = async (orderId, next) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: next,
        updatedAt: new Date(),
      });
      setSelected((s) => (s?.id === orderId ? { ...s, status: next } : s));
      setOrders((arr) => arr.map(o => o.id === orderId ? { ...o, status: next, updatedAt: new Date() } : o));
    } catch (e) {
      Alert.alert('อัปเดตสถานะไม่สำเร็จ', e?.message || 'unknown');
    }
  };

  /* ✅ ยืนยัน/ปฏิเสธการชำระเงิน + อัปเดตสถานะออเดอร์อัตโนมัติ */
  const updatePayment = async (orderId, paymentStatus) => {
    try {
      let fields = {
        paymentStatus,
        updatedAt: new Date(),
      };
      let msg = 'อัปเดตแล้ว';

      // ถ้าปฏิเสธสลิป → ยกเลิกออเดอร์ทันที
      if (paymentStatus === 'rejected') {
        fields.status = 'canceled';
        fields.canceledReason = 'payment_rejected';
        msg = 'ปฏิเสธสลิปและยกเลิกออเดอร์แล้ว';
      }

      // ถ้ายืนยันสลิป → ถือว่า "รับออเดอร์" ถ้ายัง pending
      if (paymentStatus === 'paid') {
        const currStatus = (selected?.id === orderId ? selected?.status : orders.find(o => o.id === orderId)?.status) || 'pending';
        if (currStatus === 'pending') {
          fields.status = 'accepted';
          msg = 'ยืนยันรับเงินและรับออเดอร์แล้ว';
        } else {
          msg = 'ยืนยันรับเงินแล้ว';
        }
      }

      await updateDoc(doc(db, 'orders', orderId), fields);

      // อัปเดต state ท้องถิ่นทันทีให้ UI สอดคล้อง
      setSelected((s) => (s?.id === orderId ? { ...s, ...fields } : s));
      setOrders((arr) => arr.map(o => o.id === orderId ? { ...o, ...fields } : o));

      Alert.alert('สำเร็จ', msg);
    } catch (e) {
      Alert.alert('อัปเดตการชำระเงินไม่สำเร็จ', e?.message || 'unknown');
    }
  };

  const openMap = (o) => {
    const lat = o?.userLocation?.lat ?? o?.userLocation?.latitude;
    const lng = o?.userLocation?.lng ?? o?.userLocation?.longitude;
    if (typeof lat === 'number' && typeof lng === 'number') {
      const url = Platform.select({
        ios: `http://maps.apple.com/?ll=${lat},${lng}`,
        android: `geo:${lat},${lng}?q=${lat},${lng}`,
        default: `https://maps.google.com/?q=${lat},${lng}`,
      });
      Linking.openURL(url);
    }
  };

  /* ---------- render ---------- */
  const renderOrderRow = ({ item }) => {
    const placed = formatDateTimeTH(toDate(item.placedAt));
    const st = item.status || 'pending';
    const tag = TAG_STYLE[st] || TAG_STYLE.pending;
    const f = item.fulfillment || 'pickup';

    const normItems = normalizeOrderItems(item.items);
    const sampleItems = normItems.slice(0, 2);
    const more = Math.max(0, normItems.length - sampleItems.length);

    const payMeta = PAY_STATUS_META[item.paymentStatus] || null;

    return (
      <TouchableOpacity style={[S.stockItem, styles.row]} onPress={() => setSelected(item)} activeOpacity={0.85}>
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text style={styles.orderId}>#{item.id.slice(0, 6).toUpperCase()}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {payMeta && (
                <View style={[styles.tag, { backgroundColor: payMeta.bg }]}>
                  <Text style={[styles.tagTxt, { color: payMeta.fg }]}>{payMeta.label}</Text>
                </View>
              )}
              <View style={[styles.tag, { backgroundColor: tag.bg }]}>
                <Text style={[styles.tagTxt, { color: tag.fg }]}>{STATUS_LABEL[st] || st}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.meta}>{placed} • {f === 'pickup' ? 'รับที่ร้าน' : 'จัดส่ง'}</Text>

          <View style={{ marginTop: 6 }}>
            {sampleItems.map((it, idx) => (
              <Text key={idx} style={styles.itemLine}>
                • {it.name} × {it.qty}{it.unit ? ` ${it.unit}` : ''} = {formatTHB((it.price || 0) * (it.qty || 0))}
              </Text>
            ))}
            {more > 0 && <Text style={styles.more}>+ อีก {more} รายการ</Text>}
          </View>

          <View style={styles.priceRow}>
            {item.deliveryFee != null && (
              <Text style={styles.subtle}>ค่าส่ง {formatTHB(item.deliveryFee)}</Text>
            )}
            <Text style={styles.total}>รวม {formatTHB(item.total ?? item.subtotal)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const listEmpty =
    !loading && !errorMsg && filtered.length === 0 ? (
      <View style={styles.center}><Text style={{ opacity: 0.6 }}>ยังไม่มีออเดอร์</Text></View>
    ) : null;

  return (
    <VendorScreen>
      <View style={S.sectionRow}>
        <View style={S.sectionBar} />
        <Text style={S.sectionTitle}>รายการคำสั่งซื้อ</Text>
      </View>

      {/* ตัวกรองสถานะ */}
      <View style={styles.filterWrap}>
        {['all','pending','accepted','ready_for_pickup','out_for_delivery','completed','canceled'].map((k) => {
          const active = filter === k;
          return (
            <TouchableOpacity key={k} onPress={() => setFilter(k)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>
                {k === 'all' ? 'ทั้งหมด' : (STATUS_LABEL[k] || k)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* รายการออเดอร์ */}
      {loading ? (
        <View style={{ marginTop: 24 }}><ActivityIndicator /></View>
      ) : errorMsg ? (
        <View style={styles.center}>
          <Text style={{ color: '#B91C1C', textAlign: 'center' }}>เกิดข้อผิดพลาดในการโหลดคำสั่งซื้อ</Text>
          <Text style={{ color: '#6B7280', marginTop: 4, textAlign: 'center' }}>{errorMsg}</Text>
          <View style={{ height: 10 }} />
          <Button title="ลองใหม่" onPress={() => setUid((u) => u)} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderOrderRow}
          contentContainerStyle={{ paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={listEmpty}
        />
      )}

      {/* Modal รายละเอียด */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            {selected ? (() => {
              const items = normalizeOrderItems(selected.items);
              const subtotal =
                selected.subtotal != null
                  ? Number(selected.subtotal)
                  : items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0);
              const deliveryFee = Number(selected.deliveryFee || 0);
              const total = selected.total != null ? Number(selected.total) : subtotal + deliveryFee;

              const st = selected.status || 'pending';
              const f = selected.fulfillment || 'pickup';
              const payMeta = PAY_STATUS_META[selected.paymentStatus];

              const actions = nextActions(selected);

              return (
                <ScrollView>
                  <View style={{ paddingRight: 40 }}>
                    <Text style={styles.modalTitle}>คำสั่งซื้อ #{selected.id}</Text>
                    <Text style={styles.modalSub}>
                      {formatDateTimeTH(toDate(selected.placedAt))} • {f === 'delivery' ? 'จัดส่ง' : 'รับที่ร้าน'}
                    </Text>
                    {/* ปุ่มปิดมุมขวาบน */}
                    <TouchableOpacity style={styles.modalClose} onPress={() => setSelected(null)}>
                      <Ionicons name="close" size={22} color="#111" />
                    </TouchableOpacity>
                  </View>

                  {/* ✅ การชำระเงิน */}
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.sectionTitle}>การชำระเงิน</Text>

                    <View style={styles.payRow}>
                      <Text style={styles.payKey}>วิธี</Text>
                      <Text style={styles.payVal}>
                        {selected.paymentMethod === 'transfer' ? 'โอน/พร้อมเพย์' : 'เก็บเงินปลายทาง'}
                      </Text>
                    </View>

                    <View style={styles.payRow}>
                      <Text style={styles.payKey}>สถานะ</Text>
                      <View style={[styles.badge, payMeta ? { backgroundColor: payMeta.bg } : { backgroundColor: '#E5E7EB' }]}>
                        <Text style={[styles.badgeTxt, { color: payMeta?.fg || '#111' }]}>
                          {payMeta?.label || (selected.paymentStatus || '-')}
                        </Text>
                      </View>
                    </View>

                    {/* แสดงสลิป (ถ้ามี) */}
                    {selected.paymentSlipUrl ? (
                      <TouchableOpacity
                        onPress={() => setSlipOpen(true)}
                        style={styles.slipThumbWrap}
                        activeOpacity={0.9}
                      >
                        <Image source={{ uri: selected.paymentSlipUrl }} style={styles.slipThumb} />
                        <View style={styles.slipOverlay}>
                          <Ionicons name="expand-outline" size={18} color="#111" />
                          <Text style={styles.slipOverlayTxt}>แตะเพื่อดูสลิปแบบเต็ม</Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      selected.paymentMethod === 'transfer' && (
                        <Text style={{ color: '#B91C1C', marginTop: 6 }}>ไม่มีสลิปแนบ</Text>
                      )
                    )}

                    {/* ปุ่มยืนยัน/ปฏิเสธ เฉพาะกรณีโอนและรอตรวจสอบ */}
                    {selected.paymentMethod === 'transfer' && selected.paymentStatus === 'awaiting_verification' && (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Button title="✅ ยืนยันรับเงิน" onPress={() => updatePayment(selected.id, 'paid')} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Button title="🛑 ปฏิเสธสลิป (ยกเลิกออเดอร์)" color="#C62828" onPress={() => updatePayment(selected.id, 'rejected')} />
                        </View>
                      </View>
                    )}

                    {/* ปุ่มเปิดในเบราว์เซอร์ */}
                    {selected.paymentSlipUrl ? (
                      <View style={{ marginTop: 8 }}>
                        <Button title="เปิดสลิปในเบราว์เซอร์" onPress={() => Linking.openURL(selected.paymentSlipUrl)} />
                      </View>
                    ) : null}
                  </View>

                  {/* รายการสินค้า */}
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.sectionTitle}>รายการสินค้า</Text>
                    {items.map((it, idx) => (
                      <View key={idx} style={styles.lineRow}>
                        <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                        <Text style={styles.qty}>× {it.qty}{it.unit ? ` ${it.unit}` : ''}</Text>
                        <Text style={styles.amount}>{formatTHB((it.price || 0) * (it.qty || 0))}</Text>
                      </View>
                    ))}
                  </View>

                  {/* สรุปเงิน */}
                  <View style={{ marginTop: 8 }}>
                    <View style={styles.lineRow}>
                      <Text style={{ flex:1, color:'#475569' }}>ค่าสินค้า</Text>
                      <Text style={styles.amount}>{formatTHB(subtotal)}</Text>
                    </View>
                    {f === 'delivery' && (
                      <View style={styles.lineRow}>
                        <Text style={{ flex:1, color:'#475569' }}>ค่าส่ง</Text>
                        <Text style={styles.amount}>{formatTHB(deliveryFee)}</Text>
                      </View>
                    )}
                    <View style={[styles.lineRow, { marginTop: 4 }]}>
                      <Text style={{ flex:1, fontWeight:'700' }}>รวมทั้งสิ้น</Text>
                      <Text style={[styles.amount, { fontWeight:'700' }]}>{formatTHB(total)}</Text>
                    </View>
                  </View>

                  {!!selected.note && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={styles.sectionTitle}>โน้ตจากลูกค้า</Text>
                      <Text style={{ color: '#111' }}>{selected.note}</Text>
                    </View>
                  )}

                  {f === 'delivery' && (
                    <View style={{ marginTop: 12, marginBottom: 10 }}>
                      <Text style={styles.sectionTitle}>พิกัดจัดส่ง</Text>
                      {selected?.userLocation ? (
                        <>
                          <Text style={{ color:'#475569' }}>
                            {`${selected.userLocation.lat?.toFixed?.(6) || selected.userLocation.latitude?.toFixed?.(6) || '—'}, ${selected.userLocation.lng?.toFixed?.(6) || selected.userLocation.longitude?.toFixed?.(6) || '—'}`}
                          </Text>
                          <View style={{ marginTop: 8 }}>
                            <Button title="เปิดแผนที่" onPress={() => openMap(selected)} />
                          </View>
                        </>
                      ) : (<Text style={{ color:'#ef4444' }}>ไม่มีพิกัดลูกค้า</Text>)}
                    </View>
                  )}

                  {/* สถานะ & ปุ่มเปลี่ยนสถานะ (ยังใช้งานได้ตามเดิม) */}
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.sectionTitle}>สถานะออเดอร์</Text>
                    <Text>{STATUS_LABEL[st] || st}</Text>
                    <View style={{ height: 8 }} />
                    {actions.map((a, idx) => (
                      <View key={idx} style={{ marginBottom: 8 }}>
                        <Button
                          color={a.danger ? '#C62828' : undefined}
                          title={a.label}
                          onPress={() => updateStatus(selected.id, a.next)}
                        />
                      </View>
                    ))}
                  </View>
                </ScrollView>
              );
            })() : null}
          </View>
        </View>
      </Modal>

      {/* ✅ Modal ดูสลิปแบบเต็มจอ */}
      <Modal visible={slipOpen} transparent animationType="fade" onRequestClose={() => setSlipOpen(false)}>
        <View style={styles.slipModalBg}>
          <TouchableOpacity style={styles.slipClose} onPress={() => setSlipOpen(false)}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          {selected?.paymentSlipUrl ? (
            <Image
              source={{ uri: selected.paymentSlipUrl }}
              style={styles.slipFull}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </VendorScreen>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },

  row: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderId: { fontWeight: '700' },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  tagTxt: { fontSize: 12, fontWeight: '700' },
  meta: { marginTop: 2, color: '#64748B' },
  itemLine: { color: '#111' },
  more: { color: '#64748B', marginTop: 2 },
  priceRow: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subtle: { color: '#475569' },
  total: { fontWeight: '700' },

  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4, marginBottom: 10 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#111', borderColor: '#111' },
  chipTxt: { color: '#111' },
  chipTxtActive: { color: '#fff', fontWeight: '700' },

  modalBg: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCard: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 12, maxHeight: '85%', padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalSub: { color: '#64748B', marginTop: 2 },
  modalClose: { position: 'absolute', top: 0, right: 0, padding: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  lineRow: { flexDirection:'row', alignItems:'center', paddingVertical:4 },
  itemName: { flex:1, color:'#111', marginRight:8 },
  qty: { width: 90, textAlign:'right', color:'#475569' },
  amount: { width: 100, textAlign:'right' },

  /* ✅ Payment UI */
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  payKey: { width: 60, color: '#475569' },
  payVal: { color: '#111', fontWeight: '600' },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 },
  badgeTxt: { fontWeight: '700', fontSize: 12 },

  /* ✅ Slip preview */
  slipThumbWrap: { marginTop: 8, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  slipThumb: { width: '100%', height: 180, backgroundColor: '#F1F5F9' },
  slipOverlay: {
    position: 'absolute', right: 8, bottom: 8,
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6
  },
  slipOverlayTxt: { color: '#111', fontWeight: '700' },

  /* ✅ Slip fullscreen modal */
  slipModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  slipFull: { width: '92%', height: '80%' },
  slipClose: { position: 'absolute', top: 40, right: 20, padding: 8 },
});
