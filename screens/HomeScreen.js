// HomeScreen.js
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#556b2f" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="ios-restaurant" size={24} color="white" style={{ marginRight: 8 }} />
        <Text style={styles.headerText}>ทำกินเอง</Text>
        <View style={styles.notifIcon}>
          <Ionicons name="notifications-outline" size={24} color="white" />
          <View style={styles.badge}><Text style={styles.badgeText}>3</Text></View>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Section: Suggested Recipes */}
        <Text style={styles.sectionTitle}>สูตรอาหารแนะนำ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
          {[{
            name: 'Spaghetti Aglio E Olio',
            image: require('../assets/images/spaghetti.png'),
          }, {
            name: 'ผัดกะเพราหมูสับ',
            image: require('../assets/images/sample-food.jpg'),
          }, {
            name: 'ลาบหมู',
            image: require('../assets/images/sample-food.jpg'),
          }].map((item, idx) => (
            <View style={styles.recipeCard} key={idx}>
              <Image source={item.image} style={styles.recipeImageLarge} resizeMode="cover" />
              <Text style={styles.recipeTitle}>{item.name}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Section: เมนูลัด */}
        <Text style={styles.sectionTitle}>เมนูลัด</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickMenu}>
          {[
            { label: 'เพิ่มวัตถุดิบ', icon: 'add-circle-outline' },
            { label: 'เพิ่มสูตรอาหาร', icon: 'library-add' },
            { label: 'ไอเดียแคลอรี่', icon: 'notebook' },
            { label: 'สูตรที่บันทึกไว้', icon: 'favorite-border' },
            { label: 'เมนูโปรด', icon: 'book' },
          ].map((item, idx) => (
            <TouchableOpacity style={styles.quickItemHorizontal} key={idx}>
              <MaterialIcons name={item.icon} size={30} color="#4e752a" />
              <Text style={styles.quickText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Section: วัตถุดิบใกล้หมดอายุ */}
        <Text style={styles.sectionTitle}>วัตถุดิบใกล้หมดอายุ</Text>
        <View style={styles.ingredientCard}>
          <Image source={require('../assets/images/eggs.jpg')} style={styles.ingredientImage} />
          <View>
            <Text style={{ fontWeight: 'bold', color: '#e67e22' }}>ไข่ไก่</Text>
            <Text>6 ฟอง</Text>
            <Text>หมดอายุ: 9 ก.ค. 2025</Text>
          </View>
        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fefae0' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#556b2f', padding: 15, justifyContent: 'space-between' },
  headerText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  notifIcon: { position: 'relative' },
  badge: { position: 'absolute', top: -6, right: -6, backgroundColor: 'red', borderRadius: 10, paddingHorizontal: 5 },
  badgeText: { color: 'white', fontSize: 10 },
  scrollView: { padding: 15 },
  sectionTitle: { fontWeight: 'bold', fontSize: 16, marginVertical: 10, color: '#d35400' },
  horizontalList: { flexDirection: 'row' },
  recipeCard: { marginRight: 12, width: width * 0.5 },
  recipeImageLarge: { width: '100%', height: 120, borderRadius: 10 },
  recipeTitle: { marginTop: 5, textAlign: 'center' },
  quickMenu: { flexDirection: 'row', marginVertical: 10 },
  quickItemHorizontal: { alignItems: 'center', marginRight: 20 },
  quickText: { textAlign: 'center', marginTop: 5 },
  ingredientCard: { flexDirection: 'row', backgroundColor: '#fff6e5', padding: 10, borderRadius: 8, alignItems: 'center' },
  ingredientImage: { width: 60, height: 60, marginRight: 10 },
  tabBar: { flexDirection: 'row', justifyContent: 'space-around', padding: 10, backgroundColor: '#556b2f' },
});