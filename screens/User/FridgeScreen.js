import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Image, ScrollView, Alert, Platform
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { db, storage } from '../../firebaseconfig';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { ref, deleteObject } from 'firebase/storage';

export default function FridgeScreen() {
  const navigation = useNavigation();
  const [userId, setUserId] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');

  const categories = ['ทั้งหมด', 'ผัก', 'เนื้อสัตว์', 'ผลไม้', 'ของแปรรูป', 'ไข่', 'นม', 'อาหารแช่แข็ง'];

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      setUserId(user.uid);
    } else {
      Alert.alert('ไม่พบผู้ใช้งาน', 'กรุณาเข้าสู่ระบบใหม่');
      navigation.goBack();
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (userId) fetchIngredients();
    }, [userId])
  );

  const fetchIngredients = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users', userId, 'userIngredient'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIngredients(data);
    } catch (error) {
      console.error('Error fetching ingredients:', error);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลวัตถุดิบได้');
    }
  };

  const handleDelete = async (id) => {
    try {
      const itemToDelete = ingredients.find(item => item.id === id);

      if (itemToDelete?.imagePath) {
        try {
          const imageRef = ref(storage, itemToDelete.imagePath);
          await deleteObject(imageRef);
        } catch (storageErr) {
          console.warn('ลบรูปไม่ได้ (อาจไม่มีอยู่):', storageErr.code);
        }
      }

      await deleteDoc(doc(db, 'users', userId, 'userIngredient', id));

      if (Platform.OS === 'web') {
        window.alert('ลบวัตถุดิบเรียบร้อยแล้ว');
      } else {
        Alert.alert('สำเร็จ', 'ลบวัตถุดิบเรียบร้อยแล้ว');
      }

      fetchIngredients();
    } catch (err) {
      console.error('ลบไม่สำเร็จ:', err);
      Platform.OS === 'web'
        ? window.alert('ไม่สามารถลบวัตถุดิบได้')
        : Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถลบวัตถุดิบได้');
    }
  };

  const filtered = ingredients.filter(item => {
    const nameMatch = item.name.toLowerCase().includes(searchText.toLowerCase());
    const categoryMatch = selectedCategory === 'ทั้งหมด' || item.category === selectedCategory;
    return nameMatch && categoryMatch;
  });

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('AddEditIngredient', { item })}
      style={styles.itemRow}
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
      </View>
      <TouchableOpacity onPress={() => handleDelete(item.id)}>
        <MaterialIcons name="delete" size={24} color="#d62828" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>วัตถุดิบของฉัน</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddEditIngredient')}>
          <Ionicons name="add-circle" size={28} color="#6a994e" />
        </TouchableOpacity>
      </View>

      <TextInput
        placeholder="ค้นหาวัตถุดิบ"
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
                selectedCategory === cat && styles.categoryPillSelected
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat && styles.categoryTextSelected
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
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fefae0', padding: 16 },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#3a3a3a' },
  searchInput: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 12,
    padding: 10, marginBottom: 12, backgroundColor: '#f9f9f9'
  },
  categoryScrollContainer: { marginBottom: 12 },
  categoryPill: {
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#ddd',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    marginRight: 8, justifyContent: 'center', alignItems: 'center'
  },
  categoryPillSelected: {
    backgroundColor: '#f4a261', borderColor: '#f4a261'
  },
  categoryText: { color: '#555', fontSize: 14 },
  categoryTextSelected: { color: '#fff', fontWeight: 'bold' },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 12, backgroundColor: '#fff',
    padding: 10, borderRadius: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4, elevation: 2
  },
  itemImage: {
    width: 60, height: 60, marginRight: 10,
    borderRadius: 8, resizeMode: 'cover'
  },
  itemName: { fontWeight: 'bold', fontSize: 15, marginBottom: 4, color: '#d62828' },
  detailText: { fontSize: 13, color: '#333', marginBottom: 2 }
});
