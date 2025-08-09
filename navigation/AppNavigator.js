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
import AddEditRecipeScreen from '../screens/User/AddEditRecipeScreen';
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
      <Stack.Screen name="UserRecipeDetail" component={UserRecipeDetail} options={{ headerShown: false }} />
      <Stack.Screen name="AddEditIngredient" component={AddEditIngredientScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AddEditRecipe" component={AddEditRecipeScreen} options={{ headerShown: false }} />

   </Stack.Navigator>

  );
}
