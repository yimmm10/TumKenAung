// screens/User/InviteScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseconfig';

export default function InviteScreen({ navigation }) {
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [groupId, setGroupId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [groupCode, setGroupCode] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      Alert.alert('ไม่พบผู้ใช้งาน', 'กรุณาเข้าสู่ระบบใหม่');
      navigation.navigate('Login');
      return;
    }

    setUserId(user.uid);
    loadUserData(user.uid);
  }, []);

  const loadUserData = async (uid) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const gid = userData.groupId;

        if (gid) {
          setGroupId(gid);
          await loadGroupData(gid, uid);
        } else {
          setGroupId(null);
          setUserRole(null);
          setGroupMembers([]);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupData = async (gid, uid) => {
    try {
      const groupRef = doc(db, 'groups', gid);
      const groupSnap = await getDoc(groupRef);

      if (groupSnap.exists()) {
        const groupData = groupSnap.data();
        setGroupCode(groupData.groupCode || gid);
      }

      // ฟังการเปลี่ยนแปลงของสมาชิก
      const membersRef = collection(db, 'groups', gid, 'members');
      const unsubscribe = onSnapshot(membersRef, (snapshot) => {
        const membersList = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        
        setGroupMembers(membersList);
        
        const myRole = membersList.find(m => m.id === uid)?.role;
        setUserRole(myRole);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading group data:', error);
    }
  };

  const goToFamilyGroup = () => {
    navigation.navigate('FamilyGroupScreen');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>จัดการกลุ่ม</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#F7F0CE" />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>จัดการกลุ่ม</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 30 }}>
          {groupId ? (
            // มีกลุ่มอยู่แล้ว - แสดงข้อมูลสรุป
            <View style={styles.groupSummaryCard}>
              <View style={styles.summaryHeader}>
                <Ionicons name="people" size={32} color="#425010" />
                <View style={styles.summaryInfo}>
                  <Text style={styles.summaryTitle}>ตู้เย็นกลุ่ม</Text>
                  <Text style={styles.summarySubtitle}>
                    {userRole === 'host' ? 'คุณเป็นเจ้าของกลุ่ม' : 'คุณเป็นสมาชิก'}
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{groupMembers.length}</Text>
                  <Text style={styles.statLabel}>สมาชิก</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statCode}>{groupCode}</Text>
                  <Text style={styles.statLabel}>รหัสกลุ่ม</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.manageButton} onPress={goToFamilyGroup}>
                <Ionicons name="settings-outline" size={20} color="white" />
                <Text style={styles.manageButtonText}>จัดการกลุ่มและสมาชิก</Text>
              </TouchableOpacity>

              <View style={styles.memberPreview}>
                <Text style={styles.previewTitle}>สมาชิกในกลุ่ม ({groupMembers.length})</Text>
                {groupMembers.slice(0, 3).map((member) => (
                  <View key={member.id} style={styles.memberPreviewItem}>
                    <Ionicons 
                      name={member.role === 'host' ? 'star' : 'person'} 
                      size={20} 
                      color={member.role === 'host' ? '#F7F0CE' : '#425010'} 
                    />
                    <Text style={styles.memberPreviewName}>
                      {member.name} {member.id === userId && '(คุณ)'}
                    </Text>
                    {member.role === 'host' && (
                      <View style={styles.hostBadge}>
                        <Text style={styles.hostBadgeText}>เจ้าของ</Text>
                      </View>
                    )}
                  </View>
                ))}
                {groupMembers.length > 3 && (
                  <Text style={styles.moreMembers}>และอีก {groupMembers.length - 3} คน...</Text>
                )}
              </View>
            </View>
          ) : (
            // ยังไม่มีกลุ่ม - แสดงปุ่มสร้าง/เข้าร่วม
            <View style={styles.noGroupContainer}>
              <View style={styles.iconContainer}>
                <Ionicons name="people-outline" size={80} color="#425010" />
              </View>
              <Text style={styles.noGroupTitle}>ยังไม่มีตู้เย็นกลุ่ม</Text>
              <Text style={styles.noGroupDescription}>
                สร้างกลุ่มครอบครัวเพื่อแชร์วัตถุดิบร่วมกัน{'\n'}
                หรือเข้าร่วมกลุ่มที่มีอยู่แล้ว
              </Text>

              <TouchableOpacity style={styles.createGroupButton} onPress={goToFamilyGroup}>
                <Ionicons name="add-circle" size={24} color="white" />
                <Text style={styles.createGroupButtonText}>สร้างหรือเข้าร่วมกลุ่ม</Text>
              </TouchableOpacity>

              <View style={styles.benefitsCard}>
                <Text style={styles.benefitsTitle}>ประโยชน์ของตู้เย็นกลุ่ม</Text>
                <View style={styles.benefitItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#425010" />
                  <Text style={styles.benefitText}>แชร์วัตถุดิบกับคนในครอบครัว</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#425010" />
                  <Text style={styles.benefitText}>เห็นวัตถุดิบของทุกคนในที่เดียว</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#425010" />
                  <Text style={styles.benefitText}>จัดการร่วมกัน ไม่ซื้อของซ้ำ</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="checkmark-circle" size={20} color="#425010" />
                  <Text style={styles.benefitText}>วัตถุดิบของคุณยังเป็นของคุณ</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#425010',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFF8E1',
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#425010',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  
  content: {
    flex: 1,
    padding: 16,
  },
  
  groupSummaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#F7F0CE',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryInfo: {
    marginLeft: 12,
    flex: 1,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#425010',
  },
  summarySubtitle: {
    fontSize: 14,
    color: '#FFF8E1',
    marginTop: 4,
  },
  
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FEF9C3',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F7F0CE',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#425010',
  },
  statCode: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#425010',
    letterSpacing: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  
  manageButton: {
    flexDirection: 'row',
    backgroundColor: '#425010',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  manageButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  memberPreview: {
    borderTopWidth: 1,
    borderTopColor: '#F7F0CE',
    paddingTop: 16,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#425010',
    marginBottom: 12,
  },
  memberPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  memberPreviewName: {
    fontSize: 14,
    color: '#425010',
    marginLeft: 12,
    flex: 1,
    fontWeight: '500',
  },
  hostBadge: {
    backgroundColor: '#F7F0CE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hostBadgeText: {
    color: '#425010',
    fontSize: 11,
    fontWeight: 'bold',
  },
  moreMembers: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    marginLeft: 32,
  },
  
  noGroupContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FEF9C3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: '#F7F0CE',
  },
  noGroupTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000000ff',
    marginBottom: 12,
  },
  noGroupDescription: {
    fontSize: 14,
    color: '#000000ff',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 20,
    opacity: 0.9,
  },
  createGroupButton: {
    flexDirection: 'row',
    backgroundColor: '#425010',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  createGroupButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  benefitsCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#F7F0CE',
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#425010',
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#FEF9C3',
    padding: 10,
    borderRadius: 8,
  },
  benefitText: {
    fontSize: 14,
    color: '#425010',
    marginLeft: 12,
    flex: 1,
    fontWeight: '500',
  },
});