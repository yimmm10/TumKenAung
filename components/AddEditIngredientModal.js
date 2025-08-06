// components/AddEditIngredientModal.js
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert } from 'react-native';
import RNModal from 'react-native-modal';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebaseconfig';

export default function AddEditIngredientModal({ isVisible, onClose, item, userId, onSave }) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [production, setProduction] = useState('');
  const [expiry, setExpiry] = useState('');

  useEffect(() => {
    if (item) {
      setName(item.name || '');
      setQuantity(item.quantity || '');
      setProduction(item.production || '');
      setExpiry(item.expiry || '');
    }
  }, [item]);

  const handleSave = async () => {
    if (!name || !quantity) {
      Alert.alert('กรุณากรอกชื่อและปริมาณ');
      return;
    }

    try {
      const ref = doc(db, 'users', userId, 'userIngredient', item.id);
      await setDoc(ref, {
        name,
        quantity,
        production,
        expiry,
        category: item.category,
        image: item.image || ''
      });

      Alert.alert('บันทึกสำเร็จ');
      onSave();
      onClose();
    } catch (error) {
      Alert.alert('เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  return (
    <RNModal isVisible={isVisible} onBackdropPress={onClose}>
      <View style={styles.modal}>
        <Text style={styles.title}>แก้ไขวัตถุดิบ</Text>
        <TextInput placeholder="ชื่อ" value={name} onChangeText={setName} style={styles.input} />
        <TextInput placeholder="ปริมาณ" value={quantity} onChangeText={setQuantity} style={styles.input} />
        <TextInput placeholder="วันที่ผลิต" value={production} onChangeText={setProduction} style={styles.input} />
        <TextInput placeholder="วันหมดอายุ" value={expiry} onChangeText={setExpiry} style={styles.input} />
        <TouchableOpacity onPress={handleSave} style={styles.button}>
          <Text style={styles.buttonText}>💾 บันทึก</Text>
        </TouchableOpacity>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  modal: { backgroundColor: '#fff', borderRadius: 10, padding: 20 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 10, marginBottom: 10
  },
  button: {
    backgroundColor: '#6a994e', padding: 12, borderRadius: 8,
    alignItems: 'center'
  },
  buttonText: { color: '#fff', fontWeight: 'bold' }
});
