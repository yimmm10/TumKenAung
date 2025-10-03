// components/ProductCard.js
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ProductCard({
  name,
  price,
  imageUrl,
  vendorName,
  distanceLabel,
  onPress,
}) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.imageWrap}>
        <Image
          source={
            imageUrl
              ? { uri: imageUrl }
              : require('../assets/images/placeholder.png')
          }
          style={styles.image}
          resizeMode="cover"
        />
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{name}</Text>
        <Text style={styles.price}>฿{Number(price || 0).toLocaleString('th-TH')}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="storefront-outline" size={14} style={{ marginRight: 4 }} />
          <Text style={styles.vendor} numberOfLines={1}>{vendorName}</Text>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} style={{ marginRight: 4 }} />
          <Text style={styles.distance}>{distanceLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    maxWidth: '48%',
    borderWidth: 1, borderColor: '#EAEAEA',
    borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden',
  },
  imageWrap: { width: '100%', aspectRatio: 1, backgroundColor: '#F2F2F2' },
  image: { width: '100%', height: '100%' },
  info: { paddingHorizontal: 8, paddingVertical: 10, gap: 4 },
  name: { fontSize: 14, fontWeight: '600' },
  price: { fontSize: 14, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  vendor: { fontSize: 12, color: '#444', flexShrink: 1 },
  distance: { fontSize: 12, color: '#444' },
});
