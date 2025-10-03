// screens/Admin/Dashboard.js (aka AdminDashboardScreen.js)
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, ScrollView,
  StyleSheet, Alert, RefreshControl, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  collection, query, where, getCountFromServer, getDocs, updateDoc, doc,
  serverTimestamp, deleteDoc
} from 'firebase/firestore';
import { auth, db } from '../../firebaseconfig';

const REQUIRED_COMMON = ['name','address','phone','openHours','photoURL','lat','lng'];
const REQUIRED_WHOLESALE_EXTRA = ['deliveryBaseFee','deliveryPerKm'];
const TH_LABELS = {
  name:'ชื่อร้าน', address:'ที่อยู่', phone:'เบอร์โทร', openHours:'เวลาทำการ',
  photoURL:'รูปโปรไฟล์ร้าน', lat:'ละติจูด (lat)', lng:'ลองจิจูด (lng)',
  deliveryBaseFee:'ค่าส่งพื้นฐาน', deliveryPerKm:'ค่าส่งต่อกม.'
};

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [counts, setCounts] = useState({ users: 0, recipes: 0, vendors: 0, reports: 0 });
  const [pendingRecipes, setPendingRecipes] = useState([]);
  const [pendingVendors, setPendingVendors] = useState([]);
  const [commentReports, setCommentReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Summary
      const userQ = query(collection(db, 'users'), where('role', '==', 'user'));
      const venUserQ = query(collection(db, 'users'), where('role', '==', 'vendor'));
      const reportQ = query(collection(db, 'commentReports'), where('status', '==', 'pending'));
      
      const [uSnap, rSnap, vSnap, reportSnap] = await Promise.all([
        getCountFromServer(userQ),
        getCountFromServer(collection(db, 'recipes')),
        getCountFromServer(venUserQ),
        getCountFromServer(reportQ),
      ]);
      
      setCounts({
        users: uSnap.data().count,
        recipes: rSnap.data().count,
        vendors: vSnap.data().count,
        reports: reportSnap.data().count,
      });

      // 2) Pending recipes
      const pendingQ = query(collection(db, 'recipes'), where('status', '==', 'pending'));
      const pendingSnap = await getDocs(pendingQ);
      setPendingRecipes(pendingSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // 3) Pending vendors (approved !== true)
      const venSnap = await getDocs(collection(db, 'vendors'));
      const vendorsAll = venSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const pending = vendorsAll.filter(v => v.approved !== true);
      setPendingVendors(pending);

      // 4) Comment Reports
      const reportsSnap = await getDocs(reportQ);
      const reports = reportsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.timestamp?.seconds || 0;
          const tb = b.timestamp?.seconds || 0;
          return tb - ta; // ใหม่→เก่า
        });
      setCommentReports(reports);
      
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, [loadAll]);

  // ===== Approve logic =====
  const findMissing = (v, wholesale = false) => {
    const required = wholesale ? [...REQUIRED_COMMON, ...REQUIRED_WHOLESALE_EXTRA] : REQUIRED_COMMON;
    const missing = [];
    for (const key of required) {
      const val = v[key];
      if (key === 'lat' || key === 'lng') {
        if (typeof val !== 'number' || Number.isNaN(val)) missing.push(key);
      } else if (val === undefined || val === null || String(val).trim?.() === '') {
        missing.push(key);
      }
    }
    return missing;
  };

  const approveVendor = async (vendor, type = 'retail') => {
    const isWholesale = type === 'wholesale';
    const missing = findMissing(vendor, isWholesale);

    if (missing.length > 0) {
      const list = missing.map(k => `• ${TH_LABELS[k] || k}`).join('\n');
      Alert.alert('ข้อมูลไม่ครบถ้วน',
        `ไม่สามารถอนุมัติได้ เนื่องจากยังขาดข้อมูลต่อไปนี้:\n\n${list}\n\nโปรดแจ้งร้านค้าให้กรอกข้อมูลให้ครบก่อนครับ`);
      return;
    }

    try {
      await updateDoc(doc(db, 'vendors', vendor.id), {
        approved: true,
        approvedType: isWholesale ? 'wholesale' : 'retail',
        wholesaleApproved: isWholesale ? true : (vendor.wholesaleApproved || false),
        approvedAt: serverTimestamp(),
        approvedBy: auth.currentUser?.uid || 'admin',
      });
      setPendingVendors(prev => prev.filter(v => v.id !== vendor.id));
      Alert.alert('สำเร็จ', `อนุมัติร้าน "${vendor.name || vendor.id}" แล้ว`);
    } catch (e) {
      console.error(e);
      Alert.alert('ผิดพลาด', 'ไม่สามารถอนุมัติร้านได้');
    }
  };

  // ===== Pending recipes approve/reject (ของเดิม) =====
  const handleApproveRecipe = async (id) => {
    try {
      await updateDoc(doc(db, 'recipes', id), { status: 'approved' });
      setPendingRecipes(ps => ps.filter(r => r.id !== id));
    } catch (e) { console.error(e); }
  };
  const handleRejectRecipe = async (id) => {
    try {
      await updateDoc(doc(db, 'recipes', id), { status: 'rejected' });
      setPendingRecipes(ps => ps.filter(r => r.id !== id));
    } catch (e) { console.error(e); }
  };

  // ===== Comment Report Functions =====
  const handleDeleteComment = async (report) => {
    Alert.alert(
      'ลบความคิดเห็น',
      'คุณต้องการลบความคิดเห็นนี้หรือไม่? การดำเนินการนี้ไม่สามารถยกเลิกได้',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              // ลบความคิดเห็น
              await deleteDoc(doc(db, 'comments', report.commentId));
              
              // อัปเดตสถานะรายงาน
              await updateDoc(doc(db, 'commentReports', report.id), {
                status: 'reviewed',
                action: 'deleted',
                reviewedAt: serverTimestamp(),
                reviewedBy: auth.currentUser?.uid || 'admin',
              });

              // อัปเดต state
              setCommentReports(prev => prev.filter(r => r.id !== report.id));
              setCounts(prev => ({ ...prev, reports: prev.reports - 1 }));
              
              Alert.alert('สำเร็จ', 'ลบความคิดเห็นแล้ว');
            } catch (error) {
              console.error('Delete comment error:', error);
              Alert.alert('ผิดพลาด', 'ไม่สามารถลบความคิดเห็นได้');
            }
          },
        },
      ]
    );
  };

  const handleDismissReport = async (report) => {
    Alert.alert(
      'ปฏิเสธรายงาน',
      'คุณต้องการปฏิเสธรายงานนี้หรือไม่? ความคิดเห็นจะยังคงอยู่',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ปฏิเสธ',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'commentReports', report.id), {
                status: 'dismissed',
                reviewedAt: serverTimestamp(),
                reviewedBy: auth.currentUser?.uid || 'admin',
              });

              // อัปเดต state
              setCommentReports(prev => prev.filter(r => r.id !== report.id));
              setCounts(prev => ({ ...prev, reports: prev.reports - 1 }));
              
              Alert.alert('สำเร็จ', 'ปฏิเสธรายงานแล้ว');
            } catch (error) {
              console.error('Dismiss report error:', error);
              Alert.alert('ผิดพลาด', 'ไม่สามารถปฏิเสธรายงานได้');
            }
          },
        },
      ]
    );
  };

  const formatReportTime = (timestamp) => {
    if (!timestamp?.seconds) return '';
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString('th-TH');
  };

  const handleLogout = async () => {
    try { await auth.signOut(); navigation.replace('Login'); }
    catch (e) { console.error(e); }
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
      style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}
      contentContainerStyle={{ paddingHorizontal: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
          <Text style={styles.cardLabel}>ร้านค้า</Text>
          <Text style={styles.cardValue}>{counts.vendors}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>รายงานรอตรวจ</Text>
          <Text style={[styles.cardValue, { color: counts.reports > 0 ? '#ef4444' : '#769128' }]}>
            {counts.reports}
          </Text>
        </View>
      </View>

      {/* Comment Reports Section */}
      <Text style={styles.sectionTitle}>รายงานความคิดเห็น ({commentReports.length})</Text>
      {commentReports.length === 0 ? (
        <Text style={styles.emptyText}>ไม่มีรายงานรอตรวจสอบ</Text>
      ) : commentReports.map(report => (
        <View key={report.id} style={styles.reportCard}>
          <View style={styles.reportHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.reportTitle}>
                รายงานโดย: {report.reportedByName || 'ผู้ใช้'}
              </Text>
              <Text style={styles.reportMeta}>
                เวลา: {formatReportTime(report.timestamp)}
              </Text>
              <Text style={styles.reportMeta}>
                ผู้แต่งความคิดเห็น: {report.commentAuthor || 'ผู้ใช้'}
              </Text>
            </View>
            <View style={styles.reportBadge}>
              <Ionicons name="flag" size={16} color="#ef4444" />
            </View>
          </View>
          
          <View style={styles.commentPreview}>
            <Text style={styles.commentPreviewLabel}>ความคิดเห็นที่ถูกรายงาน:</Text>
            <Text style={styles.commentPreviewText} numberOfLines={3}>
              "{report.commentText}"
            </Text>
          </View>

          <View style={styles.reportActions}>
            <TouchableOpacity
              style={[styles.btn, styles.deleteBtn]}
              onPress={() => handleDeleteComment(report)}
            >
              <Ionicons name="trash-outline" size={16} color="#fff" />
              <Text style={styles.btnText}>ลบความคิดเห็น</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.dismissBtn]}
              onPress={() => handleDismissReport(report)}
            >
              <Ionicons name="close-outline" size={16} color="#fff" />
              <Text style={styles.btnText}>ปฏิเสธรายงาน</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* Pending Vendors */}
      <Text style={styles.sectionTitle}>ร้านค้ารออนุมัติ ({pendingVendors.length})</Text>
      {pendingVendors.length === 0 ? (
        <Text style={styles.emptyText}>ไม่มีร้านค้ารออนุมัติ</Text>
      ) : pendingVendors.map(v => (
        <View key={v.id} style={styles.pendingCard}>
          {/* <- แตะส่วนหัวการ์ดเพื่อเข้าหน้ารายละเอียดร้าน (แอดมิน) */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AdminVendorShop', { vendorId: v.id })}
            style={{ flexDirection:'row', alignItems:'center' }}
          >
            {v.photoURL ? (
              <Image source={{ uri: v.photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { justifyContent:'center', alignItems:'center', backgroundColor:'#FFF3CC' }]}>
                <Text>🏪</Text>
              </View>
            )}
            <View style={{ flex:1, marginLeft:10 }}>
              <Text style={styles.pendingTitle}>{v.name || '— ไม่มีชื่อร้าน —'}</Text>
              <Text style={styles.pendingMeta}>
                {typeof v.lat === 'number' && typeof v.lng === 'number'
                  ? `พิกัด: ${v.lat.toFixed(5)}, ${v.lng.toFixed(5)}`
                  : 'พิกัด: —'}
              </Text>
              <Text style={styles.pendingMeta}>โทร: {v.phone || '—'} | เวลา: {v.openHours || '—'}</Text>
              <Text style={styles.pendingMeta} numberOfLines={2}>ที่อยู่: {v.address || '—'}</Text>
            </View>
          </TouchableOpacity>

          {/* ปุ่มอนุมัติเดิมคงไว้ */}
          <View style={styles.pendingActions}>
            <TouchableOpacity
              style={[styles.btn, styles.approveBtn]}
              onPress={() => approveVendor(v, 'retail')}
            >
              <Text style={styles.btnText}>อนุมัติ</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* Pending Recipes (เดิม) */}
      <Text style={styles.sectionTitle}>สูตรรออนุมัติ ({pendingRecipes.length})</Text>
      {pendingRecipes.length === 0 ? (
        <Text style={styles.emptyText}>ไม่มีสูตรรออนุมัติ</Text>
      ) : pendingRecipes.map(item => (
        <View key={item.id} style={styles.pendingCard}>
          <Text style={styles.pendingTitle}>{item.title}</Text>
          <View style={styles.pendingActions}>
            <TouchableOpacity
              style={[styles.btn, styles.approveBtn]}
              onPress={() => handleApproveRecipe(item.id)}
            >
              <Text style={styles.btnText}>อนุมัติ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.rejectBtn]}
              onPress={() => handleRejectRecipe(item.id)}
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
  container: { flex: 1, backgroundColor: '#FFFBEF' },
  loading: { flex:1, justifyContent:'center', alignItems:'center' },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:16 },
  title: { fontSize:20, fontWeight:'bold', color:'#333' },
  logoutBtn: { padding:4 },
  cardsContainer: { flexDirection:'row', justifyContent:'space-between', marginBottom:24, flexWrap: 'wrap' },
  card: { 
    flex:1, 
    minWidth: '22%',
    backgroundColor:'#FFF8E1', 
    borderRadius:8, 
    padding:12, 
    margin:2, 
    alignItems:'center' 
  },
  cardLabel: { fontSize:12, color:'#555', marginBottom:4, textAlign:'center' },
  cardValue: { fontSize:18, fontWeight:'bold', color:'#769128' },
  sectionTitle: { fontSize:18, fontWeight:'bold', marginBottom:12, marginTop:8, color:'#333' },
  emptyText: { color:'#888', marginBottom:16 },

  // Report Cards
  reportCard: { 
    backgroundColor:'#FFFFFF', 
    borderRadius:8, 
    padding:16, 
    marginBottom:12, 
    elevation:2,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444'
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reportTitle: { fontSize:16, fontWeight:'600', color:'#333', marginBottom:4 },
  reportMeta: { color:'#666', fontSize:12, marginBottom:2 },
  reportBadge: {
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    padding: 8,
  },
  commentPreview: {
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  commentPreviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  commentPreviewText: {
    color: '#6b7280',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  reportActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },

  // Existing styles
  pendingCard: { backgroundColor:'#FFFFFF', borderRadius:8, padding:12, marginBottom:12, elevation:2 },
  pendingTitle: { fontSize:16, fontWeight:'600', color:'#333', marginBottom:4 },
  pendingMeta: { color:'#666', fontSize:12 },
  pendingActions: { flexDirection:'row', justifyContent:'flex-end', marginTop:10 },
  btn: { 
    paddingVertical:8, 
    paddingHorizontal:12, 
    borderRadius:6, 
    marginLeft:8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  approveBtn: { backgroundColor:'#4CAF50' },
  wholesaleBtn: { backgroundColor:'#8E44AD' },
  rejectBtn: { backgroundColor:'#F44336' },
  deleteBtn: { backgroundColor:'#ef4444' },
  dismissBtn: { backgroundColor:'#6b7280' },
  btnText: { color:'#fff', fontSize:14 },

  avatar: { width:48, height:48, borderRadius:8, backgroundColor:'#EEE' },
});