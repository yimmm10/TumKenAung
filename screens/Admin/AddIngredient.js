// screens/Admin/AddIngredientScreen.js
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { collection, addDoc, updateDoc, serverTimestamp, doc } from 'firebase/firestore';
import { db } from '../../firebaseconfig';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function AddIngredientScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const route      = useRoute();
  const existing   = route.params?.item;
  const isEdit     = !!existing;

  const [name, setName]         = useState(existing?.name  || '');
  const [unitsText, setUnitsText] = useState(existing?.units.join(',') || '');
  const [loading, setLoading]   = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      return Alert.alert('กรุณากรอกชื่อวัตถุดิบ');
    }
    const units = unitsText.split(',').map(u => u.trim()).filter(u => u);
    if (units.length === 0) {
      return Alert.alert('กรุณากรอกอย่างน้อย 1 หน่วย (คั่นด้วยคอมมา)');
    }
    setLoading(true);
    try {
      if (isEdit) {
        const ref = doc(db,'ingredientOptions', existing.id);
        await updateDoc(ref, { name: name.trim(), units });
      } else {
        await addDoc(collection(db,'ingredientOptions'), {
          name:       name.trim(),
          units,
          createdAt:  serverTimestamp(),
        });
      }
      navigation.goBack();
    } catch(e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={{ paddingBottom:40 }}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={20} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>แก้ไขวัตถุดิบ</Text>
        </View>

        <Text style={styles.label}>ชื่อวัตถุดิบ</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="เช่น เนื้อไก่"
        />

        <Text style={styles.label}>หน่วยที่รองรับ (คั่นด้วยคอมมา)</Text>
        <TextInput
          style={styles.input}
          value={unitsText}
          onChangeText={setUnitsText}
          placeholder="เช่น กรัม,กิโลกรัม,ชิ้น"
        />

        <TouchableOpacity
          style={[styles.button, loading && { opacity:0.6 }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>{isEdit ? 'บันทึกการแก้ไข' : 'เพิ่ม'}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex:1, backgroundColor:'#FFFBEF', paddingHorizontal:16 },
  header:       { fontSize:20, fontWeight:'bold', color:'#333', marginBottom:16 },
  label:        { fontSize:14, color:'#555', marginTop:12, marginBottom:6 },
  input:        {
                  backgroundColor:'#fff', borderRadius:6, padding:12,
                  fontSize:14, borderWidth:1, borderColor:'#ddd'
                 },
  button:       {
                  backgroundColor:'#4CAF50', borderRadius:8,
                  paddingVertical:14, alignItems:'center', marginTop:24
                 },
  buttonText:   { color:'#fff', fontSize:16, fontWeight:'bold' },
  header:      { flexDirection:'row', alignItems:'center', marginBottom:16 },
  backBtn:     { width:36,height:36,borderRadius:18,backgroundColor:'#fff',
                 justifyContent:'center',alignItems:'center',elevation:2 },
  headerTitle: { fontSize:18,fontWeight:'bold',color:'#333',marginLeft:8 },
});
