import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FontAwesome5 } from '@expo/vector-icons';

// หน้าหลัก
import HomeScreen from '../screens/HomeScreen';
import FridgeScreen from '../screens/FridgeScreen';
import SavedRecipesScreen from '../screens/SavedRecipesScreen';
import CameraScreen from '../screens/CameraScreen';
import ProfileScreen from '../screens/ProfileScreen';

import PreviewScreen from '../screens/PreviewScreen'; // 👈 import หน้าใหม่

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ✅ ครอบ TabNavigator ด้วย Stack เพื่อรองรับหน้า Preview
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: '#ccc',
        tabBarStyle: { backgroundColor: '#556b2f' },
        tabBarIcon: ({ color, size }) => {
          let iconName;
          switch (route.name) {
            case 'Home':
              iconName = 'home';
              break;
            case 'Fridge':
              iconName = 'snowflake';
              break;
            case 'SavedRecipes':
              iconName = 'book';
              break;
            case 'Camera':
              iconName = 'camera';
              break;
            case 'Profile':
              iconName = 'user';
              break;
          }
          return <FontAwesome5 name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'หน้าแรก' }} />
      <Tab.Screen name="Fridge" component={FridgeScreen} options={{ title: 'ตู้เย็น' }} />
      <Tab.Screen name="SavedRecipes" component={SavedRecipesScreen} options={{ title: 'สูตรที่บันทึก' }} />
      <Tab.Screen name="Camera" component={CameraScreen} options={{ title: 'สแกนอาหาร' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'โปรไฟล์' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="Preview" component={PreviewScreen} options={{ title: 'ดูภาพ' }} />
        {/*<Stack.Screen name="Camera" component={CameraScreen} options={{ title: 'ถ่ายภาพ' }} /> */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
