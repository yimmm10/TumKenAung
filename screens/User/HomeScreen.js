// HomeScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, StatusBar, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseconfig';
import { useNavigation } from '@react-navigation/native';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DAYS_SOON = 3; // ใกล้หมดอายุภายในกี่วัน

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function HomeScreen() {
  const navigation = useNavigation();
  const [uid, setUid] = useState(null);

  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifyCount, setNotifyCount] = useState(0);

  // 1) โหลด uid
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUid(null);
        setLoading(false);
        Alert.alert('ยังไม่ได้ล็อกอิน', 'กรุณาเข้าสู่ระบบก่อน');
        return;
      }
      setUid(user.uid);
    });
    return () => unsub();
  }, []);

  // 2) โหลด recipes
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'recipes'));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRecipes(data);
      } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลด recipes:', error);
      }
    })();
  }, []);

  // 3) โหลดวัตถุดิบ + แจ้งเตือน (เฉพาะใกล้หมดอายุ)
  useEffect(() => {
    if (!uid) return;
    (async () => {
      setLoading(true);
      try {
        await ensureNotificationPermission();

        const snap = await getDocs(collection(db, 'users', uid, 'userIngredient'));
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setIngredients(docs);

        const soon = getExpiringItems(docs, DAYS_SOON); // 0..DAYS_SOON วัน
        setNotifyCount(soon.length);
        if (soon.length > 0) await checkAndNotifyExpiringOncePerDay(uid, soon);
      } catch (err) {
        console.error('โหลดวัตถุดิบหรือแจ้งเตือนผิดพลาด:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  // 4) สร้างลิสต์โชว์: หมดอายุ 1, ใกล้หมด 1
  const { firstExpired, firstWarning } = useMemo(() => {
    const expired = getExpiredItems(ingredients);            // daysLeft < 0
    const warning = getExpiringItems(ingredients, DAYS_SOON); // 0..DAYS_SOON
    return {
      firstExpired: expired[0] || null,
      firstWarning: warning[0] || null,
    };
  }, [ingredients]);

  // สไตล์การ์ดตามสถานะ
  const getCardStyleByStatus = (it) => {
    const status = getExpiryStatus(it);
    if (status === 'expired') return [styles.expItem, styles.expiredCard, styles.expiredBar];
    if (status === 'warning') return [styles.expItem, styles.warningCard, styles.warningBar];
    return styles.expItem;
  };
  const getDaysTextStyleByStatus = (it) => {
    const status = getExpiryStatus(it);
    if (status === 'expired') return [styles.expDays, { color: '#c62828' }];
    if (status === 'warning') return [styles.expDays, { color: '#b04d00' }];
    return styles.expDays;
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar backgroundColor="#556b2f" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
        <Text style={styles.headerText}>ทำกินเอง</Text>

        <TouchableOpacity
          style={styles.bellWrap}
          onPress={() => {
            if (!firstExpired && !firstWarning) {
              Alert.alert('การแจ้งเตือน', 'ตอนนี้ยังไม่มีของหมดอายุหรือใกล้หมดอายุ');
            } else {
              const lines = [];
              if (firstExpired) lines.push(`หมดอายุ: ${firstExpired.name} (${daysLeftText(firstExpired)})`);
              if (firstWarning) lines.push(`ใกล้หมดอายุ: ${firstWarning.name} (${daysLeftText(firstWarning)})`);
              Alert.alert('สรุปวันนี้', lines.join('\n'));
            }
          }}
        >
          <Ionicons name="notifications-outline" size={24} color="white" />
          {notifyCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{notifyCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* สูตรอาหารแนะนำ */}
      <View style={{ marginTop: 10 }}>
        <SectionHeader title="สูตรอาหารแนะนำ" onSeeAll={() => navigation.navigate('AddEditRecipe')} />
        {loading ? (
          <Text style={{ textAlign: 'center', marginTop: 10 }}>กำลังโหลด...</Text>
        ) : recipes.length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 10, color: '#999' }}>ยังไม่มีสูตรอาหารในระบบ</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recipes.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => navigation.navigate('UserRecipeDetail', { recipe: item })}
                style={styles.recipeCard}
              >
                <Image
                  source={item.imageUrl ? { uri: item.imageUrl } : require('../../assets/images/sample-food.jpg')}
                  style={styles.recipeImage}
                />
                <Text style={styles.recipeTitle} numberOfLines={1}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* หมดอายุแล้ว (แสดง 1 รายการ) */}
      <View style={{ marginTop: 18 }}>
        <SectionHeader title="วัตถุดิบหมดอายุแล้ว" onSeeAll={() => navigation.navigate('Fridge')} />
        {!firstExpired ? (
          <Text style={{ color: '#6b6b6b', marginTop: 6 }}>ยังไม่มีของหมดอายุ</Text>
        ) : (
          <TouchableOpacity
            style={getCardStyleByStatus(firstExpired)}
            onPress={() => navigation.navigate('Fridge')}
          >
            <Image
              source={firstExpired.image ? { uri: firstExpired.image } : require('../../assets/images/sample-food.jpg')}
              style={styles.expImg}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.expTitle} numberOfLines={1}>{firstExpired.name}</Text>
              <Text style={styles.expMeta}>
                ปริมาณ: {firstExpired.quantity ?? '-'}   ·   หมดอายุ: {formatDate(firstExpired.expiry)}
              </Text>
            </View>
            <Text style={getDaysTextStyleByStatus(firstExpired)}>{daysLeftText(firstExpired)}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ใกล้หมดอายุ (แสดง 1 รายการ) */}
      <View style={{ marginTop: 18 }}>
        <SectionHeader title={`วัตถุดิบใกล้หมดอายุ `} onSeeAll={() => navigation.navigate('Fridge')} />
        {!firstWarning ? (
          <Text style={{ color: '#6b6b6b', marginTop: 6 }}>ยังไม่มีของใกล้หมดอายุ</Text>
        ) : (
          <TouchableOpacity
            style={getCardStyleByStatus(firstWarning)}
            onPress={() => navigation.navigate('Fridge')}
          >
            <Image
              source={firstWarning.image ? { uri: firstWarning.image } : require('../../assets/images/sample-food.jpg')}
              style={styles.expImg}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.expTitle} numberOfLines={1}>{firstWarning.name}</Text>
              <Text style={styles.expMeta}>
                ปริมาณ: {firstWarning.quantity ?? '-'}   ·   หมดอายุ: {formatDate(firstWarning.expiry)}
              </Text>
            </View>
            <Text style={getDaysTextStyleByStatus(firstWarning)}>{daysLeftText(firstWarning)}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* เมนูลัด */}
      <View style={{ marginTop: 22 }}>
        <Text style={styles.sectionTitle}>เมนูลัด</Text>
        <View style={styles.quickRow}>
          <QuickAction
            icon="add-circle-outline"
            label="เพิ่มวัตถุดิบ"
            onPress={() => navigation.navigate('AddEditIngredient')}
          />
          <QuickAction
            icon="book-outline"
            label="เพิ่มสูตรอาหาร"
            onPress={() => navigation.navigate('AddRecipe')}
          />
          <QuickAction
            icon="heart-outline"
            label="สูตรที่บันทึกไว้"
            onPress={() => navigation.navigate('SavedRecipes')}
          />
          <QuickAction
            icon="reader-outline"
            label="เมนูเคยทำ"
            onPress={() => navigation.navigate('HistoryRecipes')}
          />
        </View>
      </View>
    </ScrollView>
  );
}

/* ---------- Components ---------- */
function SectionHeader({ title, onSeeAll }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <TouchableOpacity onPress={onSeeAll}>
        <Text style={styles.seeAll}>ดูทั้งหมด ›</Text>
      </TouchableOpacity>
    </View>
  );
}

function QuickAction({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.quick} onPress={onPress}>
      <Ionicons name={icon} size={24} color="#556b2f" />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ---------- Utils (วันที่ + สถานะ) ---------- */
function toDate(val) {
  if (!val || val === '-') return null;
  if (typeof val?.toDate === 'function') return val.toDate(); // Firestore Timestamp
  if (val instanceof Date) return val;

  if (typeof val === 'string') {
    const dTh = parseThaiShortDate(val); // "9 ส.ค. 2568"
    if (dTh) return dTh;
    const dSlash = parseSlashDate(val);  // "09/08/2025"
    if (dSlash) return dSlash;
    const d = new Date(val);             // ISO
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}
function parseThaiShortDate(str) {
  const map = {
    'ม.ค.':0,'ก.พ.':1,'มี.ค.':2,'เม.ย.':3,'พ.ค.':4,'มิ.ย.':5,
    'ก.ค.':6,'ส.ค.':7,'ก.ย.':8,'ต.ค.':9,'พ.ย.':10,'ธ.ค.':11
  };
  const m = str.match(/^\s*(\d{1,2})\s*([ก-ฮ\.]+)\s*(\d{4})\s*$/);
  if (!m) return null;
  const day = parseInt(m[1],10);
  let monKey = m[2].trim();
  if (!monKey.endsWith('.')) monKey += '.';
  const yearBE = parseInt(m[3],10);
  const mon = map[monKey];
  if (isNaN(day) || mon == null || isNaN(yearBE)) return null;
  const yearCE = yearBE - 543;
  const d = new Date(yearCE, mon, day);
  return isNaN(d.getTime()) ? null : d;
}
function parseSlashDate(str) {
  const m = str.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);
  if (!m) return null;
  const day = parseInt(m[1],10);
  const mon = parseInt(m[2],10) - 1;
  const year = parseInt(m[3],10);
  const d = new Date(year, mon, day);
  return isNaN(d.getTime()) ? null : d;
}
function diffDays(from, to) {
  const a = new Date(from); a.setHours(0,0,0,0);
  const b = new Date(to);   b.setHours(0,0,0,0);
  return Math.ceil((b - a) / (1000 * 60 * 60 * 24));
}
function getExpiredItems(items) {
  const today = new Date();
  return items
    .map(it => ({ ...it, _expDate: toDate(it.expiry) }))
    .filter(it => it._expDate)
    .map(it => ({ ...it, _daysLeft: diffDays(today, it._expDate) }))
    .filter(it => it._daysLeft < 0)                // หมดอายุแล้ว
    .sort((a, b) => a._daysLeft - b._daysLeft);    // ใกล้ที่สุดก่อน (ติดลบมากน้อย)
}
function getExpiringItems(items, daysWindow = 3) {
  const today = new Date();
  return items
    .map(it => ({ ...it, _expDate: toDate(it.expiry) }))
    .filter(it => it._expDate)
    .map(it => ({ ...it, _daysLeft: diffDays(today, it._expDate) }))
    .filter(it => it._daysLeft >= 0 && it._daysLeft <= daysWindow)
    .sort((a, b) => a._daysLeft - b._daysLeft);
}
function getExpiryStatus(item) {
  const d = toDate(item.expiry);
  if (!d) return 'ok';
  const days = diffDays(new Date(), d);
  if (days < 0) return 'expired';
  if (days <= DAYS_SOON) return 'warning';
  return 'ok';
}
function daysLeftText(item) {
  const d = item._daysLeft ?? diffDays(new Date(), toDate(item.expiry));
  if (d < 0) return 'หมดอายุแล้ว';
  if (d === 0) return 'หมดอายุวันนี้';
  if (d === 1) return 'พรุ่งนี้';
  return `อีก ${d} วัน`;
}
function formatDate(val) {
  const d = toDate(val);
  if (!d) return '-';
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}
async function ensureNotificationPermission() {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      if (req.status !== 'granted') return false;
    }
    return true;
  } catch (e) {
    console.warn('ขอสิทธิ์แจ้งเตือนไม่สำเร็จ:', e?.message);
    return false;
  }
}
async function checkAndNotifyExpiringOncePerDay(uid, items) {
  const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const storeKey = `expiringNotified:${uid}:${todayKey}`;
  const already = await AsyncStorage.getItem(storeKey);
  if (already === '1') return;

  const list = items.slice(0, 6).map(it => `${it.name} (${daysLeftText(it)})`).join(', ');
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'วัตถุดิบใกล้หมดอายุ',
        body: list,
        data: { type: 'expiring', count: items.length },
      },
      trigger: null,
    });
    await AsyncStorage.setItem(storeKey, '1');
  } catch (e) {
    console.warn('ส่งแจ้งเตือนไม่ได้:', e?.message);
  }
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fefae0', padding: 15 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#556b2f', padding: 15, justifyContent: 'space-between',
    borderRadius: 10,
  },
  logo: { width: 24, height: 24, marginRight: 8 },
  headerText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  bellWrap: { position: 'relative' },
  badge: {
    position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18,
    borderRadius: 9, backgroundColor: '#d9534f', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, marginBottom: 6 },
  sectionTitle: { fontWeight: 'bold', fontSize: 18, color: '#d35400' },
  seeAll: { color: '#8a6d3b', fontWeight: '600' },

  recipeCard: { marginRight: 12, width: 160, alignItems: 'center' },
  recipeImage: { width: 160, height: 100, borderRadius: 10, resizeMode: 'cover' },
  recipeTitle: { marginTop: 5, fontWeight: 'bold', fontSize: 14, color: '#333' },

  /* การ์ดวัตถุดิบ + แถบสีสถานะ */
  expItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', padding: 10, borderRadius: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, gap: 10,
    borderLeftWidth: 0, // default
  },
  // หมดอายุแล้ว = พื้นหลังชมพูอ่อน + แถบแดง
  expiredCard: { backgroundColor: '#fdecea' },
  expiredBar: { borderLeftWidth: 8, borderLeftColor: '#e74c3c' },
  // ใกล้หมดอายุ = พื้นหลังเหลืองอ่อน + แถบเหลือง
  warningCard: { backgroundColor: '#fff8e1' },
  warningBar: { borderLeftWidth: 8, borderLeftColor: '#f1c40f' },

  expImg: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#eee' },
  expTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  expMeta: { marginTop: 2, color: '#777' },
  expDays: { color: '#556b2f', fontWeight: '700' },

  quickRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 8 },
  quick: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center'
  },
  quickText: { marginTop: 6, color: '#556b2f', fontWeight: '700' },
});
