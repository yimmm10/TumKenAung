// screens/User/FridgeScreen.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Image, ScrollView, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { db, storage } from '../../firebaseconfig';
import { doc, collection, deleteDoc, onSnapshot, getDocs } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const categories = ['ทั้งหมด', 'ผัก', 'เนื้อสัตว์', 'ผลไม้', 'ของแปรรูป', 'ไข่', 'นม', 'อาหารแช่แข็ง'];

export default function FridgeScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const [userId, setUserId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');

  const [groupId, setGroupId] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState('member');
  const [hostId, setHostId] = useState(null);

  const [ingredients, setIngredients] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);

  // === unsubscribe refs ===
  const unsubAuthRef = useRef(null);
  const unsubUserDocRef = useRef(null);
  const unsubOwnIngredientsRef = useRef(null);
  const unsubMembersRef = useRef(null);

  // กลุ่ม: ฟังวัตถุดิบรายสมาชิก + วัตถุดิบกลางของกลุ่ม
  const unsubMemberIngredientsRefs = useRef({});    // { [memberUid]: () => void }
  const memberItemsRef = useRef({});                // { [memberUid]: Item[] }
  const unsubGroupIngredientsRef = useRef(null);
  const groupItemsRef = useRef([]);                 // Item[] จาก groups/{gid}/groupIngredient

  // เก็บ members ล่าสุดสำหรับ listener ของ groupIngredient
  const groupMembersRef = useRef([]);
  useEffect(() => { groupMembersRef.current = groupMembers; }, [groupMembers]);

  const stopAllGroupListeners = useCallback(() => {
    // ยกเลิกฟังสมาชิก
    if (unsubMembersRef.current) {
      try { unsubMembersRef.current(); } catch {}
      unsubMembersRef.current = null;
    }
    // ยกเลิกฟังวัตถุดิบรายสมาชิก
    Object.values(unsubMemberIngredientsRefs.current || {}).forEach(unsub => {
      try { unsub && unsub(); } catch {}
    });
    unsubMemberIngredientsRefs.current = {};
    memberItemsRef.current = {};
    // ยกเลิกฟังวัตถุดิบกลางของกลุ่ม
    if (unsubGroupIngredientsRef.current) {
      try { unsubGroupIngredientsRef.current(); } catch {}
      unsubGroupIngredientsRef.current = null;
    }
    groupItemsRef.current = [];
  }, []);

  const startOwnIngredientsListener = useCallback((uid) => {
    // โหมดเดี่ยว: ฟังเฉพาะตู้ของตัวเอง
    if (unsubOwnIngredientsRef.current) {
      try { unsubOwnIngredientsRef.current(); } catch {}
      unsubOwnIngredientsRef.current = null;
    }
    const colRef = collection(db, 'users', uid, 'userIngredient');
    unsubOwnIngredientsRef.current = onSnapshot(colRef, (snap) => {
      const mine = snap.docs.map(d => ({ id: d.id, ownerId: uid, addedBy: uid, ...d.data() }));
      setIngredients(mine);
    }, (e) => console.error('own ingredients listener error:', e));
  }, []);

  // รวมวัตถุดิบทุกแหล่ง (Host ก่อน → วัตถุดิบกลางของกลุ่ม → สมาชิกคนอื่น)
  const recomputeGroupCombined = useCallback((hostUid) => {
    const allByMember = memberItemsRef.current || {};
    const allMemberIds = Object.keys(allByMember);
    const hostItems = hostUid ? (allByMember[hostUid] || []) : [];
    const others = allMemberIds
      .filter(uid => uid !== hostUid)
      .sort()
      .flatMap(uid => allByMember[uid] || []);
    const groupItems = groupItemsRef.current || [];
    setIngredients([...hostItems, ...groupItems, ...others]);
  }, []);

  // ดึงข้อมูลรอบเดียวเพื่อไม่ให้จอว่างตอนเข้าโหมดกลุ่มครั้งแรก
  const seedGroupStateOnce = useCallback(async (gid) => {
    try {
      // 1) สมาชิกกลุ่ม
      const memSnap = await getDocs(collection(db, 'groups', gid, 'members'));
      const members = memSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setGroupMembers(members);
      groupMembersRef.current = members;

      // 2) วัตถุดิบของสมาชิกแต่ละคน
      const memberIngsSnaps = await Promise.all(
        members.map(m => getDocs(collection(db, 'users', m.id, 'userIngredient')))
      );
      memberItemsRef.current = {};
      memberIngsSnaps.forEach((s, idx) => {
        const mid = members[idx].id;
        memberItemsRef.current[mid] = s.docs.map(d => ({
          id: d.id,
          ownerId: mid,
          addedBy: d.data().addedBy || mid,
          ...d.data()
        }));
      });

      // 3) วัตถุดิบกลางของกลุ่ม (ถ้ามี)
      const gIngSnap = await getDocs(collection(db, 'groups', gid, 'groupIngredient'));
      groupItemsRef.current = gIngSnap.docs.map(d => ({
        id: d.id,
        ownerId: d.data().ownerId || d.data().addedBy || 'GROUP',
        addedBy: d.data().addedBy || 'unknown',
        targetGroupId: gid,
        ...d.data(),
      }));

      // 4) จัดลำดับ Host → กลุ่ม → สมาชิกอื่น
      const hostUid = members.find(m => m.role === 'host')?.id || null;
      recomputeGroupCombined(hostUid);
    } catch (e) {
      console.warn('seedGroupStateOnce error:', e?.message || e);
    }
  }, [recomputeGroupCombined]);

  const startGroupFridgeListener = useCallback((gid, uid) => {
    // เริ่มโหมดกลุ่มใหม่: เคลียร์ listener เดิมทั้งหมดก่อน
    stopAllGroupListeners();

    // ดึงข้อมูลรอบเดียวให้จอไม่ว่าง (ไม่ต้องรอ onSnapshot)
    seedGroupStateOnce(gid);

    // 1) ฟัง "รายชื่อสมาชิก" เหมือน InviteScreen
    const memRef = collection(db, 'groups', gid, 'members');
    unsubMembersRef.current = onSnapshot(memRef, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })); // id = uid
      setGroupMembers(list);
      groupMembersRef.current = list;

      const me = list.find(m => m.id === uid);
      setCurrentUserRole(me?.role === 'host' ? 'host' : 'member');

      const host = list.find(m => m.role === 'host');
      const newHostId = host ? host.id : null;
      setHostId(newHostId);

      // ล้าง listener ของคนที่ออกจากกลุ่ม
      const currentMemberUids = new Set(list.map(m => m.id));
      Object.keys(unsubMemberIngredientsRefs.current).forEach(memberUid => {
        if (!currentMemberUids.has(memberUid)) {
          try { unsubMemberIngredientsRefs.current[memberUid]?.(); } catch {}
          delete unsubMemberIngredientsRefs.current[memberUid];
          delete memberItemsRef.current[memberUid];
        }
      });

      // เพิ่ม listener ให้สมาชิกที่ยังไม่ได้ฟัง
      list.forEach(member => {
        const memberUid = member.id;
        if (!unsubMemberIngredientsRefs.current[memberUid]) {
          const ingRef = collection(db, 'users', memberUid, 'userIngredient');
          const unsub = onSnapshot(ingRef, (s) => {
            const items = s.docs.map(d => ({
              id: d.id,
              ownerId: memberUid,
              addedBy: d.data().addedBy || memberUid,
              ...d.data()
            }));
            memberItemsRef.current[memberUid] = items;
            recomputeGroupCombined(newHostId);
          }, (err) => console.error(`ingredients listener error (${memberUid}):`, err));

          unsubMemberIngredientsRefs.current[memberUid] = unsub;
        }
      });

      // คำนวณครั้งแรก/ทุกครั้งที่รายชื่อเปลี่ยน
      recomputeGroupCombined(newHostId);
    }, (err) => console.error('members listener error:', err));

    // 2) ค่อยฟัง "วัตถุดิบกลางของกลุ่ม"
    const gIngRef = collection(db, 'groups', gid, 'groupIngredient');
    unsubGroupIngredientsRef.current = onSnapshot(gIngRef, (s) => {
      const items = s.docs.map(d => ({
        id: d.id,
        ownerId: d.data().ownerId || d.data().addedBy || 'GROUP',
        addedBy: d.data().addedBy || 'unknown',
        targetGroupId: gid,
        ...d.data(),
      }));
      groupItemsRef.current = items;
      const currentHost = groupMembersRef.current?.find?.(m => m.role === 'host')?.id || null;
      recomputeGroupCombined(currentHost);
    }, (err) => console.error('group ingredients listener error:', err));
  }, [recomputeGroupCombined, stopAllGroupListeners, seedGroupStateOnce]);

  const switchToSolo = useCallback((uid) => {
    setGroupId(null);
    setGroupMembers([]);
    setHostId(null);
    setCurrentUserRole('member');
    stopAllGroupListeners();
    startOwnIngredientsListener(uid);
  }, [startOwnIngredientsListener, stopAllGroupListeners]);

  const switchToGroup = useCallback((gid, uid) => {
    setGroupId(gid);
    setGroupMembers([]);
    setIngredients([]);
    setHostId(null);
    if (unsubOwnIngredientsRef.current) {
      try { unsubOwnIngredientsRef.current(); } catch {}
      unsubOwnIngredientsRef.current = null;
    }
    startGroupFridgeListener(gid, uid);
  }, [startGroupFridgeListener]);

  const forceSwitchToSolo = useCallback(() => {
    if (!userId) return;
    switchToSolo(userId);
  }, [switchToSolo, userId]);

  useEffect(() => {
    const auth = getAuth();
    unsubAuthRef.current = onAuthStateChanged(auth, (user) => {
      if (!user) {
        Alert.alert('ไม่พบผู้ใช้งาน', 'กรุณาเข้าสู่ระบบใหม่');
        navigation.navigate('Login');
        return;
      }
      setUserId(user.uid);

      if (unsubUserDocRef.current) {
        try { unsubUserDocRef.current(); } catch {}
        unsubUserDocRef.current = null;
      }
      const uref = doc(db, 'users', user.uid);
      unsubUserDocRef.current = onSnapshot(uref, (snap) => {
        const gid = snap?.data()?.groupId || null;
        if (gid) {
          if (gid !== groupId) switchToGroup(gid, user.uid);
        } else {
          if (groupId !== null) switchToSolo(user.uid);
          if (!unsubOwnIngredientsRef.current) startOwnIngredientsListener(user.uid);
        }
      }, (e) => console.error('user doc listener error:', e));
    });

    return () => {
      try { unsubAuthRef.current && unsubAuthRef.current(); } catch {}
      try { unsubUserDocRef.current && unsubUserDocRef.current(); } catch {}
      try { unsubOwnIngredientsRef.current && unsubOwnIngredientsRef.current(); } catch {}
      stopAllGroupListeners();
    };
  }, [navigation, groupId, startOwnIngredientsListener, switchToGroup, switchToSolo, stopAllGroupListeners]);

  // รับพารามิเตอร์จากหน้า Invite เพื่อ "บังคับ" กลับโหมดเดี่ยวทันที
  useEffect(() => {
    if (route?.params?.mode === 'solo') {
      forceSwitchToSolo();
    }
  }, [route?.params?.mode, forceSwitchToSolo]);

  const handleDelete = async (id, ownerId) => {
    try {
      if (groupId) {
        // ตอนนี้ group = รวม (ตู้ของสมาชิก) + (ตู้กลางของกลุ่ม)
        const item = ingredients.find(it => it.id === id && (it.ownerId === ownerId || it.targetGroupId === groupId))
                  || ingredients.find(it => it.id === id);
        if (!item) {
          Alert.alert('ไม่พบรายการ', 'ไม่พบวัตถุดิบที่ต้องการลบ');
          return;
        }

        const canDelete = (currentUserRole === 'host') || (item.addedBy === userId);
        if (!canDelete) {
          Alert.alert('ไม่มีสิทธิ์', 'คุณสามารถลบได้เฉพาะรายการที่คุณเพิ่มเองหรือหากคุณเป็นเจ้าของกลุ่ม');
          return;
        }

        const whereText = item.targetGroupId ? 'ตู้กลางของกลุ่ม' : (item.ownerId === userId ? 'ตู้ของคุณ' : 'ตู้ของสมาชิก');
        Alert.alert(
          'ยืนยันการลบ',
          `คุณต้องการลบ "${item.name}" ออกจาก${whereText} ใช่หรือไม่?`,
          [
            { text: 'ยกเลิก', style: 'cancel' },
            {
              text: 'ลบ',
              style: 'destructive',
              onPress: async () => {
                try {
                  if (item?.imagePath) {
                    try { await deleteObject(ref(storage, item.imagePath)); } catch (e) {
                      console.warn('ลบรูปไม่ได้/ไม่มีอยู่:', e?.code || e?.message);
                    }
                  }
                  if (item.targetGroupId) {
                    // อยู่ใน groups/{gid}/groupIngredient
                    await deleteDoc(doc(db, 'groups', groupId, 'groupIngredient', item.id));
                  } else {
                    // อยู่ใน users/{ownerId}/userIngredient
                    await deleteDoc(doc(db, 'users', item.ownerId, 'userIngredient', item.id));
                  }
                  Alert.alert('สำเร็จ', 'ลบวัตถุดิบเรียบร้อยแล้ว');
                } catch (err) {
                  console.error('ลบไม่สำเร็จ:', err);
                  Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถลบวัตถุดิบได้');
                }
              }
            }
          ]
        );
      } else {
        // โหมดเดี่ยว
        const itemToDelete = ingredients.find(it => it.id === id);
        if (!itemToDelete) {
          Alert.alert('ไม่พบรายการ', 'ไม่พบวัตถุดิบที่ต้องการลบ');
          return;
        }
        Alert.alert(
          'ยืนยันการลบ',
          `คุณต้องการลบ "${itemToDelete.name}" ใช่หรือไม่?`,
          [
            { text: 'ยกเลิก', style: 'cancel' },
            {
              text: 'ลบ',
              style: 'destructive',
              onPress: async () => {
                try {
                  if (itemToDelete?.imagePath) {
                    try { await deleteObject(ref(storage, itemToDelete.imagePath)); } catch (e) {
                      console.warn('ลบรูปไม่ได้/ไม่มีอยู่:', e?.code || e?.message);
                    }
                  }
                  await deleteDoc(doc(db, 'users', userId, 'userIngredient', id));
                  Alert.alert('สำเร็จ', 'ลบวัตถุดิบเรียบร้อยแล้ว');
                } catch (err) {
                  console.error('ลบไม่สำเร็จ:', err);
                  Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถลบวัตถุดิบได้');
                }
              }
            }
          ]
        );
      }
    } catch (e) {
      console.error('handleDelete error:', e);
      Alert.alert('เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการลบ');
    }
  };

  const filtered = ingredients.filter(item => {
    const nameMatch = (item?.name || '').toLowerCase().includes(searchText.toLowerCase());
    const categoryMatch = selectedCategory === 'ทั้งหมด' || item?.category === selectedCategory;
    return nameMatch && categoryMatch;
  });

  const getItemInfo = (item) => {
    if (!groupId) return 'คุณ';
    if (item.targetGroupId) {
      const addedByMember = groupMembers.find(m => m.id === item.addedBy);
      const addedByName = item.addedBy === userId
        ? 'คุณ'
        : (addedByMember?.name || addedByMember?.displayName || item.addedBy || 'ไม่ทราบชื่อ');
      return `รายการกลุ่ม • เพิ่มโดย: ${addedByName}`;
    }
    const addedByMember = groupMembers.find(m => m.id === item.addedBy);
    const addedByName = item.addedBy === userId
      ? 'คุณ'
      : (addedByMember?.name || addedByMember?.displayName || item.addedBy || 'ไม่ทราบชื่อ');
    return `เพิ่มโดย: ${addedByName}`;
  };

  const canEditItem = (item) => {
    if (!groupId) return true;
    return (currentUserRole === 'host') || (item.addedBy === userId);
  };

  const canDeleteItem = (item) => {
    if (!groupId) return true;
    return (currentUserRole === 'host') || (item.addedBy === userId);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => {
        if (canEditItem(item)) {
          // กลุ่ม:
          // - ถ้าเป็นรายการ "กลุ่ม" ให้ส่ง targetGroupId เพื่อแก้ใน groups/{gid}/groupIngredient
          // - ถ้าเป็นรายการ "ของสมาชิก" ให้ส่ง targetUserId = ownerId เพื่อแก้ในตู้ของเจ้าของ
          const editParams = groupId
            ? (item.targetGroupId
                ? { item: { ...item, targetGroupId: groupId } }
                : { item: { ...item, targetUserId: item.ownerId } })
            : { item };
          navigation.navigate('AddEditIngredient', editParams);
        } else {
          Alert.alert('ไม่สามารถแก้ไขได้', 'คุณสามารถแก้ไขได้เฉพาะรายการที่คุณเพิ่มเองหรือหากคุณเป็นเจ้าของกลุ่ม');
        }
      }}
      style={[
        styles.itemRow,
        canEditItem(item) ? styles.editableItem : styles.readOnlyItem
      ]}
    >
      <Image
        source={item.image ? { uri: item.image } : require('../../assets/images/placeholder.png')}
        style={styles.itemImage}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.detailText}>ปริมาณ: {item.quantity}</Text>
        <Text style={styles.detailText}>ผลิต: {item.production || '-'}</Text>
        <Text style={styles.detailText}>หมดอายุ: {item.expiry || '-'}</Text>
        {groupId && (
          <Text style={styles.addedByText}>{getItemInfo(item)}</Text>
        )}
      </View>

      <View style={styles.actionContainer}>
        {!canEditItem(item) && (
          <View style={styles.readOnlyBadge}>
            <Ionicons name="lock-closed" size={14} color="#999" />
          </View>
        )}
        {canDeleteItem(item) && (
          <TouchableOpacity onPress={() => handleDelete(item.id, item.ownerId)}>
            <MaterialIcons name="delete" size={24} color="#d62828" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons
              name={groupId ? "people" : "person"}
              size={24}
              color="#6a994e"
              style={{ marginRight: 8 }}
            />
            <View>
              <Text style={styles.title}>
                {groupId ? 'ตู้เย็นกลุ่ม' : 'ตู้เย็นของฉัน'}
              </Text>
              {groupId && (
                <Text style={styles.subtitle}>
                  {currentUserRole === 'host' ?
                    `ตู้เย็นของคุณ • สมาชิก ${groupMembers.length} คน` :
                    `ตู้เย็นแชร์ • สมาชิก ${groupMembers.length} คน`
                  }
                </Text>
              )}
            </View>
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={() => navigation.navigate('InviteScreen')}
              style={[styles.iconButton, styles.groupButton]}
            >
              <Ionicons name="people" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                // เพิ่มวัตถุดิบ:
                // - โหมดกลุ่ม: ใส่ targetGroupId เพื่อเพิ่มลง groups/{gid}/groupIngredient
                // - โหมดเดี่ยว: ไม่ต้องส่งอะไร
                const addParams = groupId
                  ? { targetGroupId: groupId, addedBy: userId }
                  : {};
                navigation.navigate('AddEditIngredient', addParams);
              }}
              style={[styles.iconButton, styles.addButton]}
            >
              <Ionicons name="add-circle" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          placeholder="ค้นหาวัตถุดิบ..."
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
        />

        <View style={styles.categoryScrollContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[
                  styles.categoryPill,
                  selectedCategory === cat && styles.categoryPillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === cat && styles.categoryTextSelected,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item, idx) => `${item.targetGroupId ? 'G' : (item.ownerId || 'X')}_${item.id}_${idx}`}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>
                {groupId ? 'ไม่มีวัตถุดิบในตู้เย็นกลุ่ม' : 'ไม่พบวัตถุดิบ'}
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => {
                  const addParams = groupId
                    ? { targetGroupId: groupId, addedBy: userId }
                    : {};
                  navigation.navigate('AddEditIngredient', addParams);
                }}
              >
                <Text style={styles.emptyButtonText}>เพิ่มวัตถุดิบแรก</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#fefae0' },
  container: { flex: 1, backgroundColor: '#fefae0', padding: 16 },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
    backgroundColor: 'white', padding: 16, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#3a3a3a' },
  subtitle: { fontSize: 12, color: '#6a994e', fontWeight: '500', marginTop: 2 },
  buttonContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  groupButton: { backgroundColor: '#6a994e' },
  addButton: { backgroundColor: '#f4a261' },
  searchInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 12, marginBottom: 16, backgroundColor: '#fff',
    fontSize: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  categoryScrollContainer: { marginBottom: 16 },
  categoryPill: {
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#ddd', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, marginRight: 10, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  categoryPillSelected: { backgroundColor: '#f4a261', borderColor: '#f4a261', shadowOpacity: 0.15 },
  categoryText: { color: '#555', fontSize: 14, fontWeight: '500' },
  categoryTextSelected: { color: '#fff', fontWeight: 'bold' },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: '#fff',
    padding: 12, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4, elevation: 2,
  },
  editableItem: { borderLeftWidth: 4, borderLeftColor: '#6a994e' },
  readOnlyItem: { borderLeftWidth: 4, borderLeftColor: '#ccc', opacity: 0.8 },
  itemImage: {
    width: 60, height: 60, marginRight: 12, borderRadius: 8, resizeMode: 'cover', backgroundColor: '#f0f0f0'
  },
  itemName: { fontWeight: 'bold', fontSize: 16, marginBottom: 4, color: '#333' },
  detailText: { fontSize: 13, color: '#666', marginBottom: 2 },
  addedByText: { fontSize: 12, color: '#f4a261', fontWeight: 'bold', marginTop: 4 },
  actionContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  readOnlyBadge: { padding: 4 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { textAlign: 'center', color: '#999', fontSize: 16, marginTop: 16, marginBottom: 20 },
  emptyButton: { backgroundColor: '#6a994e', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  emptyButtonText: { color: 'white', fontWeight: 'bold' },
});
