<<<<<<< HEAD
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
=======
// navigation/AppNavigator.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen       from '../screens/LoginScreen';
import RegisterScreen    from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import MainTabNavigator  from './MainTabNavigator';        // ฝั่ง User
import AdminTabNavigator from './AdminTabNavigator';       // ฝั่ง Admin
import VendorTabNavigator from './VendorTabNavigator';     // ฝั่ง Vendor
import UserRecipeDetail from '../screens/User/UserRecipeDetail';
import AddEditIngredientScreen from '../screens/User/AddEditIngredientScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Login"    component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'สมัครสมาชิก' }} />
      <Stack.Screen name="Forgot"   component={ForgotPasswordScreen} options={{ title: 'ลืมรหัสผ่าน' }} />
      <Stack.Screen name="Main"     component={MainTabNavigator}   options={{ headerShown: false }} />
      <Stack.Screen name="Admin"    component={AdminTabNavigator}  options={{ headerShown: false }} />
      <Stack.Screen name="Vendor"   component={VendorTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="UserRecipeDetail" component={UserRecipeDetail} options={{ title: 'รายละเอียดเมนู' }} />
      <Stack.Screen name="AddEditIngredient" component={AddEditIngredientScreen} options={{ title: 'เพิ่มของเข้าตู้' }} />

   </Stack.Navigator>
>>>>>>> 3a57b0d (update)
  );
}
