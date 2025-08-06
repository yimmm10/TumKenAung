// สร้างไฟล์ components/Tag.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function Tag({ label, onRemove }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.text}>{label}</Text>
      <TouchableOpacity onPress={onRemove} style={styles.remove}>
        <Ionicons name="close" size={12} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',  // หรือ #00BCD4 ตามชอบ
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    margin: 4,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    marginRight: 6,
  },
  remove: {
    padding: 2,
  },
});
