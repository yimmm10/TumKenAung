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
import ProductDetailScreen from '../screens/User/ProductDetailScreen';
import CartScreen from '../screens/User/CartScreen';
import VendorShopScreen from '../screens/User/VendorShopScreen';
import AdminVendorShopScreen from '../screens/Admin/AdminVendorShopScreen';
import AddEditRecipeScreen from '../screens/User/AddEditRecipeScreen';
import InviteScreen from '../screens/User/InviteScreen';
import MemberItem from '../screens/User/MemberItem';
import OrderHistoryScreen from '../screens/User/OrderHistoryScreen';
import CommentScreen from '../screens/User/CommentScreen';
import FamilyGroupScreen from '../screens/User/FamilyGroupScreen';
import ReviewWriteScreen from '../screens/User/ReviewWriteScreen';

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
      <Stack.Screen name="UserRecipeDetail" component={UserRecipeDetail} options={{ headerShown: false }}  />
      <Stack.Screen name="AddEditIngredient" component={AddEditIngredientScreen} options={{ headerShown: false }}  />
      <Stack.Screen name="AddEditRecipe" component={AddEditRecipeScreen} options={{ headerShown: false }}  />
      <Stack.Screen name="InviteScreen" component={InviteScreen} options={{ headerShown: false }}  />
      <Stack.Screen name="MemberItem" component={MemberItem} options={{ headerShown: false }}  />
      <Stack.Screen name="FamilyGroupScreen" component={FamilyGroupScreen} options={{ headerShown: false }}  />
      
      <Stack.Screen name="CommentScreen" component={CommentScreen} options={{ title: 'ความคิดเห็น' }}  />
      <Stack.Screen name="OrderHistoryScreen" component={OrderHistoryScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="VendorShop" component={VendorShopScreen} options={{ headerShown: true }} />
      <Stack.Screen name="Reviews" component={ReviewWriteScreen} options={{ headerShown: true }} />
      <Stack.Screen name="AdminVendorShop" component={AdminVendorShopScreen} options={{ title: 'รายละเอียดร้าน (แอดมิน)' }}/>
   </Stack.Navigator>
  );
}
