import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export default function UserRecipeDetail() {
  const route = useRoute();
  const navigation = useNavigation();
  const recipe = route.params?.recipe;

  if (!recipe) {
    return (
      <View style={styles.centered}><Text>ไม่พบข้อมูลสูตรอาหาร</Text></View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{recipe.title || 'ไม่มีชื่อเมนู'}</Text>
      </View>

      <Image
        source={recipe.imageUrl ? { uri: recipe.imageUrl } : require('../../assets/images/sample-food.jpg')}
        style={styles.image}
      />

      <Text style={styles.description}>{recipe.description || 'ไม่มีคำอธิบาย'}</Text>

      {recipe.ingredients?.length > 0 && (
        <>
          <Text style={styles.subheading}>วัตถุดิบ</Text>
          {recipe.ingredients.map((i, idx) => (
            <Text key={idx} style={styles.textItem}>• {i.name} - {i.qty} {i.unit}</Text>
          ))}
        </>
      )}

      {recipe.seasonings?.length > 0 && (
        <>
          <Text style={styles.subheading}>เครื่องปรุง</Text>
          {recipe.seasonings.map((s, idx) => (
            <Text key={idx} style={styles.textItem}>• {s}</Text>
          ))}
        </>
      )}

      {recipe.tools?.length > 0 && (
        <>
          <Text style={styles.subheading}>อุปกรณ์</Text>
          {recipe.tools.map((t, idx) => (
            <Text key={idx} style={styles.textItem}>• {t}</Text>
          ))}
        </>
      )}

      {recipe.steps?.length > 0 && (
        <>
          <Text style={styles.subheading}>ขั้นตอน</Text>
          {recipe.steps.map((s, idx) => (
            <Text key={idx} style={styles.textItem}>ขั้นที่ {idx + 1}: {s}</Text>
          ))}
        </>
      )}

      {recipe.tags?.length > 0 && (
        <View style={styles.tagContainer}>
          {recipe.tags.map((tag, idx) => (
            <Text key={idx} style={styles.tag}>{tag}</Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12
  },
  headerTitle: {
    fontSize: 18, fontWeight: 'bold', marginLeft: 10, color: '#2c3e50'
  },
  image: {
    width: '100%', height: 200, borderRadius: 10, marginBottom: 10
  },
  description: {
    fontSize: 14, color: '#555', marginBottom: 10
  },
  subheading: {
    fontWeight: 'bold', marginTop: 10, marginBottom: 4, color: '#6a994e'
  },
  textItem: {
    fontSize: 14, color: '#333', marginBottom: 2
  },
  tagContainer: {
    flexDirection: 'row', flexWrap: 'wrap', marginTop: 10
  },
  tag: {
    backgroundColor: '#dff0d8', color: '#2e7d32',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, marginRight: 8, marginBottom: 6, fontSize: 12
  },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center'
  }
});
