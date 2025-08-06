// screens/Admin/AdminDashboardScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  collection,
  query,
  where,
  getCountFromServer,
  getDocs,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { auth, db } from '../../firebaseconfig';

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();

  const [counts, setCounts] = useState({ users: 0, recipes: 0, vendors: 0 });
  const [pendingRecipes, setPendingRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // 1. สรุปภาพรวม
        const userQ = query(collection(db, 'users'), where('role', '==', 'user'));
        const venQ = query(collection(db, 'users'), where('role', '==', 'vendor'));
        const [uSnap, rSnap, vSnap] = await Promise.all([
          getCountFromServer(userQ),
          getCountFromServer(collection(db, 'recipes')),
          getCountFromServer(venQ),
        ]);
        setCounts({
          users:   uSnap.data().count,
          recipes: rSnap.data().count,
          vendors: vSnap.data().count,
        });

        // 2. ดึงสูตรที่รออนุมัติ (status === 'pending')
        const pendingQ    = query(collection(db, 'recipes'), where('status', '==', 'pending'));
        const pendingSnap = await getDocs(pendingQ);
        setPendingRecipes(pendingSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleApprove = async (id) => {
    try {
      await updateDoc(doc(db, 'recipes', id), { status: 'approved' });
      setPendingRecipes(ps => ps.filter(r => r.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (id) => {
    try {
      await updateDoc(doc(db, 'recipes', id), { status: 'rejected' });
      setPendingRecipes(ps => ps.filter(r => r.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigation.replace('Login');
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#FFA920" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[
        styles.container,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom }
      ]}
      contentContainerStyle={{ paddingHorizontal: 16 }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>แดชบอร์ดผู้ดูแล</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={24} color="#e74c3c" />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={styles.cardsContainer}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>ผู้ใช้ทั้งหมด</Text>
          <Text style={styles.cardValue}>{counts.users}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>สูตรทั้งหมด</Text>
          <Text style={styles.cardValue}>{counts.recipes}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>ร้านค้าทั้งหมด</Text>
          <Text style={styles.cardValue}>{counts.vendors}</Text>
        </View>
      </View>

      {/* Pending Recipes */}
      <Text style={styles.sectionTitle}>
        สูตรรออนุมัติ ({pendingRecipes.length})
      </Text>
      {pendingRecipes.length === 0 ? (
        <Text style={styles.emptyText}>ไม่มีสูตรรออนุมัติ</Text>
      ) : pendingRecipes.map(item => (
        <View key={item.id} style={styles.pendingCard}>
          <Text style={styles.pendingTitle}>{item.title}</Text>
          <View style={styles.pendingActions}>
            <TouchableOpacity
              style={[styles.btn, styles.approveBtn]}
              onPress={() => handleApprove(item.id)}
            >
              <Text style={styles.btnText}>อนุมัติ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.rejectBtn]}
              onPress={() => handleReject(item.id)}
            >
              <Text style={styles.btnText}>ปฏิเสธ</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#FFFBEF' },
  loading:     { flex:1, justifyContent:'center', alignItems:'center' },
  header:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 },
  title:       { fontSize:20, fontWeight:'bold', color:'#333' },
  logoutBtn:   { padding:4 },
  cardsContainer: { flexDirection:'row', justifyContent:'space-between', marginBottom:24 },
  card:        { flex:1, backgroundColor:'#FFF8E1', borderRadius:8, padding:12, marginHorizontal:4, alignItems:'center' },
  cardLabel:   { fontSize:14, color:'#555', marginBottom:4 },
  cardValue:   { fontSize:24, fontWeight:'bold', color:'#769128' },
  sectionTitle:{ fontSize:18, fontWeight:'bold', marginBottom:12, color:'#333' },
  emptyText:   { color:'#888', marginBottom:16 },
  pendingCard: { backgroundColor:'#FFFFFF', borderRadius:8, padding:12, marginBottom:12, elevation:2 },
  pendingTitle:{ fontSize:16, fontWeight:'600', color:'#333', marginBottom:8 },
  pendingActions: { flexDirection:'row', justifyContent:'flex-end' },
  btn:         { paddingVertical:6, paddingHorizontal:12, borderRadius:6, marginLeft:8 },
  approveBtn:  { backgroundColor:'#4CAF50' },
  rejectBtn:   { backgroundColor:'#F44336' },
  btnText:     { color:'#fff', fontSize:14 },
});
