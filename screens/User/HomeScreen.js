// HomeScreen.js (Realtime + Pull-to-Refresh + Enhanced Expiry System)
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, StatusBar, Alert, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseconfig';
import { useNavigation } from '@react-navigation/native';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DAYS_SOON = 3;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const normalize = (s) => String(s || '').trim().toLowerCase();

export default function HomeScreen() {
  const navigation = useNavigation();
  const [uid, setUid] = useState(null);

  const [recipes, setRecipes] = useState([]);
  const [recipesReady, setRecipesReady] = useState(false);

  const [ingredients, setIngredients] = useState([]);
  const [ingredientsReady, setIngredientsReady] = useState(false);

  const [notifyCount, setNotifyCount] = useState(0);

  // Refresh control
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    if (!uid) return;
    try {
      setRefreshing(true);
      const q = query(collection(db, 'recipes'), where('status', '==', 'approved'));
      const rSnap = await getDocs(q);
      setRecipes(rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const iSnap = await getDocs(collection(db, 'users', uid, 'userIngredient'));
      const docs = iSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setIngredients(docs);
      
      // คำนวณการแจ้งเตือนใหม่
      const expired = getExpiredItems(docs);
      const warning = getExpiringItems(docs, DAYS_SOON);
      const allNotifyItems = [...expired, ...warning];
      setNotifyCount(allNotifyItems.length);
      
      if (allNotifyItems.length > 0) {
        await checkAndNotifyExpiringOncePerDay(uid, allNotifyItems);
      }
    } catch (e) {
      console.warn('Refresh error:', e?.message);
    } finally {
      setRefreshing(false);
    }
  }, [uid]);

  // auth
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUid(null);
        setIngredients([]);
        setIngredientsReady(true);
        return;
      }
      setUid(user.uid);
    });
    return () => unsub();
  }, []);

  // ensure notification permission (ครั้งเดียวหลังมี uid)
  useEffect(() => {
    if (!uid) return;
    (async () => { await ensureNotificationPermission(); })();
  }, [uid]);

  // Realtime: approved recipes
  useEffect(() => {
    const q = query(collection(db, 'recipes'), where('status', '==', 'approved'));
    const unsub = onSnapshot(q, (snap) => {
      setRecipes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setRecipesReady(true);
    }, (err) => {
      console.error('recipes onSnapshot error:', err);
      setRecipesReady(true);
    });
    return () => unsub();
  }, []);

  // Realtime: ingredients of user
  useEffect(() => {
    if (!uid) return;
    const colRef = collection(db, 'users', uid, 'userIngredient');
    const unsub = onSnapshot(colRef, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setIngredients(docs);
      setIngredientsReady(true);

      // คำนวณแจ้งเตือนแบบละเอียด
      const expired = getExpiredItems(docs);
      const warning = getExpiringItems(docs, DAYS_SOON);
      const allNotifyItems = [...expired, ...warning];
      setNotifyCount(allNotifyItems.length);
      
      if (allNotifyItems.length > 0) {
        checkAndNotifyExpiringOncePerDay(uid, allNotifyItems).catch(()=>{});
      }
    }, (err) => {
      console.error('ingredients onSnapshot error:', err);
      setIngredientsReady(true);
    });
    return () => unsub();
  }, [uid]);

  // คัดสูตรแนะนำ: มีวัตถุดิบ "ครบตามชื่อ"
  const recommendedRecipes = useMemo(() => {
    if (!recipes?.length) return [];
    const stockSet = new Set((ingredients || []).map(it => normalize(it?.name)).filter(Boolean));
    const pickName = (ing) => typeof ing === 'string' ? ing : (ing?.name || ing?.title || '');
    return recipes.filter(r => {
      const ings = Array.isArray(r?.ingredients) ? r.ingredients : [];
      if (!ings.length) return false;
      return ings.every(ing => stockSet.has(normalize(pickName(ing))));
    });
  }, [recipes, ingredients]);

  const loadingRecommended = !recipesReady || (uid ? !ingredientsReady : false);

  // รายการหมดอายุและใกล้หมดอายุ (แสดงหลายรายการ)
  const { expiredItems, warningItems, allExpiryItems } = useMemo(() => {
    const expired = getExpiredItems(ingredients);
    const warning = getExpiringItems(ingredients, DAYS_SOON);
    const all = [...expired, ...warning];
    
    return {
      expiredItems: expired,
      warningItems: warning,
      allExpiryItems: all
    };
  }, [ingredients]);

  // สไตล์การ์ดตามสถานะ
  const getCardStyleByStatus = (item) => {
    const status = getExpiryStatus(item);
    if (status === 'expired') return [styles.expItem, styles.expiredCard, styles.expiredBar];
    if (status === 'warning') return [styles.expItem, styles.warningCard, styles.warningBar];
    return styles.expItem;
  };
  
  const getDaysTextStyleByStatus = (item) => {
    const status = getExpiryStatus(item);
    if (status === 'expired') return [styles.expDays, { color: '#c62828' }];
    if (status === 'warning') return [styles.expDays, { color: '#f57c00' }];
    return styles.expDays;
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#556b2f" />
        }
      >
        <StatusBar backgroundColor="#556b2f" barStyle="light-content" />

        {/* Header */}
        <View style={styles.header}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} />
          <Text style={styles.headerText}>ทำกินเอง</Text>

          <TouchableOpacity
            style={styles.bellWrap}
            onPress={() => {
              if (allExpiryItems.length === 0) {
                Alert.alert('การแจ้งเตือน', 'ตอนนี้ยังไม่มีของหมดอายุหรือใกล้หมดอายุ');
                return;
              }

              const expiredCount = expiredItems.length;
              const warningCount = warningItems.length;
              
              let message = 'สรุปสถานะวัตถุดิบ:\n\n';
              
              if (expiredCount > 0) {
                message += `หมดอายุแล้ว: ${expiredCount} รายการ\n`;
                expiredItems.slice(0, 3).forEach(item => {
                  message += `• ${item.name} (${daysLeftText(item)})\n`;
                });
                if (expiredCount > 3) message += `และอีก ${expiredCount - 3} รายการ\n`;
                message += '\n';
              }
              
              if (warningCount > 0) {
                message += `ใกล้หมดอายุ: ${warningCount} รายการ\n`;
                warningItems.slice(0, 3).forEach(item => {
                  message += `• ${item.name} (${daysLeftText(item)})\n`;
                });
                if (warningCount > 3) message += `และอีก ${warningCount - 3} รายการ\n`;
              }

              Alert.alert('สรุปวันนี้', message.trim());
            }}
          >
            <Ionicons name="notifications-outline" size={24} color="white" />
            {notifyCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{Math.min(notifyCount, 99)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* สูตรอาหารแนะนำ (Realtime) */}
        <View style={{ marginTop: 20 }}>
          <SectionHeader title="สูตรอาหารแนะนำ" onSeeAll={() => navigation.navigate('SavedRecipes')} />
          {loadingRecommended ? (
            <Text style={styles.loadingText}>กำลังโหลด...</Text>
          ) : recommendedRecipes.length === 0 ? (
            <Text style={styles.emptyText}>ยังไม่มีสูตรที่วัตถุดิบครบ</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recipeScroll}>
              {recommendedRecipes.slice(0, 10).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => navigation.navigate('UserRecipeDetail', { recipe: item })}
                  style={styles.recipeCard}
                >
                  <Image
                    source={item.imageUrl ? { uri: item.imageUrl } : require('../../assets/images/sample-food.jpg')}
                    style={styles.recipeImage}
                  />
                  <Text style={styles.recipeTitle} numberOfLines={2}>{item.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* หมดอายุแล้ว */}
        <View style={{ marginTop: 25 }}>
          <SectionHeader 
            title={`วัตถุดิบหมดอายุแล้ว ${expiredItems.length > 0 ? `(${expiredItems.length})` : ''}`}
            onSeeAll={() => navigation.navigate('Fridge')} 
          />
          {expiredItems.length === 0 ? (
            <View style={styles.noItemContainer}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              <Text style={styles.noItemText}>ยังไม่มีของหมดอายุ</Text>
            </View>
          ) : (
            <View>
              {expiredItems.slice(0, 3).map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    getCardStyleByStatus(item),
                    index === 0 && { marginTop: 5 }
                  ]}
                  onPress={() => navigation.navigate('Fridge')}
                >
                  <Image
                    source={item.image ? { uri: item.image } : require('../../assets/images/sample-food.jpg')}
                    style={styles.expImg}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.expMeta}>
                      ปริมาณ: {item.quantity || '-'} · หมดอายุ: {formatDate(item.expiry)}
                    </Text>
                  </View>
                  <Text style={getDaysTextStyleByStatus(item)}>{daysLeftText(item)}</Text>
                </TouchableOpacity>
              ))}
              {expiredItems.length > 3 && (
                <TouchableOpacity 
                  style={styles.seeMoreButton}
                  onPress={() => navigation.navigate('Fridge')}
                >
                  <Text style={styles.seeMoreText}>ดูทั้งหมด {expiredItems.length} รายการ</Text>
                  <Ionicons name="chevron-forward" size={16} color="#8a6d3b" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ใกล้หมดอายุ */}
        <View style={{ marginTop: 25 }}>
          <SectionHeader 
            title={`วัตถุดิบใกล้หมดอายุ ${warningItems.length > 0 ? `(${warningItems.length})` : ''}`}
            onSeeAll={() => navigation.navigate('Fridge')} 
          />
          {warningItems.length === 0 ? (
            <View style={styles.noItemContainer}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              <Text style={styles.noItemText}>ยังไม่มีของใกล้หมดอายุ</Text>
            </View>
          ) : (
            <View>
              {warningItems.slice(0, 3).map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    getCardStyleByStatus(item),
                    index === 0 && { marginTop: 5 }
                  ]}
                  onPress={() => navigation.navigate('Fridge')}
                >
                  <Image
                    source={item.image ? { uri: item.image } : require('../../assets/images/sample-food.jpg')}
                    style={styles.expImg}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.expMeta}>
                      ปริมาณ: {item.quantity || '-'} · หมดอายุ: {formatDate(item.expiry)}
                    </Text>
                  </View>
                  <Text style={getDaysTextStyleByStatus(item)}>{daysLeftText(item)}</Text>
                </TouchableOpacity>
              ))}
              {warningItems.length > 3 && (
                <TouchableOpacity 
                  style={styles.seeMoreButton}
                  onPress={() => navigation.navigate('Fridge')}
                >
                  <Text style={styles.seeMoreText}>ดูทั้งหมด {warningItems.length} รายการ</Text>
                  <Ionicons name="chevron-forward" size={16} color="#8a6d3b" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* เมนูลัด */}
        <View style={{ marginTop: 30 }}>
          <Text style={styles.sectionTitle}>เมนูลัด</Text>
          <View style={styles.quickRow}>
            <QuickAction
              icon="add-circle-outline"
              label="เพิ่มวัตถุดิบ"
              color="#4CAF50"
              onPress={() => navigation.navigate('AddEditIngredient')}
            />
            <QuickAction
              icon="book-outline"
              label="เพิ่มสูตรอาหาร"
              color="#FF9800"
              onPress={() => navigation.navigate('AddEditRecipe')}
            />
          </View>
          <View style={styles.quickRow}>
            <QuickAction
              icon="heart-outline"
              label="สูตรที่บันทึกไว้"
              color="#E91E63"
              onPress={() => navigation.navigate('SavedRecipes')}
            />
            <QuickAction
              icon="reader-outline"
              label="เมนูเคยทำ"
              color="#9C27B0"
              onPress={() => navigation.navigate('HistoryRecipes')}
            />
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Components ---------- */
function SectionHeader({ title, onSeeAll }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <TouchableOpacity onPress={onSeeAll} style={styles.seeAllButton}>
        <Text style={styles.seeAll}>ดูทั้งหมด</Text>
        <Ionicons name="chevron-forward" size={16} color="#8a6d3b" />
      </TouchableOpacity>
    </View>
  );
}

function QuickAction({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={styles.quick} onPress={onPress}>
      <View style={[styles.quickIconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ---------- Enhanced Utils (ระบบวันที่ที่แม่นยำ) ---------- */
function toDate(val) {
  if (!val || val === '-') return null;
  
  // Firestore Timestamp
  if (typeof val?.toDate === 'function') return val.toDate();
  
  // Date object
  if (val instanceof Date && !isNaN(val.getTime())) return val;

  if (typeof val === 'string') {
    // รูปแบบไทย: "9 ส.ค. 2568"
    const dTh = parseThaiShortDate(val);
    if (dTh) return dTh;
    
    // รูปแบบ dd/mm/yyyy: "09/08/2025"
    const dSlash = parseSlashDate(val);
    if (dSlash) return dSlash;
    
    // รูปแบบ ISO: "2025-08-09"
    const dIso = new Date(val);
    if (!isNaN(dIso.getTime())) return dIso;
  }
  
  // Unix timestamp
  if (typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  
  return null;
}

function parseThaiShortDate(str) {
  const monthMap = {
    'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3, 'พ.ค.': 4, 'มิ.ย.': 5,
    'ก.ค.': 6, 'ส.ค.': 7, 'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11,
    // เพิ่มรูปแบบอื่น
    'มกราคม': 0, 'กุมภาพันธ์': 1, 'มีนาคม': 2, 'เมษายน': 3, 'พฤษภาคม': 4, 'มิถุนายน': 5,
    'กรกฎาคม': 6, 'สิงหาคม': 7, 'กันยายน': 8, 'ตุลาคม': 9, 'พฤศจิกายน': 10, 'ธันวาคม': 11
  };
  
  const match = str.match(/^\s*(\d{1,2})\s*([ก-ฮา-ิ์\.]+)\s*(\d{4})\s*$/);
  if (!match) return null;
  
  const day = parseInt(match[1], 10);
  let monthKey = match[2].trim();
  const yearBE = parseInt(match[3], 10);
  
  // ถ้าไม่มีจุด ให้เพิ่ม
  if (!monthKey.endsWith('.') && monthKey.length <= 4) {
    monthKey += '.';
  }
  
  const month = monthMap[monthKey];
  if (isNaN(day) || month == null || isNaN(yearBE)) return null;
  
  const yearCE = yearBE > 2500 ? yearBE - 543 : yearBE;
  const date = new Date(yearCE, month, day);
  
  return isNaN(date.getTime()) ? null : date;
}

function parseSlashDate(str) {
  const match = str.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);
  if (!match) return null;
  
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // month เป็น 0-based
  const year = parseInt(match[3], 10);
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (month < 0 || month > 11) return null;
  if (day < 1 || day > 31) return null;
  
  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date;
}

function diffDays(fromDate, toDate) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  
  // Reset time to midnight for accurate day calculation
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

function getExpiredItems(items) {
  const today = new Date();
  
  return items
    .map(item => {
      const expDate = toDate(item.expiry);
      return { ...item, _expDate: expDate };
    })
    .filter(item => item._expDate) // มีวันหมดอายุ
    .map(item => {
      const daysLeft = diffDays(today, item._expDate);
      return { ...item, _daysLeft: daysLeft };
    })
    .filter(item => item._daysLeft < 0) // หมดอายุแล้ว (ติดลบ)
    .sort((a, b) => a._daysLeft - b._daysLeft); // เรียงจากหมดอายุนานที่สุด
}

function getExpiringItems(items, daysWindow = 3) {
  const today = new Date();
  
  return items
    .map(item => {
      const expDate = toDate(item.expiry);
      return { ...item, _expDate: expDate };
    })
    .filter(item => item._expDate) // มีวันหมดอายุ
    .map(item => {
      const daysLeft = diffDays(today, item._expDate);
      return { ...item, _daysLeft: daysLeft };
    })
    .filter(item => item._daysLeft >= 0 && item._daysLeft <= daysWindow) // ใกล้หมดอายุ
    .sort((a, b) => a._daysLeft - b._daysLeft); // เรียงจากใกล้หมดอายุที่สุด
}

function getExpiryStatus(item) {
  const expDate = toDate(item.expiry);
  if (!expDate) return 'ok';
  
  const daysLeft = diffDays(new Date(), expDate);
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= DAYS_SOON) return 'warning';
  return 'ok';
}

function daysLeftText(item) {
  const daysLeft = item._daysLeft ?? diffDays(new Date(), toDate(item.expiry));
  
  if (daysLeft < -1) return `หมดอายุแล้ว ${Math.abs(daysLeft)} วัน`;
  if (daysLeft === -1) return 'หมดอายุเมื่อวาน';
  if (daysLeft < 0) return 'หมดอายุแล้ว';
  if (daysLeft === 0) return 'หมดอายุวันนี้';
  if (daysLeft === 1) return 'หมดอายุพรุ่งนี้';
  return `อีก ${daysLeft} วัน`;
}

function formatDate(val) {
  const date = toDate(val);
  if (!date) return '-';
  
  try {
    return date.toLocaleDateString('th-TH', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      timeZone: 'Asia/Bangkok'
    });
  } catch (error) {
    // Fallback format
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
}

async function ensureNotificationPermission() {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.status !== 'granted') {
      const request = await Notifications.requestPermissionsAsync();
      return request.status === 'granted';
    }
    return true;
  } catch (error) {
    console.warn('ขอสิทธิ์แจ้งเตือนไม่สำเร็จ:', error?.message);
    return false;
  }
}

async function checkAndNotifyExpiringOncePerDay(uid, items) {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const storageKey = `expiringNotified:${uid}:${today}`;
    const alreadyNotified = await AsyncStorage.getItem(storageKey);
    
    if (alreadyNotified === '1') return;

    const expiredItems = items.filter(item => {
      const daysLeft = item._daysLeft ?? diffDays(new Date(), toDate(item.expiry));
      return daysLeft < 0;
    });
    
    const warningItems = items.filter(item => {
      const daysLeft = item._daysLeft ?? diffDays(new Date(), toDate(item.expiry));
      return daysLeft >= 0 && daysLeft <= DAYS_SOON;
    });

    if (expiredItems.length === 0 && warningItems.length === 0) return;

    let title = '';
    let body = '';
    
    if (expiredItems.length > 0 && warningItems.length > 0) {
      title = 'วัตถุดิบหมดอายุและใกล้หมดอายุ';
      body = `หมดอายุ ${expiredItems.length} รายการ, ใกล้หมดอายุ ${warningItems.length} รายการ`;
    } else if (expiredItems.length > 0) {
      title = 'วัตถุดิบหมดอายุแล้ว';
      body = `มี ${expiredItems.length} รายการหมดอายุแล้ว`;
    } else {
      title = 'วัตถุดิบใกล้หมดอายุ';
      body = `มี ${warningItems.length} รายการใกล้หมดอายุ`;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { 
          type: 'expiring', 
          expired: expiredItems.length,
          warning: warningItems.length
        },
      },
      trigger: null, // แจ้งเตือนทันที
    });
    
    await AsyncStorage.setItem(storageKey, '1');
  } catch (error) {
    console.warn('ส่งแจ้งเตือนไม่ได้:', error?.message);
  }
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  safeContainer: { 
    flex: 1, 
    backgroundColor: '#fefae0' 
  },
  container: { 
    flex: 1, 
    backgroundColor: '#fefae0', 
    paddingHorizontal: 16 
  },

  // Header
  header: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#556b2f',
    padding: 18, 
    justifyContent: 'space-between', 
    borderRadius: 15, 
    marginTop: 10,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 8, 
    elevation: 6,
  },
  logo: { 
    width: 28, 
    height: 28, 
    marginRight: 10 
  },
  headerText: { 
    color: 'white', 
    fontSize: 22, 
    fontWeight: 'bold', 
    flex: 1 
  },
  bellWrap: { 
    position: 'relative', 
    padding: 8, 
    borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.2)' 
  },
  badge: { 
    position: 'absolute', 
    top: 2, 
    right: 2, 
    minWidth: 20, 
    height: 20, 
    borderRadius: 10, 
    backgroundColor: '#FF5722', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingHorizontal: 5 
  },
  badgeText: { 
    color: '#fff', 
    fontSize: 12, 
    fontWeight: '700' 
  },

  // Section headers
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 15 
  },
  sectionTitle: { 
    fontWeight: 'bold', 
    fontSize: 20, 
    color: '#d35400' 
  },
  seeAllButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(138, 109, 59, 0.1)', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20 
  },
  seeAll: { 
    color: '#8a6d3b', 
    fontWeight: '600', 
    marginRight: 4 
  },

  // Loading & Empty states
  loadingText: { 
    textAlign: 'center', 
    marginTop: 15, 
    fontSize: 16, 
    color: '#78716C' 
  },
  emptyText: { 
    textAlign: 'center', 
    marginTop: 15, 
    color: '#999', 
    fontSize: 16 
  },

  // Recipe cards
  recipeScroll: { 
    paddingVertical: 10 
  },
  recipeCard: {
    marginRight: 15, 
    width: 170, 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    borderRadius: 15, 
    padding: 12,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 3,
  },
  recipeImage: { 
    width: 146, 
    height: 110, 
    borderRadius: 12, 
    resizeMode: 'cover', 
    marginBottom: 8 
  },
  recipeTitle: { 
    fontWeight: 'bold', 
    fontSize: 15, 
    color: '#333', 
    textAlign: 'center', 
    lineHeight: 20 
  },

  // No item state
  noItemContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f0f9ff', 
    padding: 16, 
    borderRadius: 12, 
    borderLeftWidth: 4, 
    borderLeftColor: '#4CAF50', 
    marginTop: 5 
  },
  noItemText: { 
    color: '#0f766e', 
    marginLeft: 10, 
    fontSize: 16, 
    fontWeight: '500' 
  },

  // Expired/Warning items
  expItem: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    padding: 15, 
    borderRadius: 15,
    shadowColor: '#000', 
    shadowOpacity: 0.08, 
    shadowRadius: 8, 
    elevation: 4, 
    gap: 12, 
    borderLeftWidth: 0, 
    marginTop: 8,
  },
  expiredCard: { 
    backgroundColor: '#fef2f2' 
  },
  expiredBar: { 
    borderLeftWidth: 6, 
    borderLeftColor: '#ef4444' 
  },
  warningCard: { 
    backgroundColor: '#fffbeb' 
  },
  warningBar: { 
    borderLeftWidth: 6, 
    borderLeftColor: '#f59e0b' 
  },
  expImg: { 
    width: 60, 
    height: 60, 
    borderRadius: 12, 
    backgroundColor: '#eee' 
  },
  expTitle: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: '#333', 
    marginBottom: 2 
  },
  expMeta: { 
    marginTop: 4, 
    color: '#666', 
    fontSize: 14, 
    lineHeight: 18 
  },
  expDays: { 
    color: '#556b2f', 
    fontWeight: '700', 
    fontSize: 14 
  },

  // See more button
  seeMoreButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(138, 109, 59, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(138, 109, 59, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeMoreText: {
    color: '#8a6d3b',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },

  // Quick actions
  quickRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    gap: 12, 
    marginTop: 12 
  },
  quick: { 
    flex: 1, 
    backgroundColor: '#fff', 
    borderRadius: 15, 
    paddingVertical: 20, 
    paddingHorizontal: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.06, 
    shadowRadius: 6, 
    elevation: 2 
  },
  quickIconContainer: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 8 
  },
  quickText: { 
    marginTop: 6, 
    color: '#333', 
    fontWeight: '600', 
    fontSize: 13, 
    textAlign: 'center', 
    lineHeight: 16 
  },
});