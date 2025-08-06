// screens/Admin/IngredientManagementScreen.js
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebaseconfig';
import { TextInput } from 'react-native';

export default function IngredientManagementScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const isFocused  = useIsFocused();
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch on mount / focus
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, 'ingredientOptions'));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (active) setItems(list);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false };
  }, [isFocused]);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.units}>Units: {item.units.join(', ')}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate('AddIngredient', { item })}
        >
          <Ionicons name="create-outline" size={20} color="#0066CC" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.delBtn}
          onPress={async () => {
            await deleteDoc(doc(db,'ingredientOptions',item.id));
            setItems(prev => prev.filter(x => x.id !== item.id));
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#E53935" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>จัดการวัตถุดิบ</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddIngredient')}
        >
          <Ionicons name="add-circle-outline" size={28} color="#4CAF50" />
        </TouchableOpacity>
      </View>

        <TextInput
            style={{
                backgroundColor:'#fff',
                borderRadius:6,
                paddingHorizontal:12,
                paddingVertical:8,
                marginHorizontal:16,
                marginBottom:12,
                borderWidth:1,
                borderColor:'#ddd'
            }}
            placeholder="ค้นหาวัตถุดิบ..."
            value={searchQuery}
            onChangeText={setSearchQuery}
        />

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#0066CC" />
      ) : (
        <FlatList
          data={items.filter(i =>
            i.name.toLowerCase().includes(searchQuery.toLowerCase())
        )}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 30 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#FFFBEF', paddingHorizontal:16 },
  headerRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  title:    { fontSize:20, fontWeight:'bold', color:'#333' },
  addBtn:   { padding:4 },
  loader:   { flex:1, justifyContent:'center' },
  card:     { backgroundColor:'#fff', borderRadius:8, padding:12, flexDirection:'row', alignItems:'center', marginBottom:12, elevation:2 },
  info:     { flex:1 },
  name:     { fontSize:16, fontWeight:'600', color:'#333' },
  units:    { fontSize:14, color:'#666', marginTop:4 },
  actions:  { flexDirection:'row' },
  editBtn:  { marginRight:16 },
  delBtn:   {},
});
