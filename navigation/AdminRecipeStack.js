// navigation/AdminRecipeStack.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RecipeManage from '../screens/Admin/RecipeManage';
import AddRecipe    from '../screens/Admin/AddRecipe';
import RecipeDetail from '../screens/Admin/RecipeDetail';

const Stack = createNativeStackNavigator();

export default function AdminRecipeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="RecipeManage"      // หน้านี้เป็น initial
        component={RecipeManage}
      />
      <Stack.Screen
        name="AddRecipe"         // navigate('AddRecipe')
        component={AddRecipe}
      />
      <Stack.Screen
        name="RecipeDetail"
        component={RecipeDetail}
      />
    </Stack.Navigator>
  );
}
