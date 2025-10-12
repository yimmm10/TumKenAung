// screens/User/CartScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
  ActivityIndicator, SafeAreaView, Image, Modal, Pressable
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  collection, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc, writeBatch
} from 'firebase/firestore';
import { db, auth, storage } from '../../firebaseconfig';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

const THEME = {
  orange: '#FFA920',
  yellow: '#FBDB58',
  green:  '#425010',
  bg:     '#FFFDF5',
  text:   '#1C1917',
  muted:  '#6B7280',
  line:   '#F7F0CE',
};

/* ------------------ PromptPay QR (EMVCo) ------------------ */
const tlv = (tag, value) => `${tag}${String(value.length).padStart(2,'0')}${value}`;
const crc16 = (str) => {
  let crc = 0xFFFF;
  for (let i=0;i<str.length;i++){
    crc ^= str.charCodeAt(i) << 8;
    for (let j=0;j<8;j++){
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};
const normalizePromptPay = (raw) => {
  const d = (raw||'').replace(/\D/g,'');
  if (!d) return { idTag:null, value:null };
  if (d.length === 13) return { idTag:'02', value:d };           // บัตร ปชช.
  let phone = d;
  if (phone.startsWith('0066')) { /* ok */ }
  else if (phone.startsWith('66')) phone = '00'+phone;
  else if (phone.startsWith('0') && phone.length===10) phone = '0066'+phone.slice(1);
  else if (phone.length===9) phone = '0066'+phone;
  if (phone.startsWith('0066')) return { idTag:'01', value:phone };
  return { idTag:null, value:null };
};
const buildPromptPayPayload = ({ promptpayId, amount, merchantName='Merchant', merchantCity='Bangkok' }) => {
  const { idTag, value } = normalizePromptPay(promptpayId);
  if (!idTag || !value) return null;
  const AID = 'A000000677010111';
  const mai = tlv('00', AID) + tlv(idTag, value);
  const payloadNoCRC =
    tlv('00','01') +          // Version
    tlv('01','12') +          // Dynamic QR
    tlv('29', mai) +          // Merchant Account Info (PromptPay)
    tlv('52','0000') +        // MCC
    tlv('53','764') +         // Currency THB
    tlv('54', Number(amount).toFixed(2)) + // Amount
    tlv('58','TH') +          // Country
    tlv('59', merchantName.slice(0,25)) +  // Name
    tlv('60', merchantCity.slice(0,15)) +  // City
    '6304';                   // CRC (placeholder)
  const crc = crc16(payloadNoCRC);
  return payloadNoCRC + crc;
};
/* ---------------------------------------------------------- */

const toRad = (v) => (v * Math.PI) / 180;
const haversineKm = (a,b,c,d) => {
  if ([a,b,c,d].some(n => typeof n !== 'number')) return null;
  const R = 6371, dLat = toRad(c-a), dLon = toRad(d-b);
  const A = Math.sin(dLat/2)**2 + Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(dLon/2)**2;
  return 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A)) * R;
};

export default function CartScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [vendor, setVendor] = useState(null);

  const [fulfillment, setFulfillment] = useState('pickup'); // 'pickup' | 'delivery'
  const [userLoc, setUserLoc] = useState(null);

  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'cod' | 'transfer'

  // QR modal
  const [qrOpen, setQrOpen] = useState(false);
  const [qrPayload, setQrPayload] = useState(null);

  // Slip upload
  const [slipUri, setSlipUri] = useState(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: 'ตะกร้าสินค้า',
      headerStyle: { backgroundColor: THEME.green },
      headerTintColor: '#fff',
      headerTitleStyle: { color: '#fff', fontWeight: '700' },
    });
  }, [navigation]);

  useEffect(() => {
    (async () => {
      const user = auth.currentUser;
      if (!user) { setLoading(false); return; }
      setLoading(true);

      const cartSnap = await getDocs(collection(db, 'users', user.uid, 'cart'));
      const arr = cartSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(arr);

      const venId = arr[0]?.vendorId;
      if (venId) {
        const venSnap = await getDoc(doc(db, 'vendors', venId));
        setVendor(venSnap.exists() ? { id: venSnap.id, ...venSnap.data() } : null);
      } else {
        setVendor(null);
      }
      setLoading(false);
    })();
  }, []);

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0),
    [items]
  );

  const deliveryInfo = useMemo(() => {
    if (!vendor || fulfillment !== 'delivery') return { fee: 0, distanceKm: null };
    const base = Number(vendor.deliveryBaseFee ?? 20);
    const perKm = Number(vendor.deliveryPerKm ?? 5);
    if (!userLoc || vendor.lat == null || vendor.lng == null) return { fee: base, distanceKm: null };
    const km = haversineKm(userLoc.lat, userLoc.lng, vendor.lat, vendor.lng) || 0;
    const fee = Math.round(base + perKm * km);
    return { fee, distanceKm: km };
  }, [vendor, fulfillment, userLoc]);

  const total = subtotal + (fulfillment === 'delivery' ? deliveryInfo.fee : 0);

  const inc = async (row) => {
    const user = auth.currentUser; if (!user) return;
    await updateDoc(doc(db, 'users', user.uid, 'cart', row.id), { qty: Number(row.qty || 0) + 1 });
    setItems(items.map(i => i.id === row.id ? { ...i, qty: Number(i.qty || 0) + 1 } : i));
  };
  const dec = async (row) => {
    const user = auth.currentUser; if (!user) return;
    const next = Math.max(1, Number(row.qty || 0) - 1);
    await updateDoc(doc(db, 'users', user.uid, 'cart', row.id), { qty: next });
    setItems(items.map(i => i.id === row.id ? { ...i, qty: next } : i));
  };
  const removeRow = async (row) => {
    const user = auth.currentUser; if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'cart', row.id));
    setItems(items.filter(i => i.id !== row.id));
  };

  const chooseDelivery = async () => {
    if (!vendor?.deliveryEnabled) return;
    setFulfillment('delivery');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({});
      setUserLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } else {
      setUserLoc(null);
    }
  };

  // ---------- Order creators ----------
  const placeOrderCOD = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('กรุณาเข้าสู่ระบบ');
    if (items.length === 0) return Alert.alert('ตะกร้าว่าง');
    if (fulfillment === 'delivery' && !vendor?.deliveryEnabled) return Alert.alert('ร้านนี้ยังไม่เปิดบริการจัดส่ง');

    const order = {
      userId: user.uid,
      vendorId: vendor?.id || items[0].vendorId,
      vendorName: vendor?.name || items[0].vendorName || '',
      items: items.map(i => ({
        name: i.name, price: i.price, qty: i.qty, unit: i.unit, imageUrl: i.imageUrl, stockId: i.stockId
      })),
      fulfillment,
      deliveryFee: fulfillment === 'delivery' ? deliveryInfo.fee : 0,
      subtotal,
      total,
      userLocation: fulfillment === 'delivery' ? userLoc : null,
      paymentMethod: 'cod',
      paymentStatus: 'cod_pending',
      placedAt: new Date(),
      status: 'pending',
    };

    const refOrder = doc(collection(db, 'orders'));
    await setDoc(refOrder, order);

    const batch = writeBatch(db);
    items.forEach(i => batch.delete(doc(db, 'users', user.uid, 'cart', i.id)));
    await batch.commit();

    Alert.alert('สั่งซื้อสำเร็จ', 'ส่งคำสั่งซื้อให้ร้านเรียบร้อย', [
      { text: 'ตกลง', onPress: () => navigation.goBack() }
    ]);
  };

  const placeOrderWithSlip = async (paymentSlipUrl) => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('กรุณาเข้าสู่ระบบ');
    if (items.length === 0) return Alert.alert('ตะกร้าว่าง');
    if (fulfillment === 'delivery' && !vendor?.deliveryEnabled) return Alert.alert('ร้านนี้ยังไม่เปิดบริการจัดส่ง');

    const order = {
      userId: user.uid,
      vendorId: vendor?.id || items[0].vendorId,
      vendorName: vendor?.name || items[0].vendorName || '',
      items: items.map(i => ({
        name: i.name, price: i.price, qty: i.qty, unit: i.unit, imageUrl: i.imageUrl, stockId: i.stockId
      })),
      fulfillment,
      deliveryFee: fulfillment === 'delivery' ? deliveryInfo.fee : 0,
      subtotal,
      total,
      userLocation: fulfillment === 'delivery' ? userLoc : null,
      paymentMethod: 'transfer',
      paymentStatus: 'awaiting_verification',   // ❗️รอตรวจสลิปจากร้าน
      paymentSlipUrl,
      placedAt: new Date(),
      status: 'pending',
    };

    const refOrder = doc(collection(db, 'orders'));
    await setDoc(refOrder, order);

    const batch = writeBatch(db);
    items.forEach(i => batch.delete(doc(db, 'users', user.uid, 'cart', i.id)));
    await batch.commit();

    setQrOpen(false);
    setSlipUri(null);
    Alert.alert('ส่งคำสั่งซื้อแล้ว', 'รอร้านตรวจสอบการชำระเงิน', [
      { text: 'ตกลง', onPress: () => navigation.goBack() }
    ]);
  };

  // ---------- Handlers ----------
  const onPressOrder = async () => {
    if (!paymentMethod) return Alert.alert('กรุณาเลือกช่องทางชำระเงิน');

    if (paymentMethod === 'transfer') {
      const id = vendor?.promptpayId;
      if (!id) return Alert.alert('ไม่สามารถสร้าง QR', 'ร้านยังไม่เพิ่ม PromptPay ID');

      const payload = buildPromptPayPayload({
        promptpayId: id,
        amount: total,
        merchantName: vendor?.name || 'Merchant',
        merchantCity: vendor?.city || 'Bangkok',
      });
      if (!payload) return Alert.alert('ไม่สามารถสร้าง QR', 'รูปแบบ PromptPay ID ไม่ถูกต้อง');

      setQrPayload(payload);
      setSlipUri(null); // reset สลิปทุกครั้งที่เปิดใหม่
      setQrOpen(true);
      return;
    }

    // COD → ส่งออเดอร์เลย
    await placeOrderCOD();
  };

  const pickSlip = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('ไม่ได้รับอนุญาต', 'โปรดอนุญาตการเข้าถึงรูปภาพ');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });
    if (!res.canceled) {
      setSlipUri(res.assets[0].uri);
    }
  };

  const confirmPaidWithSlip = async () => {
    if (!slipUri) return; // ป้องกันกดซ้ำ
    try {
      setUploadingSlip(true);
      const user = auth.currentUser;
      const blob = await (await fetch(slipUri)).blob();
      const r = ref(storage, `slips/${user.uid}/${Date.now()}.jpg`);
      await uploadBytes(r, blob);
      const url = await getDownloadURL(r);
      await placeOrderWithSlip(url);
    } catch (e) {
      console.error(e);
      Alert.alert('อัปโหลดสลิปไม่สำเร็จ', 'โปรดลองอีกครั้ง');
    } finally {
      setUploadingSlip(false);
    }
  };

  /* ---------------- UI ---------------- */
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.center}><ActivityIndicator size="large" /></View>
      </SafeAreaView>
    );
  }
  if (items.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyWrap}>
          <Ionicons name="cart-outline" size={56} color={THEME.muted} />
          <Text style={{ color: THEME.muted, marginTop: 8 }}>ตะกร้ายังว่างอยู่</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.navigate('Buy')}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>ไปเลือกซื้อสินค้า</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, backgroundColor: THEME.bg }]}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={
          <View style={{ marginBottom: 8 }}>
            {vendor && (
              <View style={styles.vendorBox}>
                {vendor.photoURL ? (
                  <Image source={{ uri: vendor.photoURL }} style={styles.vendorAvatar} />
                ) : (
                  <View style={[styles.vendorAvatar, styles.vendorAvatarPh]}><Text>🏪</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.vendorName} numberOfLines={1}>{vendor.name}</Text>
                  {!!vendor.address && <Text style={styles.vendorAddr} numberOfLines={2}>{vendor.address}</Text>}
                </View>
              </View>
            )}
            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>รายการสินค้า</Text>
          </View>
        }
        renderItem={({ item }) => {
          const lineTotal = Number(item.price || 0) * Number(item.qty || 0);
          return (
            <View style={styles.row}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPh]}>
                    <Text style={{ color: THEME.muted, fontSize: 12 }}>No Image</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.sub}>
                    ฿{Number(item.price).toLocaleString('th-TH')}{item.unit ? `/${item.unit}` : ''}
                  </Text>

                  <View style={styles.qtyRow}>
                    <TouchableOpacity onPress={() => dec(item)} style={styles.qtyBtn}><Text style={styles.qtyBtnTxt}>−</Text></TouchableOpacity>
                    <Text style={styles.qtyNum}>{item.qty}</Text>
                    <TouchableOpacity onPress={() => inc(item)} style={styles.qtyBtn}><Text style={styles.qtyBtnTxt}>+</Text></TouchableOpacity>

                    <TouchableOpacity onPress={() => removeRow(item)} style={styles.removeBtn}>
                      <Ionicons name="trash-outline" size={18} color="#C62828" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.lineTotalRow}>
                    <Text style={styles.lineTotalLabel}>รวม</Text>
                    <Text style={styles.lineTotalValue}>฿{lineTotal.toLocaleString('th-TH')}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          <View style={{ marginTop: 8, paddingBottom: 120 + insets.bottom }}>
            <Text style={styles.sectionTitle}>รูปแบบการรับสินค้า</Text>
            <View style={styles.fulfillRow}>
              <TouchableOpacity
                onPress={() => setFulfillment('pickup')}
                style={[styles.tag, fulfillment === 'pickup' && styles.tagActive]}
              >
                <Ionicons name="walk-outline" size={16} color={fulfillment === 'pickup' ? '#fff' : THEME.text} style={{ marginRight: 6 }}/>
                <Text style={fulfillment === 'pickup' ? styles.tagTxtActive : styles.tagTxt}>รับที่ร้าน</Text>
              </TouchableOpacity>

              {vendor?.deliveryEnabled && (
                <TouchableOpacity
                  onPress={chooseDelivery}
                  style={[styles.tag, fulfillment === 'delivery' && styles.tagActive]}
                >
                  <Ionicons name="bicycle-outline" size={16} color={fulfillment === 'delivery' ? '#fff' : THEME.text} style={{ marginRight: 6 }}/>
                  <Text style={fulfillment === 'delivery' ? styles.tagTxtActive : styles.tagTxt}>ให้จัดส่ง</Text>
                </TouchableOpacity>
              )}
            </View>

            {fulfillment === 'delivery' && (
              <Text style={styles.deliveryInfo}>
                ค่าส่งโดยประมาณ: ฿{deliveryInfo.fee.toLocaleString('th-TH')}
                {deliveryInfo.distanceKm != null ? ` (~${deliveryInfo.distanceKm.toFixed(1)} กม.)` : ''}
              </Text>
            )}

            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>ช่องทางชำระเงิน</Text>
            <View style={styles.payRow}>
              <TouchableOpacity
                onPress={() => setPaymentMethod('cod')}
                style={[styles.payOption, paymentMethod === 'cod' && styles.payActive]}
              >
                <Ionicons name="cash-outline" size={16} color={paymentMethod === 'cod' ? '#fff' : THEME.text} style={{ marginRight: 6 }}/>
                <Text style={paymentMethod === 'cod' ? styles.payTxtActive : styles.payTxt}>เก็บเงินปลายทาง</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPaymentMethod('transfer')}
                style={[styles.payOption, paymentMethod === 'transfer' && styles.payActive]}
              >
                <Ionicons name="card-outline" size={16} color={paymentMethod === 'transfer' ? '#fff' : THEME.text} style={{ marginRight: 6 }}/>
                <Text style={paymentMethod === 'transfer' ? styles.payTxtActive : styles.payTxt}>โอนเงิน/พร้อมเพย์</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.totalCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>รวมสินค้า</Text>
                <Text style={styles.totalValueSm}>฿{subtotal.toLocaleString('th-TH')}</Text>
              </View>
              {fulfillment === 'delivery' && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>ค่าส่งโดยประมาณ</Text>
                  <Text style={styles.totalValueSm}>฿{deliveryInfo.fee.toLocaleString('th-TH')}</Text>
                </View>
              )}
              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { fontWeight: '800' }]}>ยอดชำระทั้งหมด</Text>
                <Text style={styles.totalValue}>฿{total.toLocaleString('th-TH')}</Text>
              </View>
            </View>
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />

      {/* แถบล่าง — ปุ่มสั่งซื้อ */}
      <View style={[styles.bottomBar, { paddingBottom: 12 + insets.bottom }]}>
        <TouchableOpacity style={styles.orderBtn} onPress={onPressOrder}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>สั่งซื้อ</Text>
        </TouchableOpacity>
      </View>

      {/* Modal QR + อัปโหลดสลิป (จำเป็นก่อนยืนยัน) */}
      <Modal visible={qrOpen} transparent animationType="slide" onRequestClose={() => setQrOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="qr-code-outline" size={20} color={THEME.orange} />
              <Text style={{ marginLeft: 6, fontWeight: '800', color: THEME.text }}>สแกนชำระเงิน</Text>
            </View>

            {qrPayload ? (
              <View style={{ alignItems: 'center' }}>
                <QRCode value={qrPayload} size={220} />
                <Text style={{ marginTop: 10, color: THEME.muted, textAlign: 'center' }}>
                  ยอดชำระ: ฿{total.toLocaleString('th-TH')}
                </Text>
                {vendor?.promptpayId && (
                  <Text style={{ color: THEME.muted, textAlign: 'center', marginTop: 4 }}>
                    PromptPay: {vendor.promptpayId}
                  </Text>
                )}
              </View>
            ) : (
              <View style={[styles.qrImage, styles.qrPh]}>
                <Text style={{ color: THEME.muted, textAlign: 'center' }}>
                  ไม่พบข้อมูลสำหรับสร้าง QR
                </Text>
              </View>
            )}

            {/* แนบสลิป (จำเป็น) */}
              <View style={{ marginTop: 12 }}>
                {/* กรณียังไม่มีสลิป → แสดงการ์ดเส้นประชวนกด */}
                {!slipUri && (
                  <Pressable
                    onPress={pickSlip}
                    style={styles.slipDrop}
                    accessibilityRole="button"
                    accessibilityLabel="แนบสลิปการโอน"
                  >
                    <Ionicons name="cloud-upload-outline" size={36} color={THEME.orange} />
                    <Text style={styles.slipDropTitle}>แตะเพื่อแนบสลิปการโอน</Text>
                    <Text style={styles.slipDropHint}>รองรับ JPG/PNG • ให้เห็นยอดและเวลาโอนชัดเจน</Text>
                  </Pressable>
                )}

                {/* มีสลิปแล้ว → แสดงตัวอย่าง + ปุ่มลบ/เปลี่ยน */}
                {slipUri && (
                  <View style={styles.slipPreviewWrap}>
                    <Image source={{ uri: slipUri }} style={styles.slipPreview} />
                    <View style={styles.slipActions}>
                      <Pressable style={styles.slipActionBtn} onPress={() => setSlipUri(null)}>
                        <Ionicons name="trash-outline" size={18} color={THEME.text} />
                        <Text style={styles.slipActionTxt}>ลบสลิป</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.slipActionBtn, { backgroundColor: THEME.yellow }]}
                        onPress={pickSlip}
                      >
                        <Ionicons name="swap-horizontal-outline" size={18} color={THEME.text} />
                        <Text style={styles.slipActionTxt}>เปลี่ยนรูป</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>

            <Text style={{ color: THEME.muted, marginTop: 8, textAlign: 'center' }}>
              เมื่อชำระเงินแล้ว กด “ฉันชำระเงินแล้ว” เพื่อส่งออเดอร์ให้ร้าน (รอตรวจสอบ)
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Pressable style={[styles.modalBtn, { backgroundColor: '#E5E7EB' }]} onPress={() => setQrOpen(false)}>
                <Text style={{ fontWeight: '700', color: THEME.text }}>ยกเลิก</Text>
              </Pressable>
              <Pressable
                disabled={!slipUri || uploadingSlip}
                style={[
                  styles.modalBtn,
                  { backgroundColor: (!slipUri || uploadingSlip) ? '#9CA3AF' : THEME.green }
                ]}
                onPress={confirmPaidWithSlip}
              >
                <Text style={{ fontWeight: '700', color: '#fff' }}>
                  {uploadingSlip ? 'กำลังอัปโหลด…' : 'ฉันชำระเงินแล้ว'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  browseBtn: { marginTop: 10, backgroundColor: THEME.orange, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },

  vendorBox: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1, borderColor: THEME.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 0,
  },
  vendorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF3E0' },
  vendorAvatarPh: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: THEME.line },
  vendorName: { fontWeight: '700', color: THEME.text, fontSize: 16 },
  vendorAddr: { color: THEME.muted, fontSize: 12, marginTop: 2 },

  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#FFF7ED' },
  thumbPh: { alignItems: 'center', justifyContent: 'center' },

  name: { fontSize: 15, fontWeight: '600', color: THEME.text },
  sub: { marginTop: 2, color: THEME.muted },

  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  qtyBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: THEME.line, backgroundColor: '#FFF7ED',
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnTxt: { fontSize: 18, fontWeight: '700', color: THEME.text, lineHeight: 20 },
  qtyNum: { width: 42, textAlign: 'center', fontWeight: '700' },
  removeBtn: { marginLeft: 10 },

  lineTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  lineTotalLabel: { color: THEME.text },
  lineTotalValue: { fontWeight: '800', color: THEME.green },

  sectionTitle: { marginTop: 12, fontWeight: '700', fontSize: 16, color: THEME.text },
  fulfillRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tag: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 999, borderWidth: 1, borderColor: THEME.line,
    backgroundColor: '#fff',
  },
  tagActive: { backgroundColor: THEME.orange, borderColor: THEME.orange },
  tagTxt: { color: THEME.text, fontWeight: '600' },
  tagTxtActive: { color: '#fff', fontWeight: '700' },
  deliveryInfo: { marginTop: 8, color: THEME.muted },

  payRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  payOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 999, borderWidth: 1, borderColor: THEME.line,
    backgroundColor: '#FFF',
  },
  payActive: { backgroundColor: THEME.orange, borderColor: THEME.orange },
  payTxt: { color: THEME.text, fontWeight: '600' },
  payTxtActive: { color: '#fff', fontWeight: '700' },

  totalCard: {
    backgroundColor: '#FFF',
    borderWidth: 1, borderColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  divider: { height: 1, backgroundColor: '#EFEFEF', marginVertical: 8 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { color: THEME.text },
  totalValueSm: { fontWeight: '700', color: THEME.text },
  totalValue: { fontSize: 18, fontWeight: '800', color: THEME.green },

  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: THEME.green,
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    paddingHorizontal: 12, paddingTop: 10,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  orderBtn: {
    backgroundColor: THEME.orange,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center', padding: 16
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  qrImage: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#F8FAFC' },
  qrPh: { alignItems: 'center', justifyContent: 'center' },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  // --- Slip uploader styles ---
slipDrop: {
  borderWidth: 2,
  borderStyle: 'dashed',
  borderColor: THEME.orange,
  backgroundColor: '#FFF8E1', // เหลืองอ่อนให้อ่านง่าย
  paddingVertical: 18,
  paddingHorizontal: 14,
  borderRadius: 12,
  alignItems: 'center',
},
slipDropTitle: { marginTop: 8, fontWeight: '800', color: THEME.text },
slipDropHint: { marginTop: 4, color: THEME.muted, fontSize: 12, textAlign: 'center' },

slipPreviewWrap: { marginTop: 4 },
slipPreview: { width: '100%', height: 160, borderRadius: 10 },
slipActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
slipActionBtn: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  paddingVertical: 10,
  borderRadius: 10,
  backgroundColor: '#F3F4F6',
},
slipActionTxt: { fontWeight: '700', color: THEME.text },
});
