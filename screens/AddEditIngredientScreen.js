import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, StyleSheet, TextInput, TouchableOpacity,
  Pressable, Image, Alert, Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import RNModal from 'react-native-modal';

const categories = ['ผัก', 'เนื้อสัตว์', 'ผลไม้', 'ของแปรรูป', 'น้ำ', 'อื่นๆ'];

export default function AddEditIngredientModal({ visible, onClose, onSave, item }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('ผัก');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [expiry, setExpiry] = useState('');
  const [production, setProduction] = useState('');
  const [showPicker, setShowPicker] = useState(null);
  const [imageUri, setImageUri] = useState(null);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category || 'ผัก');
      setQuantity(item.quantity);
      setExpiry(item.expiry);
      setProduction(item.production || '');
      setImageUri(item.image);
    } else {
      setName('');
      setCategory('ผัก');
      setQuantity('');
      setExpiry('');
      setProduction('');
      setImageUri(null);
    }
  }, [item]);

  const handleSave = () => {
    if (!name || !quantity) {
      Alert.alert('กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    const newItem = {
      id: item?.id || Date.now().toString(),
      name,
      category,
      quantity,
      expiry,
      production,
      image: imageUri || require('../assets/images/placeholder.png')
    };
    onSave(newItem);
  };

  const onChangeDate = (event, selectedDate) => {
    if (event.type === 'dismissed') {
      setShowPicker(null);
      return;
    }

    if (selectedDate) {
      const dateStr = selectedDate.toLocaleDateString('th-TH', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
      if (showPicker === 'expiry') setExpiry(dateStr);
      else if (showPicker === 'production') setProduction(dateStr);
    }

    if (Platform.OS === 'android') setShowPicker(null);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <Text style={styles.title}>{item ? 'แก้ไขวัตถุดิบ' : 'เพิ่มวัตถุดิบ'}</Text>

        <TouchableOpacity onPress={pickImage}>
          <Image
            source={imageUri ? { uri: imageUri } : require('../assets/images/placeholder.png')}
            style={{ width: '100%', height: 180, borderRadius: 8, marginBottom: 12 }}
          />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <TouchableOpacity style={styles.iconButton} onPress={takePhoto}>
            <Ionicons name="camera" size={24} color="#fff" />
            <Text style={{ color: '#fff', marginLeft: 6 }}>ถ่ายรูป</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={pickImage}>
            <MaterialIcons name="photo-library" size={24} color="#fff" />
            <Text style={{ color: '#fff', marginLeft: 6 }}>เลือกรูป</Text>
          </TouchableOpacity>
        </View>

        <TextInput placeholder="ชื่อวัตถุดิบ" value={name} onChangeText={setName} style={styles.input} />

        <TouchableOpacity style={styles.input} onPress={() => setShowCategoryModal(true)}>
          <Text>{category || 'เลือกประเภท'}</Text>
          <Ionicons name="chevron-down" size={20} color="#888" style={styles.calendarIcon} />
        </TouchableOpacity>

        <TextInput placeholder="ปริมาณ" value={quantity} onChangeText={setQuantity} style={styles.input} />

        <Pressable onPress={() => setShowPicker('production')} style={styles.input}>
          <Text>{production || 'วันที่ผลิต'}</Text>
          <Ionicons name="calendar" size={20} color="#888" style={styles.calendarIcon} />
        </Pressable>

        <Pressable onPress={() => setShowPicker('expiry')} style={styles.input}>
          <Text>{expiry || 'วันหมดอายุ'}</Text>
          <Ionicons name="calendar" size={20} color="#888" style={styles.calendarIcon} />
        </Pressable>

        {showPicker && (
          <DateTimePicker
            value={new Date()}
            mode="date"
            display="default"
            onChange={onChangeDate}
          />
        )}

        <View style={styles.buttonRow}>
          {item && (
            <TouchableOpacity style={styles.deleteButton} onPress={onClose}>
              <Text style={styles.deleteText}>ลบ</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>ยกเลิก</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveText}>บันทึก</Text>
          </TouchableOpacity>
        </View>

        <RNModal isVisible={showCategoryModal} onBackdropPress={() => setShowCategoryModal(false)}>
          <View style={styles.modalPicker}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={styles.modalItem}
                onPress={() => {
                  setCategory(cat);
                  setShowCategoryModal(false);
                }}
              >
                <Text style={{ fontSize: 16 }}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </RNModal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 12, marginBottom: 12, position: 'relative'
  },
  iconButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#6a994e', padding: 10, borderRadius: 8
  },
  calendarIcon: { position: 'absolute', right: 10, top: 10 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  saveButton: { backgroundColor: '#6a994e', padding: 12, borderRadius: 8 },
  cancelButton: { backgroundColor: '#ccc', padding: 12, borderRadius: 8 },
  deleteButton: { backgroundColor: '#d62828', padding: 12, borderRadius: 8 },
  saveText: { color: 'white', fontWeight: 'bold' },
  cancelText: { color: '#333', fontWeight: 'bold' },
  deleteText: { color: 'white', fontWeight: 'bold' },
  modalPicker: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  modalItem: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderColor: '#ccc',
  }
});
