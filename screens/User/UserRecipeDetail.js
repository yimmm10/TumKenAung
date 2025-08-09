// screens/User/UserRecipeDetail.js
import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../firebaseconfig';
import { doc, getDoc } from 'firebase/firestore';

export default function UserRecipeDetail() {
  const route = useRoute();
  const navigation = useNavigation();

  // รองรับสองกรณี: ส่ง recipe ทั้งก้อน หรือส่งแค่ recipeId
  const initRecipe = route.params?.recipe || null;
  const recipeId = route.params?.recipeId || initRecipe?.id || null;

  const [recipe, setRecipe] = useState(initRecipe);
  const [loading, setLoading] = useState(!initRecipe && !!recipeId);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (recipe || !recipeId) return; // มี recipe แล้ว หรือไม่มี id ก็ไม่ต้องโหลด
      try {
        setLoading(true);
        const snap = await getDoc(doc(db, 'recipes', recipeId));
        if (!mounted) return;
        if (snap.exists()) {
          setRecipe({ id: snap.id, ...snap.data() });
        } else {
          setError('ไม่พบข้อมูลสูตรอาหาร');
        }
      } catch (e) {
        console.warn('load recipe error:', e);
        if (mounted) setError('โหลดข้อมูลไม่สำเร็จ');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [recipeId]);

  const ingredients = useMemo(() => Array.isArray(recipe?.ingredients) ? recipe.ingredients : [], [recipe]);
  const seasonings = useMemo(() => Array.isArray(recipe?.seasonings) ? recipe.seasonings : [], [recipe]);
  const tools = useMemo(() => Array.isArray(recipe?.tools) ? recipe.tools : [], [recipe]);
  const steps = useMemo(() => Array.isArray(recipe?.steps) ? recipe.steps : [], [recipe]);
  const tags = useMemo(() => Array.isArray(recipe?.tags) ? recipe.tags : [], [recipe]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8, color: '#666' }}>กำลังโหลดข้อมูล…</Text>
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View style={styles.centered}>
        <Text>{error || 'ไม่พบข้อมูลสูตรอาหาร'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 10 }}>
          <Text style={{ color: '#2c7', fontWeight: '600' }}>ย้อนกลับ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {recipe.title || 'ไม่มีชื่อเมนู'}
        </Text>
      </View>

      <Image
        source={recipe.imageUrl ? { uri: recipe.imageUrl } : require('../../assets/images/sample-food.jpg')}
        style={styles.image}
      />

      {!!recipe.description && (
        <Text style={styles.description}>{recipe.description}</Text>
      )}

      {ingredients.length > 0 && (
        <>
          <Text style={styles.subheading}>วัตถุดิบ</Text>
          {ingredients.map((i, idx) => (
            <Text key={idx} style={styles.textItem}>
              • {i?.name ?? '-'}{i?.qty ? ` - ${i.qty}` : ''}{i?.unit ? ` ${i.unit}` : ''}
            </Text>
          ))}
        </>
      )}

      {seasonings.length > 0 && (
        <>
          <Text style={styles.subheading}>เครื่องปรุง</Text>
          {seasonings.map((s, idx) => (
            <Text key={idx} style={styles.textItem}>• {String(s)}</Text>
          ))}
        </>
      )}

      {tools.length > 0 && (
        <>
          <Text style={styles.subheading}>อุปกรณ์</Text>
          {tools.map((t, idx) => (
            <Text key={idx} style={styles.textItem}>• {String(t)}</Text>
          ))}
        </>
      )}

      {steps.length > 0 && (
        <>
          <Text style={styles.subheading}>ขั้นตอน</Text>
          {steps.map((s, idx) => (
            <Text key={idx} style={styles.textItem}>ขั้นที่ {idx + 1}: {String(s)}</Text>
          ))}
        </>
      )}

      {tags.length > 0 && (
        <View style={styles.tagContainer}>
          {tags.map((tag, idx) => (
            <Text key={idx} style={styles.tag}>{String(tag)}</Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 10, color: '#2c3e50', flex: 1 },
  image: { width: '100%', height: 220, borderRadius: 10, marginBottom: 10, backgroundColor: '#eee' },
  description: { fontSize: 14, color: '#555', marginBottom: 10 },
  subheading: { fontWeight: 'bold', marginTop: 10, marginBottom: 4, color: '#6a994e' },
  textItem: { fontSize: 14, color: '#333', marginBottom: 2 },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  tag: {
    backgroundColor: '#dff0d8', color: '#2e7d32',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, marginRight: 8, marginBottom: 6, fontSize: 12
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
});
