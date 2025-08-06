// screens/vendor/OrdersScreen.js
import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseconfig';
import styles from '../SharedStyles';

export default function OrdersScreen() {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const snap = await getDocs(collection(db, 'orders'));
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <ActivityIndicator style={styles.container} />;

  const renderItem = ({ item }) => (
    <View style={styles.listItem}>
      <Text>#{item.id} - {item.customerName}</Text>
      <Text>สถานะ: {item.status}</Text>
      <TouchableOpacity /* onPress={()=>...} */>
        <Text style={styles.link}>รายละเอียด</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={i => i.id}
        renderItem={renderItem}
      />
    </View>
  );
}
