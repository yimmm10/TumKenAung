// screens/User/FridgeScreen.js
import React, { useLayoutEffect,useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Image, ScrollView, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { db, storage } from '../../firebaseconfig';
import { doc, collection, deleteDoc, onSnapshot } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const categories = ['ทั้งหมด', 'ผัก', 'เนื้อสัตว์', 'ผลไม้', 'ของแปรรูป', 'ไข่', 'นม', 'อาหารแช่แข็ง'];

export default function FridgeScreen() {
  const navigation = useNavigation();
  const auth = getAuth();

  const [userId, setUserId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');

  const [groupId, setGroupId] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState('member');
  const [hostId, setHostId] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  
  const [ingredients, setIngredients] = useState([]);

  // Refs สำหรับ cleanup
  const unsubscribers = useRef({
    auth: null,
    userDoc: null,
    members: null,
    ingredients: {} // { userId: unsubscribe }
  });

  // ฟังก์ชันปิด listeners ทั้งหมด
  const cleanupAllListeners = () => {
    console.log('🧹 Cleaning up all listeners');
    
    // ปิด members listener
    if (unsubscribers.current.members) {
      unsubscribers.current.members();
      unsubscribers.current.members = null;
    }

    // ปิด ingredients listeners ทั้งหมด
    Object.keys(unsubscribers.current.ingredients).forEach(memberId => {
      if (unsubscribers.current.ingredients[memberId]) {
        unsubscribers.current.ingredients[memberId]();
      }
    });
    unsubscribers.current.ingredients = {};
    
    console.log('✅ All listeners cleaned');
  };

  // ฟังก์ชันเริ่ม listeners ของกลุ่ม
  const startGroupListeners = (gid, uid) => {
    console.log('👥 Starting GROUP mode for:', gid);
    
    // ล้าง listeners เก่าทั้งหมดก่อน
    cleanupAllListeners();
    
    // ล้าง state ทันที
    setIngredients([]); // ล้างวัตถุดิบเก่าออกทันที

    const membersData = {};
    const ingredientsData = {};

    // ฟังรายชื่อสมาชิก
    const membersRef = collection(db, 'groups', gid, 'members');
    unsubscribers.current.members = onSnapshot(membersRef, (snapshot) => {
      console.log('👤 Members updated:', snapshot.docs.length);
      const members = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setGroupMembers(members);

      // หา role และ host
      const currentMember = members.find(m => m.id === uid);
      setCurrentUserRole(currentMember?.role || 'member');

      const host = members.find(m => m.role === 'host');
      setHostId(host?.id || null);

      // จัดการ ingredients listeners
      const currentMemberIds = new Set(members.map(m => m.id));
      
      // ลบ listener ของคนที่ออกจากกลุ่ม
      Object.keys(unsubscribers.current.ingredients).forEach(memberId => {
        if (!currentMemberIds.has(memberId)) {
          if (unsubscribers.current.ingredients[memberId]) {
            unsubscribers.current.ingredients[memberId]();
          }
          delete unsubscribers.current.ingredients[memberId];
          delete ingredientsData[memberId];
        }
      });

      // เพิ่ม listener สำหรับสมาชิกใหม่
      members.forEach(member => {
        const memberId = member.id;
        
        if (!unsubscribers.current.ingredients[memberId]) {
          const ingredientsRef = collection(db, 'users', memberId, 'userIngredient');
          
          unsubscribers.current.ingredients[memberId] = onSnapshot(ingredientsRef, (ingSnapshot) => {
            const items = ingSnapshot.docs.map(doc => ({
              id: doc.id,
              ownerId: memberId,
              addedBy: doc.data().addedBy || memberId,
              ...doc.data()
            }));

            ingredientsData[memberId] = items;
            updateCombinedIngredients(ingredientsData, host?.id);
          }, (error) => {
            console.error(`Ingredients listener error for ${memberId}:`, error);
          });
        }
      });

      // อัพเดทครั้งแรก
      updateCombinedIngredients(ingredientsData, host?.id);
    }, (error) => {
      console.error('Members listener error:', error);
    });

    // ฟังก์ชันรวมวัตถุดิบทั้งหมด
    function updateCombinedIngredients(data, hostId) {
      const allItems = [];
      
      // 1. วัตถุดิบของ Host (ถ้ามี)
      if (hostId && data[hostId]) {
        allItems.push(...data[hostId]);
      }

      // 2. วัตถุดิบของสมาชิกคนอื่น
      Object.keys(data).forEach(memberId => {
        if (memberId !== hostId) {
          allItems.push(...data[memberId]);
        }
      });

      console.log('📦 Group ingredients updated:', allItems.length);
      setIngredients(allItems);
    }
  };

  // ฟังก์ชันเริ่ม listener โหมดเดี่ยว
  const startSoloListener = (uid) => {
    console.log('🔄 Starting SOLO mode for:', uid);
    
    // ล้าง listeners เก่าทั้งหมดก่อน
    cleanupAllListeners();
    
    // ล้าง state ทันที
    setGroupMembers([]);
    setHostId(null);
    setCurrentUserRole('member');
    setIngredients([]); // ล้างวัตถุดิบเก่าออกทันที

    // เริ่ม listener ใหม่สำหรับตู้ของตัวเอง
    const ingredientsRef = collection(db, 'users', uid, 'userIngredient');
    unsubscribers.current.ingredients[uid] = onSnapshot(ingredientsRef, (snapshot) => {
      console.log('📦 Solo ingredients updated:', snapshot.docs.length);
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ownerId: uid,
        addedBy: uid,
        ...doc.data()
      }));
      setIngredients(items);
    }, (error) => {
      console.error('Solo listener error:', error);
    });
  };

  // Effect หลัก: ฟังการเปลี่ยนแปลงของ user
  useEffect(() => {
    unsubscribers.current.auth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        Alert.alert('ไม่พบผู้ใช้งาน', 'กรุณาเข้าสู่ระบบใหม่');
        navigation.navigate('Login');
        return;
      }

      const uid = user.uid;
      setUserId(uid);

      // ปิด listener เก่า (ถ้ามี)
      if (unsubscribers.current.userDoc) {
        unsubscribers.current.userDoc();
      }

      // ฟังการเปลี่ยนแปลงของ groupId
      const userDocRef = doc(db, 'users', uid);
      unsubscribers.current.userDoc = onSnapshot(userDocRef, (snapshot) => {
        const userData = snapshot.data();
        const userGroupId = userData?.groupId || null;

        console.log('📋 User groupId changed:', userGroupId);

        if (userGroupId) {
          // อยู่ในกลุ่ม
          if (userGroupId !== groupId) {
            console.log('➡️ Switching to group mode');
            setGroupId(userGroupId);
            setIngredients([]); // ล้างก่อนเริ่มใหม่
            
            // ใช้ setTimeout เพื่อให้แน่ใจว่า state ถูกล้างก่อน
            setTimeout(() => {
              startGroupListeners(userGroupId, uid);
            }, 50);
          }
        } else {
          // ไม่ได้อยู่ในกลุ่ม
          console.log('➡️ Switching to solo mode');
          setGroupId(null);
          setIngredients([]); // ล้างก่อนเริ่มใหม่
          
          // ใช้ setTimeout เพื่อให้แน่ใจว่า listeners เก่าถูกปิดและ state ถูกล้างก่อน
          setTimeout(() => {
            startSoloListener(uid);
          }, 50);
        }
      }, (error) => {
        console.error('User doc listener error:', error);
      });
    });

    // Cleanup เมื่อ unmount
    return () => {
      if (unsubscribers.current.auth) {
        unsubscribers.current.auth();
      }
      if (unsubscribers.current.userDoc) {
        unsubscribers.current.userDoc();
      }
      cleanupAllListeners();
    };
  }, [groupId]);

  const handleDelete = async (id, ownerId) => {
    try {
      const item = ingredients.find(it => it.id === id);
      if (!item) {
        Alert.alert('ไม่พบรายการ', 'ไม่พบวัตถุดิบที่ต้องการลบ');
        return;
      }

      if (groupId) {
        const canDelete = (currentUserRole === 'host') || (item.addedBy === userId);
        if (!canDelete) {
          Alert.alert('ไม่มีสิทธิ์', 'คุณสามารถลบได้เฉพาะรายการที่คุณเพิ่มเอง หรือหากคุณเป็นเจ้าของกลุ่ม');
          return;
        }
      }

      Alert.alert(
        'ยืนยันการลบ',
        `คุณต้องการลบ "${item.name}" ใช่หรือไม่?`,
        [
          { text: 'ยกเลิก', style: 'cancel' },
          {
            text: 'ลบ',
            style: 'destructive',
            onPress: async () => {
              try {
                if (item?.imagePath) {
                  try {
                    await deleteObject(ref(storage, item.imagePath));
                  } catch (e) {
                    console.warn('ลบรูปไม่สำเร็จ:', e.message);
                  }
                }
                
                await deleteDoc(doc(db, 'users', item.ownerId, 'userIngredient', item.id));
                Alert.alert('สำเร็จ', 'ลบวัตถุดิบเรียบร้อยแล้ว');
              } catch (err) {
                console.error('ลบไม่สำเร็จ:', err);
                Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถลบวัตถุดิบได้');
              }
            }
          }
        ]
      );
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
    
    const addedByMember = groupMembers.find(m => m.id === item.addedBy);
    const addedByName = item.addedBy === userId
      ? 'คุณ'
      : (addedByMember?.name || addedByMember?.displayName || 'สมาชิก');
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
          navigation.navigate('AddEditIngredient', {
            item: { ...item, targetUserId: item.ownerId }
          });
        } else {
          Alert.alert('ไม่สามารถแก้ไขได้', 'คุณสามารถแก้ไขได้เฉพาะรายการที่คุณเพิ่มเอง หรือหากคุณเป็นเจ้าของกลุ่ม');
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

  useLayoutEffect(() => {
  navigation.setOptions({
    headerTitle: () => (
      <View style={styles.headerTitleWrap}>
        <Image source={require('../../assets/logo.png')} style={styles.headerLogo} />
        <View>
          <Text style={styles.headerTitleText}>
            {groupId ? 'ตู้เย็นกลุ่ม' : 'ตู้เย็นของฉัน'}
          </Text>
          {groupId && (
            <Text style={styles.headerSubtitleText}>
              {currentUserRole === 'host' 
                ? `ตู้เย็นของคุณ • ${groupMembers.length} คน` 
                : `ตู้เย็นแชร์ • ${groupMembers.length} คน`}
            </Text>
          )}
        </View>
      </View>
    ),
    headerRight: () => (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12 }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('InviteScreen')}
          style={styles.headerIconButton}
        >
          <Ionicons name="people" size={22} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('AddEditIngredient', {})}
          style={styles.headerIconButton}
        >
          <Ionicons name="add-circle" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>
    ),
    headerStyle: { backgroundColor: '#425010' },
    headerTintColor: '#fff',
    headerShown: true,
  });
}, [navigation, groupId, currentUserRole, groupMembers.length]);

 return (
  <SafeAreaView style={styles.safeContainer} edges={['left', 'right']}>
    <View style={styles.container}>
      {/* Search */}
      <TextInput
        placeholder="ค้นหาวัตถุดิบ..."
        style={styles.searchInput}
        value={searchText}
        onChangeText={setSearchText}
      />

      {/* Category Pills */}
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

      {/* FlatList */}
      <FlatList
        data={filtered}
        keyExtractor={(item, idx) => `${item.ownerId}_${item.id}_${idx}`}
        contentContainerStyle={{ paddingBottom: 30 }}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={48} color="#F7F0CE" />
            <Text style={styles.emptyText}>
              {groupId ? 'ไม่มีวัตถุดิบในตู้เย็นกลุ่ม' : 'ไม่พบวัตถุดิบ'}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('AddEditIngredient', {})}
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
  safeContainer: { 
    flex: 1, 
    backgroundColor: '#425010'  // เขียวเข้ม
  },
  container: { 
    flex: 1, 
    backgroundColor: '#FFF8E1',  // เขียวกลาง
    padding: 16 
  }, 
  // เพิ่มใน styles
headerTitleWrap: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
},
headerLogo: {
  width: 32,
  height: 32,
  marginRight: 8,
  borderRadius: 6,
},
headerTitleText: {
  color: '#FFF',
  fontSize: 18,
  fontWeight: 'bold',
},
headerSubtitleText: {
  color: '#F7F0CE',
  fontSize: 11,
  fontWeight: '500',
  marginTop: 2,
},
headerIconButton: {
  width: 36,
  height: 36,
  borderRadius: 18,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255,255,255,0.2)',
},
  

  // Header (ใช้สไตล์จาก Buy.js)
  headerRow: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
    backgroundColor: '#FFFFFF', 
    padding: 16, 
    borderRadius: 12,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 3,
  },
  headerLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flex: 1 
  },
  title: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#425010'  // เขียวเข้ม
  },
  subtitle: { 
    fontSize: 12, 
    color: '#769128',  // เขียวกลาง
    fontWeight: '500', 
    marginTop: 2 
  },

  // Buttons (ใช้สไตล์ปุ่มจาก Buy.js)
  buttonContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  iconButton: {
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 4, 
    elevation: 3,
  },
  groupButton: { 
    backgroundColor: '#769128'  // เขียวกลาง
  },
  addButton: { 
    backgroundColor: '#F7F0CE'  // เหลืองอ่อน
  },

  // Search
  searchInput: {
    borderWidth: 1, 
    borderColor: '#ddd', 
    borderRadius: 12, 
    padding: 12, 
    marginBottom: 16, 
    backgroundColor: '#FFFFFF',
    fontSize: 16, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2, 
    elevation: 1,
  },

  // Category pills (ใช้สไตล์จาก Buy.js)
  categoryScrollContainer: { 
    marginBottom: 16 
  },
  categoryPill: {
    backgroundColor: '#FFFFFF', 
    borderWidth: 1, 
    borderColor: '#ddd', 
    borderRadius: 20,
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    marginRight: 10, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2, 
    elevation: 1,
  },
  categoryPillSelected: { 
    backgroundColor: '#F7F0CE',  // เหลืองอ่อน
    borderColor: '#F7F0CE', 
    shadowOpacity: 0.15 
  },
  categoryText: { 
    color: '#555', 
    fontSize: 14, 
    fontWeight: '500' 
  },
  categoryTextSelected: { 
    color: '#425010',  // เขียวเข้ม
    fontWeight: 'bold' 
  },

  // Item cards (ใช้สไตล์การ์ดจาก Buy.js)
  itemRow: {
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12, 
    backgroundColor: '#FFFFFF',
    padding: 12, 
    borderRadius: 12, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4, 
    elevation: 2,
  },
  editableItem: { 
    borderLeftWidth: 4, 
    borderLeftColor: '#769128'  // เขียวกลาง
  },
  readOnlyItem: { 
    borderLeftWidth: 4, 
    borderLeftColor: '#ccc', 
    opacity: 0.8 
  },
  itemImage: {
    width: 60, 
    height: 60, 
    marginRight: 12, 
    borderRadius: 8, 
    resizeMode: 'cover', 
    backgroundColor: '#FEF9C3'  // เหลืองอ่อน
  },
  itemName: { 
    fontWeight: 'bold', 
    fontSize: 16, 
    marginBottom: 4, 
    color: '#000000ff'  // ดำ
  },
  detailText: { 
    fontSize: 13, 
    color: '#666', 
    marginBottom: 2 
  },
  addedByText: { 
    fontSize: 12, 
    color: '#000000ff',  // ดำ
    fontWeight: 'bold', 
    marginTop: 4 
  },
  actionContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  readOnlyBadge: { 
    padding: 4 
  },

  // Empty state
  emptyContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 60 
  },
  emptyText: { 
    textAlign: 'center', 
    color: '#F7F0CE',  // เหลืองอ่อน
    fontSize: 16, 
    marginTop: 16, 
    marginBottom: 20 
  },
  emptyButton: { 
    backgroundColor: '#769128',  // เขียวกลาง
    paddingHorizontal: 20, 
    paddingVertical: 10, 
    borderRadius: 20 
  },
  emptyButtonText: { 
    color: 'white', 
    fontWeight: 'bold' 
  },
});