// screens/User/ReviewWriteScreen.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../../firebaseconfig';
import {
  addDoc, collection, serverTimestamp, onSnapshot, query, where,
  doc, getDoc, runTransaction
} from 'firebase/firestore';

const VENDORS_COLLECTION = 'vendors';
const REVIEWS_COLLECTION = 'reviews';

export default function ReviewWriteScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const vendorId = route?.params?.vendorId || null;

  const [me, setMe] = useState(null); // { uid, displayName, photoURL }
  const [authReady, setAuthReady] = useState(false);

  const [vendor, setVendor] = useState(null);
  const [vendorLoading, setVendorLoading] = useState(true);

  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ---------- auth ----------
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setMe({ uid: user.uid, displayName: user.displayName || 'ผู้ใช้', photoURL: user.photoURL || null });
      } else setMe(null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // ---------- โหลดข้อมูลร้าน ----------
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!vendorId) { setVendorLoading(false); return; }
      try {
        const ref = doc(db, VENDORS_COLLECTION, vendorId);
        const snap = await getDoc(ref);
        if (!alive) return;
        if (snap.exists()) setVendor({ id: snap.id, ...snap.data() });
      } finally {
        if (alive) setVendorLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [vendorId]);

  // ---------- subscribe รีวิวของร้าน (เลี่ยง index โดยไม่ใส่ orderBy) ----------
  useEffect(() => {
    if (!vendorId) { setLoadingReviews(false); return; }
    const qy = query(
      collection(db, REVIEWS_COLLECTION),
      where('vendorId', '==', vendorId)
      // ไม่ใส่ orderBy เพื่อไม่ให้ต้องสร้าง composite index ตอนนี้
    );
    const unsub = onSnapshot(qy, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // sort ฝั่ง client แทน
      list.sort((a, b) => {
        const ta = a.createdAt?.toDate?.() ? a.createdAt.toDate().getTime() : 0;
        const tb = b.createdAt?.toDate?.() ? b.createdAt.toDate().getTime() : 0;
        return tb - ta; // ใหม่->เก่า
      });
      setReviews(list);
      setLoadingReviews(false);
    }, (err) => {
      console.log('reviews error', err);
      setLoadingReviews(false);
      // ถ้าคุณอยากได้ orderBy ที่ฝั่ง server จริง ๆ ให้กดลิงก์ Create Index ตามที่คอนโซลเด้ง
    });
    return () => unsub();
  }, [vendorId]);

  const canSubmit = useMemo(() => {
    return !!me?.uid && !!vendorId && rating > 0 && text.trim().length > 0 && !submitting;
  }, [me, vendorId, rating, text, submitting]);

  // ---------- ส่งรีวิว: reviews (เดิม) + users/{uid}/myReviews + อัปเดตสถิติร้าน ----------
  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);

      const vendorRef = doc(db, VENDORS_COLLECTION, vendorId);
      const reviewRef = doc(collection(db, REVIEWS_COLLECTION)); // id สำหรับ reviews
      const userReviewRef = doc(collection(db, 'users', me.uid, 'myReviews'), reviewRef.id);

      await runTransaction(db, async (tx) => {
        // 1) อ่านให้ครบก่อน: อ่านเอกสารร้านเพื่อคำนวณสถิติ
        const vSnap = await tx.get(vendorRef);
        const d = vSnap.exists() ? vSnap.data() : {};
        const oldCount = Number(d.ratingCount || 0);
        const oldSum   = Number(d.ratingSum || 0);
        const newCount = oldCount + 1;
        const newSum   = oldSum + Number(rating);
        const avgRating = newCount > 0 ? newSum / newCount : 0;

        // 2) ค่อยเขียนทั้งหมด
        const payload = {
          vendorId,
          userId: me.uid,
          userName: me.displayName || '',
          userPhoto: me.photoURL || null,
          rating,
          text: text.trim(),
          createdAt: serverTimestamp(),
        };

        // reviews (top-level เดิม)
        tx.set(reviewRef, payload);

        // users/{uid}/myReviews/{reviewId}
        tx.set(userReviewRef, payload);

        // อัปเดตสถิติร้าน
        tx.set(vendorRef, { ratingCount: newCount, ratingSum: newSum, avgRating }, { merge: true });
      });

      setRating(0);
      setText('');
      Keyboard.dismiss();
      Alert.alert('สำเร็จ', 'บันทึกรีวิวแล้ว');
    } catch (e) {
      console.error('ส่งรีวิวไม่สำเร็จ:', e);
      Alert.alert('ส่งรีวิวไม่สำเร็จ', e?.message || 'กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, me, vendorId, rating, text]);

  const headerTitle = vendorLoading ? 'รีวิวร้าน' : (vendor?.name ? `รีวิวร้าน: ${vendor.name}` : 'รีวิวร้าน');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#111" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
            <View style={{ width: 22 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 180 }}
            keyboardShouldPersistTaps="handled"
          >
            {!authReady ? (
              <View style={{ paddingVertical: 10 }}><ActivityIndicator /></View>
            ) : !me?.uid ? (
              <Text style={{ color: '#c00', marginBottom: 8 }}>กรุณาเข้าสู่ระบบเพื่อเขียนรีวิว</Text>
            ) : null}

            <Text style={styles.formLabel}>ให้คะแนน</Text>
            <StarInput value={rating} onChange={setRating} />

            <Text style={[styles.formLabel, { marginTop: 12 }]}>เขียนความคิดเห็น</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="รสชาติ บริการ ความสะอาด ฯลฯ"
              multiline
              style={styles.textArea}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
            />

            <TouchableOpacity
              style={[styles.submitBtn, { opacity: canSubmit ? 1 : 0.5 }]}
              disabled={!canSubmit}
              onPress={handleSubmit}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>ส่งรีวิว</Text>}
            </TouchableOpacity>

            <Text style={[styles.formLabel, { marginTop: 20 }]}>รีวิวล่าสุด</Text>
            {loadingReviews ? (
              <View style={{ paddingVertical: 12 }}><ActivityIndicator /></View>
            ) : reviews.length === 0 ? (
              <Text style={{ color: '#666' }}>ยังไม่มีรีวิว</Text>
            ) : (
              reviews.map((item) => (
                <View key={item.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    {item.userPhoto ? (
                      <Image source={{ uri: item.userPhoto }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, { alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="person-circle-outline" size={32} color="#bbb" />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.userName} numberOfLines={1}>{item.userName || 'ผู้ใช้'}</Text>
                      <StarRow value={Number(item.rating) || 0} size={14} />
                    </View>
                    {item.createdAt?.toDate &&
                      <Text style={styles.timeText}>{formatDate(item.createdAt.toDate())}</Text>}
                  </View>
                  <Text style={styles.reviewText}>{item.text}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

/* ===== utils & stars ===== */
function formatDate(d) {
  const dd = `${d.getDate()}`.padStart(2, '0');
  const mm = `${d.getMonth() + 1}`.padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = `${d.getHours()}`.padStart(2, '0');
  const min = `${d.getMinutes()}`.padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}
function StarRow({ value = 0, size = 18 }) {
  const val = Math.max(0, Math.min(5, Math.floor(Number(value) || 0)));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {[1,2,3,4,5].map(s => (
        <Ionicons key={s} name={s <= val ? 'star' : 'star-outline'} size={size} color="#F5A524" style={{ marginRight: 2 }} />
      ))}
    </View>
  );
}
function StarInput({ value = 0, onChange }) {
  return (
    <View style={{ flexDirection: 'row', marginTop: 6 }}>
      {[1,2,3,4,5].map(s => (
        <TouchableOpacity key={s} onPress={() => onChange(s)}>
          <Ionicons name={s <= value ? 'star' : 'star-outline'} size={28} color="#F5A524" style={{ marginRight: 6 }} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

/* ===== styles ===== */
const styles = StyleSheet.create({
  header:{ height:95, borderBottomWidth:1, borderBottomColor:'#eee', paddingHorizontal:12, flexDirection:'row', alignItems:'center' },
  backBtn:{ width:32, height:32, alignItems:'center', justifyContent:'center', marginRight:8 },
  headerTitle:{ flex:1, textAlign:'center', fontSize:18, fontWeight:'600', color:'#111' },

  formLabel:{ fontSize:13, color:'#555', marginBottom:4 },
  textArea:{ minHeight:90, borderWidth:1, borderColor:'#e5e5e5', borderRadius:12, padding:10, textAlignVertical:'top', fontSize:14, color:'#111', backgroundColor:'#fafafa' },
  submitBtn:{ marginTop:12, backgroundColor:'#0066CC', paddingVertical:12, borderRadius:12, alignItems:'center' },
  submitText:{ color:'#fff', fontWeight:'700', fontSize:16 },

  reviewCard:{ backgroundColor:'#fff', borderWidth:1, borderColor:'#eee', borderRadius:14, padding:12, marginTop:12 },
  reviewHeader:{ flexDirection:'row', alignItems:'center', marginBottom:8 },
  avatar:{ width:44, height:44, borderRadius:22, backgroundColor:'#f2f2f2' },
  userName:{ fontSize:14, fontWeight:'600', color:'#111' },
  timeText:{ fontSize:12, color:'#999' },
  reviewText:{ fontSize:14, color:'#222', lineHeight:20 },
});
