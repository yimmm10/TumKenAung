import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';

import HomeScreen from '../screens/User/HomeScreen';
import FridgeScreen from '../screens/User/FridgeScreen';
import SavedRecipesScreen from '../screens/User/SavedRecipesScreen';
import CameraScreen from '../screens/User/CameraScreen';
import ProfileScreen from '../screens/User/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const user = getAuth().currentUser;
  const userId = user?.uid;

  if (!userId) {
    console.warn('⚠️ ไม่พบ userId จาก Firebase Auth');
    return null;
  }

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#0066CC',
        tabBarInactiveTintColor: '#888',
        tabBarLabelStyle: { fontSize: 12 },
        tabBarStyle: { height: 60, paddingBottom: 5 },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Home: 'home-variant-outline',
            Fridge: 'fridge-outline',
            SavedRecipes: 'book-outline',
            Camera: 'camera-outline',
            Profile: 'account-outline',
          };
          return (
            <MaterialCommunityIcons
              name={icons[route.name] || 'help-circle-outline'}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'หน้าแรก' }} initialParams={{ userId }} />
      <Tab.Screen name="Fridge" component={FridgeScreen} options={{ title: 'ตู้เย็น' }} initialParams={{ userId }} />
      <Tab.Screen name="SavedRecipes" component={SavedRecipesScreen} options={{ title: 'สูตรที่บันทึก' }} initialParams={{ userId }} />
      <Tab.Screen name="Camera" component={CameraScreen} options={{ title: 'สแกนอาหาร' }} initialParams={{ userId }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'โปรไฟล์' }} initialParams={{ userId }} />
    </Tab.Navigator>
  );
}
