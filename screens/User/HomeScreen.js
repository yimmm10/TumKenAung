// HomeScreen.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseconfig';
import { useNavigation } from '@react-navigation/native';

export default function HomeScreen() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'recipes'));
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRecipes(data);
      } catch (error) {
        console.error('เกิดข้อผิดพลาดในการโหลด recipes:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <StatusBar backgroundColor="#556b2f" barStyle="light-content" />

      <View style={styles.header}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
        <Text style={styles.headerText}>ทำกินเอง</Text>
        <Ionicons name="notifications-outline" size={24} color="white" />
      </View>

      <Text style={styles.sectionTitle}>สูตรอาหารแนะนำ</Text>

      {loading ? (
        <Text style={{ textAlign: 'center', marginTop: 20 }}>กำลังโหลด...</Text>
      ) : recipes.length === 0 ? (
        <Text style={{ textAlign: 'center', marginTop: 20, color: '#999' }}>
          ยังไม่มีสูตรอาหารในระบบ
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {recipes.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => navigation.navigate('UserRecipeDetail', { recipe: item })}
              style={styles.recipeCard}
            >
              <Image
                source={item.imageUrl ? { uri: item.imageUrl } : require('../../assets/images/sample-food.jpg')}
                style={styles.recipeImage}
              />
              <Text style={styles.recipeTitle}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fefae0', padding: 15 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#556b2f', padding: 15, justifyContent: 'space-between'
  },
  logo: { width: 24, height: 24, marginRight: 8 },
  headerText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  sectionTitle: {
    fontWeight: 'bold', fontSize: 18,
    marginVertical: 10, color: '#d35400'
  },
  recipeCard: {
    marginRight: 12, width: 160, alignItems: 'center'
  },
  recipeImage: {
    width: 160, height: 100, borderRadius: 10,
    resizeMode: 'cover'
  },
  recipeTitle: {
    marginTop: 5, fontWeight: 'bold', fontSize: 14, color: '#333'
  }
});
