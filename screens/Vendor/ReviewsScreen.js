// screens/vendor/ReviewsScreen.js
import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, ActivityIndicator } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseconfig';
import styles from '../SharedStyles';

export default function ReviewsScreen() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const snap = await getDocs(collection(db, 'reviews'));
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <ActivityIndicator style={styles.container} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={reviews}
        keyExtractor={r => r.id}
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <Text>ลูกค้า: {item.userName}</Text>
            <Text>ให้คะแนน: {item.rating} ⭐</Text>
            <Text>ความคิดเห็น: {item.comment}</Text>
          </View>
        )}
      />
    </View>
  );
}
