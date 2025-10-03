// navigation/MainTabNavigator.js
import React from 'react';
import { Text, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'; // ⬅️ เพิ่มบรรทัดนี้
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/User/HomeScreen';
import FridgeScreen from '../screens/User/FridgeScreen';
import SavedRecipesScreen from '../screens/User/SavedRecipesScreen';
import CameraScreen from '../screens/User/CameraScreen';
import ProfileScreen from '../screens/User/ProfileScreen';
import Buy from '../screens/User/Buy';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();

  const getIconName = (routeName) => {
    switch (routeName) {
      case 'Home':
        return 'home-outline';
      // ❗️ลบ 'Fridge' ออกจากตรงนี้ เพราะจะเรนเดอร์ด้วย MDI ด้านล่าง
      case 'SavedRecipes':
        return 'bookmark-outline';
      case 'Buy':
        return Platform.OS === 'android' ? 'cart' : 'cart-outline';
      case 'Profile':
        return 'person-outline';
      case 'Camera':
        return 'camera-outline';
      default:
        return 'ellipse-outline';
    }
  };

  const getLabel = (routeName) => {
    switch (routeName) {
      case 'Home':
        return 'หน้าแรก';
      case 'Fridge':
        return 'ตู้เย็น';
      case 'SavedRecipes':
        return 'สูตรที่บันทึก';
      case 'Buy':
        return 'ซื้อวัตถุดิบ';
      case 'Profile':
        return 'โปรไฟล์';
      default:
        return routeName;
    }
  };

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#FBDB58',
        tabBarInactiveTintColor: '#888',
        backgroundColor: '#425010',
        tabBarShowLabel: true,
        tabBarLabel: ({ color }) => (
          <Text style={{ color, fontSize: 12, }} numberOfLines={1}>
            {getLabel(route.name)}
          </Text>
        ),
        tabBarStyle: {
          height: 58 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
        },
        tabBarHideOnKeyboard: false,
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Fridge') {
            return <MaterialCommunityIcons name="fridge-variant-outline" size={size} color={color} />;
          }
          const iconName = getIconName(route.name);
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'หน้าแรก' }} />
      <Tab.Screen name="Fridge" component={FridgeScreen} options={{ title: 'ตู้เย็น' }} />
      <Tab.Screen name="SavedRecipes" component={SavedRecipesScreen} options={{ title: 'สูตรที่บันทึก' }} />
      <Tab.Screen name="Buy" component={Buy} options={{ title: 'ซื้อวัตถุดิบ', tabBarLabel: 'ซื้อวัตถุดิบ' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'โปรไฟล์' }} />
      {/* <Tab.Screen name="Camera" component={CameraScreen} options={{ title: 'กล้อง' }} /> */}
    </Tab.Navigator>
  );
}
