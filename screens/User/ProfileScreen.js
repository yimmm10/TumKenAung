// screens/User/ProfileScreen.js
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { getAuth, onAuthStateChanged, signOut, updateProfile } from 'firebase/auth';
import { db, storage } from '../../firebaseconfig';
import {
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs, query, where, limit, onSnapshot
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/** === Config === */
const USERS_COLLECTION = 'users';
const RECIPES_COLLECTION = 'recipes';
const FAVORITES_COLLECTION = 'favorites';
const FAVORITES_MODE = 'SUBCOLLECTION';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const auth = getAuth();

  // ⚠️ เพิ่ม ref เพื่อป้องกัน Alert ซ้ำ
  const isLoggingOut = useRef(false);

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [editName, setEditName]       = useState('');
  const [photoURL, setPhotoURL]       = useState('');
  const [saving, setSaving]           = useState(false);
  const [uid, setUid]                 = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [activeTab, setActiveTab] = useState('MyRecipes');

  const [myRecipes, setMyRecipes] = useState([]);
  const [myLoading, setMyLoading] = useState(true);

  const [favRecipes, setFavRecipes] = useState([]);
  const [favCount, setFavCount]     = useState(0);
  const [favLoading, setFavLoading] = useState(true);

  /** Auth + โหลดข้อมูลโปรไฟล์เริ่มต้น */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        // ⚠️ ถ้ากำลัง logout อยู่ ไม่ต้องแสดง Alert
        if (!user) {
          if (!isLoggingOut.current) {
            Alert.alert('ยังไม่ได้ล็อกอิน', 'กรุณาเข้าสู่ระบบก่อน');
          }
          setUid(null);
          setLoading(false);
          return;
        }
        setUid(user.uid);

        const uRef = doc(db, USERS_COLLECTION, user.uid);
        const uDoc = await getDoc(uRef);

        const nameFromAuth  = user.displayName ?? '';
        const photoFromAuth = user.photoURL ?? '';
        const name  = uDoc.exists() ? (uDoc.data().displayName ?? nameFromAuth) : nameFromAuth;
        const photo = uDoc.exists() ? (uDoc.data().photoURL ?? photoFromAuth) : photoFromAuth;

        setDisplayName(name || 'ผู้ใช้');
        setEditName(name || '');
        setPhotoURL(photo || '');
      } catch (err) {
        console.log('Profile load error:', err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  /** === Realtime listeners === */
  useEffect(() => {
    if (!uid) return;

    setMyLoading(true);

    const buckets = {
      s0: new Map(),
      s1: new Map(),
      s2: new Map(),
      s3: new Map(),
    };

    const mapDoc = (d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        title: data.title || 'ไม่มีชื่อสูตร',
        image:
          data.image ||
          data.imageUrl ||
          `https://placehold.co/400x260?text=${encodeURIComponent(data.title || 'Recipe')}`,
        ...data,
      };
    };

    const toSec = (v) => {
      if (!v) return 0;
      if (typeof v === 'number') return v;
      if (typeof v?.seconds === 'number') return v.seconds;
      const t = Date.parse(v);
      return Number.isNaN(t) ? 0 : Math.floor(t / 1000);
    };

    const recompute = () => {
      const union = new Map();
      for (const m of [buckets.s0, buckets.s1, buckets.s2, buckets.s3]) {
        m.forEach((val, key) => union.set(key, val));
      }
      const list = Array.from(union.values()).sort((a, b) => {
        const ta = toSec(a.createdAt);
        const tb = toSec(b.createdAt);
        if (tb !== ta) return tb - ta;
        return (a.title || '').localeCompare(b.title || '');
      });
      setMyRecipes(list);
      setMyLoading(false);
    };

    const q0 = query(collection(db, RECIPES_COLLECTION), where('uid', '==', uid), limit(200));
    const q1 = query(collection(db, RECIPES_COLLECTION), where('authorId', '==', uid), limit(200));
    const q2 = query(collection(db, RECIPES_COLLECTION), where('userId', '==', uid), limit(200));
    const q3 = query(collection(db, RECIPES_COLLECTION), where('author.uid', '==', uid), limit(200));

    const unsubMy0 = onSnapshot(
      q0,
      (snap) => {
        buckets.s0.clear();
        snap.forEach((d) => buckets.s0.set(d.id, mapDoc(d)));
        recompute();
      },
      (err) => console.log('My recipes (uid) error:', err)
    );
    const unsubMy1 = onSnapshot(
      q1,
      (snap) => {
        buckets.s1.clear();
        snap.forEach((d) => buckets.s1.set(d.id, mapDoc(d)));
        recompute();
      },
      (err) => console.log('My recipes (authorId) error:', err)
    );
    const unsubMy2 = onSnapshot(
      q2,
      (snap) => {
        buckets.s2.clear();
        snap.forEach((d) => buckets.s2.set(d.id, mapDoc(d)));
        recompute();
      },
      (err) => console.log('My recipes (userId) error:', err)
    );
    const unsubMy3 = onSnapshot(
      q3,
      (snap) => {
        buckets.s3.clear();
        snap.forEach((d) => buckets.s3.set(d.id, mapDoc(d)));
        recompute();
      },
      (err) => console.log('My recipes (author.uid) error:', err)
    );

    setFavLoading(true);
    let unsubFav;
    if (FAVORITES_MODE === 'SUBCOLLECTION') {
      const favCol = collection(db, USERS_COLLECTION, uid, FAVORITES_COLLECTION);
      unsubFav = onSnapshot(
        favCol,
        async (snap) => {
          const ids = [];
          snap.forEach((d) => {
            const rid = d.id || d.data()?.recipeId;
            if (rid) ids.push(rid);
          });
          await resolveFavoriteRecipes(ids);
        },
        (err) => {
          console.log('Favorites listener error:', err);
          setFavRecipes([]);
          setFavCount(0);
          setFavLoading(false);
        }
      );
    } else {
      const favQ = query(collection(db, FAVORITES_COLLECTION), where('userId', '==', uid), limit(500));
      unsubFav = onSnapshot(
        favQ,
        async (snap) => {
          const ids = [];
          snap.forEach((d) => {
            const rid = d.data()?.recipeId;
            if (rid) ids.push(rid);
          });
          await resolveFavoriteRecipes(ids);
        },
        (err) => {
          console.log('Favorites listener error:', err);
          setFavRecipes([]);
          setFavCount(0);
          setFavLoading(false);
        }
      );
    }

    return () => {
      unsubMy0 && unsubMy0();
      unsubMy1 && unsubMy1();
      unsubMy2 && unsubMy2();
      unsubMy3 && unsubMy3();
      unsubFav && unsubFav();
    };
  }, [uid]);

  const resolveFavoriteRecipes = useCallback(async (recipeIds) => {
    try {
      setFavCount(recipeIds.length);
      if (!recipeIds.length) {
        setFavRecipes([]);
        setFavLoading(false);
        return;
      }

      const chunk = (arr, size) => {
        const out = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      const chunks = chunk(recipeIds, 10);

      const results = [];
      for (const ids of chunks) {
        const qR = query(collection(db, RECIPES_COLLECTION), where('__name__', 'in', ids));
        const rsnap = await getDocs(qR);
        rsnap.forEach((docu) => results.push({ id: docu.id, ...docu.data() }));
      }

      const mapped = results.map((r) => ({
        id: r.id,
        title: r.title || 'ไม่มีชื่อสูตร',
        image:
          r.image ||
          r.imageUrl ||
          `https://placehold.co/400x260?text=${encodeURIComponent(r.title || 'Recipe')}`,
        ...r,
      }));
      mapped.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      setFavRecipes(mapped);
    } catch (err) {
      console.log('Resolve favorites error:', err);
      setFavRecipes([]);
    } finally {
      setFavLoading(false);
    }
  }, []);

  const pickImageAndUpload = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('ต้องอนุญาตการเข้าถึงรูปภาพ', 'กรุณาอนุญาตเพื่อเปลี่ยนรูปโปรไฟล์');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      const user = auth.currentUser;
      if (!user) return;

      setUploadingAvatar(true);

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const imageRef = ref(storage, `avatars/${user.uid}.jpg`);
      await uploadBytes(imageRef, blob);
      const url = await getDownloadURL(imageRef);

      await updateProfile(user, { photoURL: url });

      const uRef = doc(db, USERS_COLLECTION, user.uid);
      const uSnap = await getDoc(uRef);
      if (uSnap.exists()) {
        await updateDoc(uRef, { photoURL: url });
      } else {
        await setDoc(uRef, { photoURL: url }, { merge: true });
      }

      setPhotoURL(url);
      Alert.alert('สำเร็จ', 'อัปเดตรูปโปรไฟล์เรียบร้อย');
    } catch (e) {
      console.log('Avatar update error:', e);
      Alert.alert('เกิดข้อผิดพลาด', 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setUploadingAvatar(false);
    }
  }, [auth]);

  const saveDisplayName = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const name = (editName || '').trim();
      if (!name) {
        Alert.alert('กรุณาใส่ชื่อ', 'ชื่อแสดงผลต้องไม่ว่าง');
        return;
      }

      setSaving(true);

      await updateProfile(user, { displayName: name });

      const uRef = doc(db, USERS_COLLECTION, user.uid);
      const uSnap = await getDoc(uRef);
      if (uSnap.exists()) {
        await updateDoc(uRef, { displayName: name });
      } else {
        await setDoc(uRef, { displayName: name }, { merge: true });
      }

      setDisplayName(name);
      Alert.alert('สำเร็จ', 'บันทึกชื่อเรียบร้อย');
    } catch (err) {
      console.log('Save name error:', err);
      Alert.alert('เกิดข้อผิดพลาด', 'บันทึกชื่อไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }, [auth, editName]);

  /** ⚠️ แก้ไข Bug 3: Logout - ลด Alert เหลือครั้งเดียว */
  const handleLogout = useCallback(() => {
    Alert.alert('ยืนยันการออกจากระบบ', 'ต้องการออกจากระบบหรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ออกจากระบบ',
        style: 'destructive',
        onPress: async () => {
          try {
            // ตั้งค่า flag เพื่อป้องกัน Alert ซ้ำจาก onAuthStateChanged
            isLoggingOut.current = true;
            
            await signOut(auth);
            
            // แสดง Alert สำเร็จเพียงครั้งเดียว
            Alert.alert('ออกจากระบบสำเร็จ', '', [
              {
                text: 'ตกลง',
                onPress: () => {
                  isLoggingOut.current = false;
                  if (navigation?.reset) {
                    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                  } else {
                    navigation?.navigate?.('Login');
                  }
                }
              }
            ]);
          } catch (e) {
            console.error('Logout error:', e);
            isLoggingOut.current = false;
            Alert.alert('เกิดข้อผิดพลาด', e.message || 'ไม่สามารถออกจากระบบได้');
          }
        },
      },
    ]);
  }, [auth, navigation]);

  const getThaiStatus = (item) => {
    const raw =
      item?.approvalStatus ??
      item?.status ??
      item?.reviewStatus ??
      (item?.approved === true ? 'approved' : item?.approved === false ? 'rejected' : null) ??
      (item?.isApproved === true ? 'approved' : item?.isApproved === false ? 'rejected' : null) ??
      null;

    const s = String(raw || '').toLowerCase().trim();
    if (['approved', 'approve', 'passed', 'pass', 'ok', 'true', '1'].includes(s)) {
      return { type: 'approve', text: 'สถานะ: อนุมัติ' };
    }
    if (['rejected', 'reject', 'failed', 'fail', 'false', '0'].includes(s)) {
      return { type: 'reject', text: 'สถานะ: ปฏิเสธ' };
    }
    return null;
  };

  const RecipeCard = ({ item }) => {
    const status = getThaiStatus(item);

    return (
      <TouchableOpacity
        style={styles.recipeCard}
        onPress={() => navigation.navigate('UserRecipeDetail', { recipe: item })}
        activeOpacity={0.85}
      >
        <Image source={{ uri: item.image }} style={styles.recipeImage} />
        <View style={{ flex: 1 }}>
          <Text style={styles.recipeTitle} numberOfLines={1}>{item.title}</Text>

          {!!item.duration && (
            <Text style={styles.recipeMeta} numberOfLines={1}>เวลา: {item.duration} นาที</Text>
          )}

          {!!status && (
            <Text
              style={[
                styles.recipeStatus,
                status.type === 'approve' ? styles.statusApprove : styles.statusReject,
              ]}
              numberOfLines={1}
            >
              {status.text}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#333" />
      </TouchableOpacity>
    );
  };

  const renderTabContent = () => {
    if (activeTab === 'MyRecipes') {
      if (myLoading) {
        return (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#6a994e" />
            <Text style={styles.dimText}>กำลังโหลดสูตรของฉัน…</Text>
          </View>
        );
      }
      if (!myRecipes.length) {
        return (
          <View style={styles.centerBox}>
            <Ionicons name="egg-outline" size={48} color="#9CA3AF" />
            <Text style={styles.dimText}>ยังไม่มีสูตรของฉัน</Text>
            <TouchableOpacity 
              style={styles.addRecipeButton}
              onPress={() => navigation.navigate('AddEditRecipe')}
            >
              <Text style={styles.addRecipeButtonText}>เพิ่มสูตรแรก</Text>
            </TouchableOpacity>
          </View>
        );
      }
      return myRecipes.map((r) => <RecipeCard key={r.id} item={r} />);
    }

    if (activeTab === 'SavedRecipes') {
      if (favLoading) {
        return (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#6a994e" />
            <Text style={styles.dimText}>กำลังโหลดสูตรที่บันทึก…</Text>
          </View>
        );
      }
      if (!favRecipes.length) {
        return (
          <View style={styles.centerBox}>
            <Ionicons name="bookmarks-outline" size={48} color="#9CA3AF" />
            <Text style={styles.dimText}>ยังไม่มีสูตรที่บันทึกไว้</Text>
            <TouchableOpacity 
              style={styles.addRecipeButton}
              onPress={() => navigation.navigate('SavedRecipes')}
            >
              <Text style={styles.addRecipeButtonText}>ดูสูตรอาหารทั้งหมด</Text>
            </TouchableOpacity>
          </View>
        );
      }
      return favRecipes.map((r) => <RecipeCard key={r.id} item={r} />);
    }

    return null;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeContainer}>
        <View style={[styles.center, { backgroundColor: '#F8FAFC' }]}>
          <ActivityIndicator size="large" color="#6a994e" />
          <Text style={styles.dimText}>กำลังโหลด…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.screen}>
        <View style={styles.topSection}>
          <View style={styles.topHeader}>
            <View style={styles.topHeaderLeft}>
              <View style={styles.avatarWrap}>
                {photoURL ? (
                  <Image source={{ uri: photoURL }} style={styles.headerAvatar} />
                ) : (
                  <View style={[styles.headerAvatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person-circle-outline" size={48} color="#9CA3AF" />
                  </View>
                )}
                <TouchableOpacity
                  onPress={pickImageAndUpload}
                  style={styles.cameraBadge}
                  activeOpacity={0.8}
                >
                  {uploadingAvatar
                    ? <ActivityIndicator size="small" color="#111827" />
                    : <Ionicons name="camera-outline" size={16} color="#111827" />
                  }
                </TouchableOpacity>
              </View>

              <View>
                <Text style={styles.headerTitle}>โปรไฟล์</Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>{displayName || 'ผู้ใช้'}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={handleLogout} style={styles.iconBtn} activeOpacity={0.85}>
              <Ionicons name="log-out-outline" size={20} color="#111827" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileCard}>
            <Ionicons name="create-outline" size={18} style={{ opacity: 0.7 }} />
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="เปลี่ยนชื่อแสดงผล"
              style={styles.nameInput}
              maxLength={32}
            />
            <TouchableOpacity onPress={saveDisplayName} style={styles.saveBtn} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>บันทึก</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.orderBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('OrderHistoryScreen')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={styles.orderIconWrap}>
                <Ionicons name="receipt-outline" size={18} color="#111827" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderTitle}>ประวัติการสั่งซื้อ</Text>
                <Text style={styles.orderSubtitle} numberOfLines={1}>
                  ดูคำสั่งซื้อที่ผ่านมาและสถานะล่าสุด
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <ScrollView style={styles.bottomSection} contentContainerStyle={styles.bottomContent}>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'MyRecipes' && styles.activeTab]}
              onPress={() => setActiveTab('MyRecipes')}
            >
              <Ionicons name="document-text-outline" size={16} style={styles.tabIcon} />
              <Text style={[styles.tabText, activeTab === 'MyRecipes' && styles.activeTabText]}>
                สูตรของฉัน ({myRecipes.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'SavedRecipes' && styles.activeTab]}
              onPress={() => setActiveTab('SavedRecipes')}
            >
              <Ionicons name="bookmark-outline" size={16} style={styles.tabIcon} />
              <Text style={[styles.tabText, activeTab === 'SavedRecipes' && styles.activeTabText]}>
                สูตรที่บันทึกไว้ ({favCount})
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 10 }}>
            {renderTabContent()}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#fefae0',
  },
  screen: {
    flex: 1,
    backgroundColor: '#fefae0',
  },
  topSection: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: '#d8dd8cff',
  },
  topHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  topHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap: { position: 'relative' },
  headerAvatar: { width: 64, height: 64, borderRadius: 999, backgroundColor: '#eef2f7' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cameraBadge: {
    position: 'absolute',
    right: -2, bottom: -2,
    backgroundColor: '#FFD54A',
    borderRadius: 999,
    padding: 6,
    borderWidth: 1,
    borderColor: '#FDF1B6',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2,
  },
  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    gap: 8, marginTop: 6,
    elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  nameInput: { flex: 1, fontSize: 14, paddingVertical: 6 },
  saveBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#111827',
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  orderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  orderIconWrap: {
    width: 28, height: 28, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFD54A',
    borderWidth: 1, borderColor: '#FDF1B6',
  },
  orderTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  orderSubtitle: { fontSize: 12, color: '#6B7280' },
  divider: { height: 1, backgroundColor: '#E5E7EB' },
  bottomSection: { flex: 1 },
  bottomContent: { padding: 18, paddingBottom: 28 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E5E7EB', borderRadius: 999, paddingVertical: 10, gap: 6,
  },
  tabIcon: { opacity: 0.9 },
  activeTab: { backgroundColor: '#FFD54A' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  activeTabText: { color: '#111827' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 6 },
  dimText: { color: '#6B7280', marginTop: 4, textAlign: 'center' },
  addRecipeButton: {
    backgroundColor: '#6a994e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 10,
  },
  addRecipeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  recipeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 12,
    padding: 12, marginBottom: 12,
    elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  recipeImage: { width: 76, height: 76, borderRadius: 10, backgroundColor: '#eef2f7' },
  recipeTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  recipeMeta: { marginTop: 2, color: '#6B7280', fontSize: 12 },
  recipeStatus: { marginTop: 2, fontSize: 12, fontWeight: '700' },
  statusApprove: { color: '#2E7D32' },
  statusReject:  { color: '#C62828' },
});