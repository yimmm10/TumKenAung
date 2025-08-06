import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Image, Platform, Alert, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, storage } from '../../firebaseconfig';
import { getAuth } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import RNModal from 'react-native-modal';

const categories = {
  'ผัก': ['กำ', 'ต้น'],
  'เนื้อสัตว์': ['ชิ้น', 'กรัม', 'ขีด', 'กิโลกรัม'],
  'ผลไม้': ['ผล', 'ลูก', 'หวี'],
  'น้ำ': ['มิลลิลิตร', 'ลิตร', 'กล่อง', 'ขวด'],
  'ของแปรรูป': ['แพ็ค', 'กล่อง'],
  'นม': ['มิลลิลิตร', 'ลิตร', 'กล่อง'],
  'ไข่': ['ฟอง', 'แพ็ค'],
  'อื่นๆ': ['หน่วย']
};

export default function AddEditIngredientScreen({ navigation, route }) {
  const editingItem = route.params?.item;
  const [userId, setUserId] = useState('');

  const [name, setName] = useState('');
  const [category, setCategory] = useState('ผัก');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(categories['ผัก'][0]);
  const [imageUri, setImageUri] = useState(null);
  const [production, setProduction] = useState('');
  const [expiry, setExpiry] = useState('');
  const [showPicker, setShowPicker] = useState(null);
  const [webDate, setWebDate] = useState(new Date());
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // ✅ ดึง userId จาก Firebase Auth
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      setUserId(user.uid);
    } else {
      Alert.alert('ไม่พบผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');
      navigation.goBack();
    }
  }, []);

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name || '');
      setCategory(editingItem.category || 'ผัก');
      const [qty, unitPart] = (editingItem.quantity || '').split(' ');
      setQuantity(qty || '');
      setUnit(unitPart || categories[editingItem.category]?.[0] || 'หน่วย');
      setImageUri(editingItem.image || null);
      setProduction(editingItem.production || '');
      setExpiry(editingItem.expiry || '');
    }
  }, [editingItem]);

  useEffect(() => {
    if (!categories[category]) {
      setCategory('อื่นๆ');
      setUnit('หน่วย');
    } else {
      setUnit(categories[category][0]);
    }
  }, [category]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const formatDate = (date) => {
    if (!date || !(date instanceof Date)) return '-';
    return date.toLocaleDateString('th-TH', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const onChangeDate = (event, selectedDate) => {
    if (event?.type === 'dismissed') {
      setShowPicker(null);
      return;
    }
    const date = selectedDate || new Date();
    const formatted = formatDate(date);
    if (showPicker === 'production') setProduction(formatted);
    else setExpiry(formatted);
    setShowPicker(null);
  };

  const handleCategorySelect = (cat) => {
    setCategory(cat);
    setUnit(categories[cat]?.[0] || 'หน่วย');
    setShowCategoryModal(false);
  };

const handleSave = async () => {
  if (!userId) {
    Platform.OS === 'web'
      ? window.alert('ไม่พบข้อมูลผู้ใช้')
      : Alert.alert('เกิดข้อผิดพลาด', 'ไม่พบข้อมูลผู้ใช้');
    return;
  }

  if (!name || !quantity || !unit) {
    Platform.OS === 'web'
      ? window.alert('กรุณากรอกข้อมูลให้ครบ')
      : Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลให้ครบ');
    return;
  }

  const id = editingItem?.id || uuidv4();
  let imageUrl = editingItem?.image || '';
  let imagePath = editingItem?.imagePath || '';

  try {
    if (imageUri && imageUri !== editingItem?.image) {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      imagePath = `ingredients/${userId}/${id}.jpg`;
      const imageRef = ref(storage, imagePath);
      await uploadBytes(imageRef, blob);
      imageUrl = await getDownloadURL(imageRef);
    }

    const newItem = {
      id,
      name,
      category,
      quantity: `${quantity} ${unit}`,
      production: production || '-',
      expiry: expiry || '-',
      image: imageUrl,
      imagePath: imagePath || '', // <-- เพิ่ม path จริงไว้ตอน save
    };

    await setDoc(doc(db, 'users', userId, 'userIngredient', id), newItem, { merge: true });

    Platform.OS === 'web'
      ? window.alert('บันทึกข้อมูลวัตถุดิบเรียบร้อยแล้ว')
      : Alert.alert('สำเร็จ', 'บันทึกข้อมูลวัตถุดิบเรียบร้อยแล้ว');

    setTimeout(() => navigation.goBack(), 500);
  } catch (error) {
    console.error('Unexpected error:', error);
    Platform.OS === 'web'
      ? window.alert('ไม่สามารถบันทึกข้อมูลได้')
      : Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้');
  }
};

const handleDelete = async () => {
  if (!editingItem) return;

  try {
    // ✅ ลบจาก Firebase Storage ด้วย path ที่ชัวร์
    if (editingItem.imagePath) {
      const imageRef = ref(storage, editingItem.imagePath);
      await deleteObject(imageRef);
    }

    // ✅ ลบจาก Firestore
    await deleteDoc(doc(db, 'users', userId, 'userIngredient', editingItem.id));

    // ✅ แจ้งเตือน
    Platform.OS === 'web'
      ? window.alert('ลบวัตถุดิบและรูปภาพเรียบร้อยแล้ว')
      : Alert.alert('สำเร็จ', 'ลบวัตถุดิบและรูปภาพเรียบร้อยแล้ว');

    setTimeout(() => navigation.goBack(), 500);
  } catch (err) {
    console.error('ลบไม่สำเร็จ:', err);
    Platform.OS === 'web'
      ? window.alert('ไม่สามารถลบวัตถุดิบได้')
      : Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถลบวัตถุดิบได้');
  }
};



  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{editingItem ? 'แก้ไขวัตถุดิบ' : 'เพิ่มวัตถุดิบ'}</Text>

      <TouchableOpacity onPress={pickImage}>
        <Image
          source={imageUri ? { uri: imageUri } : require('../../assets/images/placeholder.png')}
          style={styles.image}
        />
      </TouchableOpacity>

      <TextInput placeholder="ชื่อวัตถุดิบ" value={name} onChangeText={setName} style={styles.input} />

      <TouchableOpacity style={styles.input} onPress={() => setShowCategoryModal(true)}>
        <Text>{category}</Text>
        <Ionicons name="chevron-down" size={20} style={styles.rightIcon} />
      </TouchableOpacity>

      <View style={styles.row}>
        <TextInput
          placeholder="ปริมาณ"
          value={quantity}
          onChangeText={setQuantity}
          style={[styles.input, { flex: 1, marginRight: 8 }]}
          keyboardType="numeric"
        />
        <TouchableOpacity
          style={[styles.input, { flex: 1 }]}
          onPress={() => {
            const unitList = categories[category] || ['หน่วย'];
            const currentIndex = unitList.indexOf(unit);
            const nextIndex = (currentIndex + 1) % unitList.length;
            setUnit(unitList[nextIndex]);
          }}
        >
          <Text>{unit}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.input} onPress={() => setShowPicker('production')}>
        <Text>{production || 'วันที่ผลิต'}</Text>
        <Ionicons name="calendar-outline" size={20} style={styles.rightIcon} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.input} onPress={() => setShowPicker('expiry')}>
        <Text>{expiry || 'วันหมดอายุ'}</Text>
        <Ionicons name="calendar-outline" size={20} style={styles.rightIcon} />
      </TouchableOpacity>

      {Platform.OS === 'web' && showPicker && (
        <View style={{ marginBottom: 12 }}>
          <DatePicker
            selected={webDate}
            onChange={(date) => {
              const formatted = formatDate(date);
              if (showPicker === 'production') setProduction(formatted);
              else setExpiry(formatted);
              setWebDate(date);
              setShowPicker(null);
            }}
            dateFormat="dd/MM/yyyy"
          />
        </View>
      )}

      {Platform.OS !== 'web' && showPicker && (
        <DateTimePicker value={new Date()} mode="date" display="default" onChange={onChangeDate} />
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>ยกเลิก</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveText}>บันทึก</Text>
        </TouchableOpacity>
      </View>

      {editingItem && (
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: '#d62828', marginTop: 10 }]}
          onPress={handleDelete}
        >
          <Text style={styles.saveText}>ลบ</Text>
        </TouchableOpacity>
      )}

      <RNModal isVisible={showCategoryModal} onBackdropPress={() => setShowCategoryModal(false)}>
        <View style={styles.modalContent}>
          {Object.keys(categories).map(cat => (
            <TouchableOpacity key={cat} style={styles.modalItem} onPress={() => handleCategorySelect(cat)}>
              <Text>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </RNModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 12, marginBottom: 12, position: 'relative'
  },
  image: {
    width: '100%', height: 180, borderRadius: 10,
    marginBottom: 12, resizeMode: 'cover'
  },
  rightIcon: { position: 'absolute', right: 10, top: 12, color: '#999' },
  row: { flexDirection: 'row', marginBottom: 12 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  saveButton: { backgroundColor: '#6a994e', padding: 14, borderRadius: 10, flex: 1, marginLeft: 8 },
  cancelButton: { backgroundColor: '#ccc', padding: 14, borderRadius: 10, flex: 1, marginRight: 8 },
  saveText: { textAlign: 'center', color: 'white', fontWeight: 'bold' },
  cancelText: { textAlign: 'center', color: '#333', fontWeight: 'bold' },
  modalContent: {
    backgroundColor: '#fff', padding: 20,
    borderRadius: 12, alignItems: 'flex-start'
  },
  modalItem: {
    paddingVertical: 12, borderBottomWidth: 0.5, borderColor: '#ccc', width: '100%'
  }
});
