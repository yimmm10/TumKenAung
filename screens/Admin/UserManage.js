// screens/UserManagementScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { db } from '../../firebaseconfig';
import { collection, getDocs } from 'firebase/firestore';
import styles from '../SharedStyles';

export default function UserManagementScreen() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      const snap = await getDocs(collection(db, 'users'));
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(list);
      setLoading(false);
    }
    fetchUsers();
  }, []);

  if (loading) return <ActivityIndicator style={styles.container} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>จัดการผู้ใช้</Text>
      <FlatList
        data={users}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <Text>{item.username} ({item.role})</Text>
            <TouchableOpacity /* onPress={() => blockUser(item.id)} */>
              <Text style={styles.link}>บล็อก</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}
