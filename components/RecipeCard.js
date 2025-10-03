// components/RecipeCard.js
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';

export default function RecipeCard({ recipe, onPress }) {
  const status = String(recipe.status || 'ไม่มีสถานะ').toLowerCase();
  const statusLabel =
    status === 'approved'
      ? 'อนุมัติแล้ว'
      : status === 'pending'
      ? 'รออนุมัติ'
      : status === 'rejected'
      ? 'ถูกปฏิเสธ'
      : 'ไม่มีสถานะ';

  const statusColor =
    status === 'approved'
      ? '#4CAF50'
      : status === 'pending'
      ? '#FFC107'
      : status === 'rejected'
      ? '#F44336'
      : '#9E9E9E';

  const author = recipe.authorName?.trim() || 'admin';

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(recipe)}>
      <View style={{ position: 'relative' }}>
        {recipe.imageUrl ? (
          <Image source={{ uri: recipe.imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
    <Text style={styles.title}>{recipe.title}</Text>
    <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
      <Text style={styles.statusText}>{statusLabel}</Text>
    </View>
  </View>

  {recipe.description ? (
    <Text style={styles.description} numberOfLines={2}>
      {recipe.description}
    </Text>
  ) : null}

  {/* ผู้สร้าง */}
  <Text style={styles.meta}>สร้างโดย {author}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',        // จัด layout แนวนอน
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 8,
    elevation: 2,                // เงา (Android)
    shadowColor: '#000',         // เงา (iOS)
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  image: {
    width: 100,
    height: 100,
  },
  imagePlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: '#eee',
  },
  content: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',    // จัดข้อความให้กลางแนวตั้ง
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  description: {
    marginTop: 4,
    fontSize: 14,
    color: '#666',
  },
  meta: {
   marginTop: 6,
   fontSize: 12,
   color: '#555',
 },
titleRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
statusBadge: {
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 6,
},
statusText: {
  color: '#fff',
  fontSize: 12,
  fontWeight: 'bold',
},
});
