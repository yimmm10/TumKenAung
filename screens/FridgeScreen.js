import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AddEditIngredientScreen from './AddEditIngredientScreen';
import FridgeGroupOverlay from './FridgeGroupOverlay';

const mockData = [
  {
    id: '1', name: 'แฮมแผ่น', category: 'ของแปรรูป', quantity: '500 กรัม',
    expiry: '5 ก.ค. 2025', production: '2 ก.ค. 2025', image: require('../assets/images/ham.png')
  },
  {
    id: '2', name: 'นมสด 1 ลิตร', category: 'นม', quantity: '200 มิลลิลิตร',
    expiry: '7 ก.ค. 2025', production: '4 ก.ค. 2025', image: require('../assets/images/milk.png')
  },
  {
    id: '3', name: 'ไข่ไก่', category: 'ไข่', quantity: '6 ฟอง',
    expiry: '9 ก.ค. 2025', production: '6 ก.ค. 2025', image: require('../assets/images/eggs.png')
  },
  {
    id: '4', name: 'อกไก่', category: 'อาหารแช่แข็ง', quantity: '500 กรัม',
    expiry: '10 ก.ค. 2025', production: '6 ก.ค. 2025', image: require('../assets/images/eggs.png')
  },
  {
    id: '5', name: 'ผักกาดแก้ว', category: 'ผัก', quantity: '1 หัว',
    expiry: '10 ก.ค. 2025', production: '8 ก.ค. 2025', image: require('../assets/images/ham.png')
  }
];

const categories = ['ทั้งหมด', 'ผัก', 'เนื้อสัตว์', 'ผลไม้', 'ของแปรรูป', 'ไข่', 'นม', 'อาหารแช่แข็ง'];

export default function FridgeScreen() {
  const [ingredients, setIngredients] = useState(mockData);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [groupVisible, setGroupVisible] = useState(false);

  const filtered = ingredients.filter(item => {
    const matchesCategory = selectedCategory === 'ทั้งหมด' || item.category === selectedCategory;
    const matchesSearch = item.name.includes(searchText);
    return matchesCategory && matchesSearch;
  });

  const openAddModal = () => {
    setEditingItem(null);
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setModalVisible(true);
  };

  const handleSave = (newItem) => {
    if (editingItem) {
      setIngredients(prev => prev.map(item => item.id === newItem.id ? newItem : item));
    } else {
      const newId = (ingredients.length + 1).toString();
      setIngredients(prev => [...prev, { ...newItem, id: newId }]);
    }
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>วัตถุดิบของฉัน</Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={() => setGroupVisible(true)}>
            <Ionicons name="people-outline" size={24} color="#3a3a3a" style={{ marginRight: 16 }} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openAddModal}>
            <Ionicons name="add-circle" size={28} color="#6a994e" />
          </TouchableOpacity>
        </View>
      </View>

      <TextInput
        placeholder="ค้นหาวัตถุดิบ"
        style={styles.searchInput}
        value={searchText}
        onChangeText={setSearchText}
      />

      <View style={styles.categoryRow}>
        {categories.map(cat => (
          <TouchableOpacity key={cat} onPress={() => setSelectedCategory(cat)}>
            <Text style={[styles.category, selectedCategory === cat && styles.categorySelected]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <Image source={item.image} style={styles.itemImage} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.detailText}>ปริมาณ: {item.quantity}</Text>
              <Text style={styles.detailText}>หมดอายุ: {item.expiry}</Text>
              <Text style={styles.detailText}>ผลิต: {item.production}</Text>
            </View>
            <TouchableOpacity onPress={() => openEditModal(item)}>
              <MaterialIcons name="edit" size={22} color="#6a994e" />
            </TouchableOpacity>
          </View>
        )}
      />

      {modalVisible && (
        <AddEditIngredientScreen
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onSave={handleSave}
          item={editingItem}
        />
      )}

      {groupVisible && (
        <FridgeGroupOverlay visible={groupVisible} onClose={() => setGroupVisible(false)} />
      )}
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
  categoryRow: {
    flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12
  },
  category: {
    backgroundColor: '#eee', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, marginRight: 8, marginBottom: 8, color: '#333', fontSize: 14
  },
  categorySelected: {
    backgroundColor: '#ffb703', color: 'white'
  },
  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 12, backgroundColor: '#fff',
    padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee'
  },
  itemImage: {
    width: 60, height: 60, marginRight: 10,
    borderRadius: 8, resizeMode: 'cover'
  },
  itemName: {
    fontWeight: 'bold', fontSize: 15, marginBottom: 4, color: '#d62828'
  },
  detailText: {
    fontSize: 13, color: '#333', marginBottom: 2
  }
});
