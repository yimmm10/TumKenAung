// screens/vendor/VendorProfileScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Button } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseconfig';
import styles from '../SharedStyles';

export default function VendorProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const uid = auth.currentUser.uid;
      const snap = await getDoc(doc(db, 'vendors', uid));
      setProfile(snap.exists() ? snap.data() : {});
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <ActivityIndicator style={styles.container} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{profile.name || 'ชื่อร้านค้า'}</Text>
      <Text>ที่อยู่: {profile.address}</Text>
      <Text>เบอร์ติดต่อ: {profile.phone}</Text>
      <Button title="ออกจากระบบ" onPress={() => auth.signOut()} />
    </View>
  );
}
