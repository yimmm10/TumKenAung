// screens/vendor/StockManagementScreen.js
import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseconfig';
import styles from '../SharedStyles';

export default function StockManagementScreen() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const snap = await getDocs(collection(db, 'stock'));
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <ActivityIndicator style={styles.container} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <Text>{item.name}: {item.quantity} {item.unit}</Text>
            <TouchableOpacity /* onPress={()=>...} */>
              <Text style={styles.link}>แก้ไข</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}
