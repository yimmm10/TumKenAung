import React from 'react';
import { Platform, StatusBar, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import S from './VendorStyles';


export default function VendorScreen({
  children,
  scroll = false,
  contentStyle = {},
  style = {},
  edges = ['top', 'left', 'right', 'bottom'], // กันชนรอบด้าน
}) {
  const androidInset = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;

  const Container = scroll ? ScrollView : View;
  const containerProps = scroll
    ? { contentContainerStyle: [{ paddingHorizontal: 16, paddingBottom: 24 }, contentStyle] }
    : { style: [{ paddingHorizontal: 16, paddingBottom: 24 }, contentStyle] };

  return (
    <SafeAreaView edges={edges} style={[S.screen, { paddingTop: androidInset }, style]}>
      <Container {...containerProps}>
        {children}
      </Container>
    </SafeAreaView>
  );
}
