// screens/Admin/RecipeManageScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useIsFocused } from '@react-navigation/native';  // :contentReference[oaicite:5]{index=5}
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseconfig';                                // ปรับ path ให้ตรง
import RecipeCard from '../../components/RecipeCard';

export default function RecipeManageScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();                                     // :contentReference[oaicite:6]{index=6}
  const isFocused  = useIsFocused();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    let active = true;
    const fetchRecipes = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'recipes'));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (active) setRecipes(list);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    };
    if (isFocused) fetchRecipes();
    return () => { active = false; };
  }, [isFocused]);

  const filtered = recipes.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>จัดการสูตรอาหาร</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddRecipe')}
        >
          <Text style={styles.addText}>+ เพิ่มสูตรใหม่</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder="ค้นหาสูตร..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0066CC" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>ไม่พบสูตรที่ค้นหา</Text>          {/* :contentReference[oaicite:7]{index=7} */}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              onPress={() => navigation.navigate('RecipeDetail', { recipeId: item.id })}
            />
          )}
          contentContainerStyle={{ paddingBottom: 30 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F0CE',
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#769128',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  addText: {
    color: '#fff',
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    height: 40,
  },
  center: {                                                            // เพิ่มสไตล์สำหรับกึ่งกลาง
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
  },
});
