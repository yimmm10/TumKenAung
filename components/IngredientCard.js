// IngredientListScreen.js
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AddEditIngredientScreen from './AddEditIngredientScreen'; 

const mockData = [
  { id: '1', name: 'แฮมแผ่น', category: 'ของแปรรูป', quantity: '500 กรัม', expiry: '5 ก.ค. 2025', image: require('../assets/images/ham.png') },
  { id: '2', name: 'นมสด 1 ลิตร', category: 'ของแปรรูป', quantity: '200 มิลลิลิตร', expiry: '7 ก.ค. 2025', image: require('../assets/images/milk.png') },
  { id: '3', name: 'ไข่ไก่', category: 'เนื้อสัตว์', quantity: '6 ฟอง', expiry: '9 ก.ค. 2025', image: require('../assets/images/eggs.png') },
];

const categories = ['ทั้งหมด', 'ผัก', 'เนื้อสัตว์', 'ผลไม้', 'ของแปรรูป'];

export default function IngredientListScreen() {
  const [ingredients, setIngredients] = useState(mockData);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

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
      // update
      setIngredients(prev => prev.map(item => item.id === newItem.id ? newItem : item));
    } else {
      // add
      const newId = (ingredients.length + 1).toString();
      setIngredients(prev => [...prev, { ...newItem, id: newId }]);
    }
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>วัตถุดิบของฉัน</Text>

      {/* Search bar */}
      <TextInput
        placeholder="ค้นหาวัตถุดิบ"
        style={styles.searchInput}
        value={searchText}
        onChangeText={setSearchText}
      />

      {/* Filter categories */}
      <View style={styles.categoryRow}>
        {categories.map(cat => (
          <TouchableOpacity key={cat} onPress={() => setSelectedCategory(cat)}>
            <Text style={[styles.category, selectedCategory === cat && styles.categorySelected]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <Image source={item.image} style={styles.itemImage} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text>ปริมาณ: {item.quantity}</Text>
              <Text>หมดอายุ: {item.expiry}</Text>
            </View>
            <TouchableOpacity onPress={() => openEditModal(item)}>
              <MaterialIcons name="edit" size={24} color="green" />
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Add button */}
      <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
        <MaterialIcons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Modal */}
      {modalVisible && (
        <AddEditIngredientScreen
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onSave={handleSave}
          item={editingItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  searchInput: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 10
  },
  categoryRow: { flexDirection: 'row', marginBottom: 10, flexWrap: 'wrap' },
  category: {
    backgroundColor: '#eee', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, marginRight: 8, marginBottom: 5
  },
  categorySelected: { backgroundColor: '#ffb703', color: 'white' },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  itemImage: { width: 60, height: 60, marginRight: 10, borderRadius: 6 },
  itemName: { fontWeight: 'bold', marginBottom: 3 },
  addButton: {
    position: 'absolute', bottom: 20, right: 20,
    backgroundColor: '#6a994e', padding: 16, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center', elevation: 4
  },
});
