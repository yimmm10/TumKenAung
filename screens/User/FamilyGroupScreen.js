// screens/User/FamilyGroupScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, FlatList, ActivityIndicator, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { 
  doc, getDoc, setDoc, updateDoc, deleteDoc, 
  collection, getDocs, onSnapshot, writeBatch 
} from 'firebase/firestore';
import { db } from '../../firebaseconfig';

export default function FamilyGroupScreen({ navigation }) {
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [groupId, setGroupId] = useState(null);
  const [groupCode, setGroupCode] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  
  const [joinCode, setJoinCode] = useState('');
  const [joiningGroup, setJoiningGroup] = useState(false);

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
        setUserName(userData.displayName || userData.name || 'ผู้ใช้');
        
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
        
        const membersRef = collection(db, 'groups', gid, 'members');
        const membersSnap = await getDocs(membersRef);
        const membersList = membersSnap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        
        setGroupMembers(membersList);
        
        const myRole = membersList.find(m => m.id === uid)?.role;
        setUserRole(myRole);
      }
    } catch (error) {
      console.error('Error loading group data:', error);
    }
  };

  const createNewGroup = async () => {
    if (!userId) return;
    
    Alert.alert(
      'สร้างกลุ่มครอบครัว',
      'คุณต้องการสร้างตู้เย็นกลุ่มใหม่ใช่หรือไม่?\n\nตู้เย็นส่วนตัวของคุณจะกลายเป็นตู้เย็นกลุ่มที่สมาชิกทุกคนเข้าถึงได้',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'สร้าง',
          onPress: async () => {
            try {
              setLoading(true);
              
              const newGroupCode = generateGroupCode();
              const newGroupId = `group_${Date.now()}_${userId.substring(0, 6)}`;
              
              const groupRef = doc(db, 'groups', newGroupId);
              await setDoc(groupRef, {
                groupCode: newGroupCode,
                hostId: userId,
                createdAt: new Date().toISOString(),
                createdBy: userId
              });
              
              const memberRef = doc(db, 'groups', newGroupId, 'members', userId);
              await setDoc(memberRef, {
                name: userName,
                displayName: userName,
                role: 'host',
                joinedAt: new Date().toISOString()
              });
              
              const userRef = doc(db, 'users', userId);
              await updateDoc(userRef, {
                groupId: newGroupId
              });
              
              Alert.alert(
                'สำเร็จ!',
                `สร้างกลุ่มสำเร็จ\nรหัสกลุ่ม: ${newGroupCode}\n\nแชร์รหัสนี้กับสมาชิกในครอบครัวเพื่อเข้าร่วมกลุ่ม\n\nวัตถุดิบในตู้ของคุณจะถูกแชร์ให้สมาชิกทุกคนเห็น`,
                [{ text: 'ตรวจสอบ', onPress: () => loadUserData(userId) }]
              );
              
            } catch (error) {
              console.error('Error creating group:', error);
              Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถสร้างกลุ่มได้');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const generateGroupCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const joinGroup = async () => {
    if (!joinCode.trim()) {
      Alert.alert('กรุณากรอกรหัส', 'กรุณากรอกรหัสกลุ่มที่ต้องการเข้าร่วม');
      return;
    }

    try {
      setJoiningGroup(true);
      
      const groupsRef = collection(db, 'groups');
      const groupsSnap = await getDocs(groupsRef);
      
      let targetGroupId = null;
      groupsSnap.forEach(docSnap => {
        if (docSnap.data().groupCode === joinCode.trim().toUpperCase()) {
          targetGroupId = docSnap.id;
        }
      });
      
      if (!targetGroupId) {
        Alert.alert('ไม่พบกลุ่ม', 'ไม่พบกลุ่มที่มีรหัสนี้ กรุณาตรวจสอบรหัสอีกครั้ง');
        return;
      }
      
      const memberRef = doc(db, 'groups', targetGroupId, 'members', userId);
      const memberSnap = await getDoc(memberRef);
      
      if (memberSnap.exists()) {
        Alert.alert('คุณอยู่ในกลุ่มนี้แล้ว', 'คุณเป็นสมาชิกของกลุ่มนี้อยู่แล้ว');
        return;
      }
      
      await setDoc(memberRef, {
        name: userName,
        displayName: userName,
        role: 'member',
        joinedAt: new Date().toISOString()
      });
      
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        groupId: targetGroupId
      });
      
      Alert.alert(
        'เข้าร่วมสำเร็จ!',
        'คุณได้เข้าร่วมกลุ่มครอบครัวแล้ว ตอนนี้คุณสามารถแชร์วัตถุดิบร่วมกันได้',
        [{ text: 'ตกลง', onPress: () => loadUserData(userId) }]
      );
      
      setJoinCode('');
      
    } catch (error) {
      console.error('Error joining group:', error);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถเข้าร่วมกลุ่มได้');
    } finally {
      setJoiningGroup(false);
    }
  };

  const leaveGroup = async () => {
    if (!groupId || !userId) return;
    
    Alert.alert(
      'ยืนยันการออกจากกลุ่ม',
      userRole === 'host' 
        ? 'คุณเป็นเจ้าของกลุ่ม หากออกจากกลุ่ม กลุ่มจะถูกยุบและสมาชิกทุกคนจะกลับไปใช้ตู้เย็นส่วนตัว\n\nวัตถุดิบที่คุณเพิ่มจะยังอยู่ในตู้ของคุณ แต่วัตถุดิบที่สมาชิกคนอื่นเพิ่มจะกลับไปอยู่ในตู้ของพวกเขา'
        : 'คุณต้องการออกจากกลุ่มใช่หรือไม่?\n\nวัตถุดิบที่คุณเพิ่มจะยังอยู่ในตู้ส่วนตัวของคุณ (ยกเว้นที่ถูกใช้หรือลบไปแล้ว)',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: userRole === 'host' ? 'ยุบกลุ่ม' : 'ออกจากกลุ่ม',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              if (userRole === 'host') {
                await dissolveGroup();
              } else {
                await removeMemberFromGroup(userId);
              }
              
              Alert.alert('สำเร็จ', 'คุณได้ออกจากกลุ่มแล้ว คุณสามารถใช้ตู้เย็นส่วนตัวของคุณได้ตามปกติ');
              loadUserData(userId);
              
            } catch (error) {
              console.error('Error leaving group:', error);
              Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถออกจากกลุ่มได้');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const dissolveGroup = async () => {
    if (!groupId) return;
    
    const batch = writeBatch(db);
    
    for (const member of groupMembers) {
      const memberUserRef = doc(db, 'users', member.id);
      batch.update(memberUserRef, { groupId: null });
    }
    
    for (const member of groupMembers) {
      const memberRef = doc(db, 'groups', groupId, 'members', member.id);
      batch.delete(memberRef);
    }
    
    const groupIngredientsRef = collection(db, 'groups', groupId, 'groupIngredient');
    const groupIngsSnap = await getDocs(groupIngredientsRef);
    groupIngsSnap.docs.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });
    
    const groupRef = doc(db, 'groups', groupId);
    batch.delete(groupRef);
    
    await batch.commit();
  };

  const removeMemberFromGroup = async (memberId) => {
    if (!groupId) return;
    
    const memberRef = doc(db, 'groups', groupId, 'members', memberId);
    await deleteDoc(memberRef);
    
    const userRef = doc(db, 'users', memberId);
    await updateDoc(userRef, { groupId: null });
  };

  const kickMember = (member) => {
    Alert.alert(
      'ยืนยันการเตะสมาชิกออก',
      `คุณต้องการเตะ "${member.name}" ออกจากกลุ่มใช่หรือไม่?\n\nวัตถุดิบที่พวกเขาเพิ่มจะกลับไปอยู่ในตู้ส่วนตัวของพวกเขา`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'เตะออก',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMemberFromGroup(member.id);
              Alert.alert('สำเร็จ', `เตะ ${member.name} ออกจากกลุ่มแล้ว`);
              loadUserData(userId);
            } catch (error) {
              console.error('Error kicking member:', error);
              Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถเตะสมาชิกออกได้');
            }
          }
        }
      ]
    );
  };

  const renderMember = ({ item }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberInfo}>
        <View style={styles.avatarCircle}>
          <Ionicons 
            name={item.role === 'host' ? 'star' : 'person'} 
            size={24} 
            color={item.role === 'host' ? '#F7F0CE' : '#425010'} 
          />
        </View>
        <View style={styles.memberDetails}>
          <Text style={styles.memberName}>
            {item.name}
            {item.id === userId && ' (คุณ)'}
          </Text>
          <Text style={styles.memberRole}>
            {item.role === 'host' ? '🏠 เจ้าของกลุ่ม' : '👥 สมาชิก'}
          </Text>
        </View>
      </View>
      
      {userRole === 'host' && item.id !== userId && (
        <TouchableOpacity 
          style={styles.kickButton}
          onPress={() => kickMember(item)}
        >
          <MaterialIcons name="remove-circle-outline" size={24} color="#d62828" />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeContainer} edges={['top', 'left', 'right']}>
        <View style={styles.container}>
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
        <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 30 }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#425010" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>จัดการกลุ่มครอบครัว</Text>
            <View style={{ width: 40 }} />
          </View>

          {groupId ? (
            <>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="people" size={28} color="#425010" />
                  <Text style={styles.cardTitle}>ตู้เย็นกลุ่ม</Text>
                </View>
                
                <View style={styles.groupCodeContainer}>
                  <Text style={styles.label}>รหัสกลุ่ม</Text>
                  <View style={styles.codeBox}>
                    <Text style={styles.groupCodeText}>{groupCode}</Text>
                    <TouchableOpacity 
                      onPress={() => {
                        Alert.alert('รหัสกลุ่ม', `รหัสกลุ่มของคุณคือ: ${groupCode}\n\nแชร์รหัสนี้กับสมาชิกในครอบครัวเพื่อเข้าร่วมกลุ่ม`);
                      }}
                    >
                      <Ionicons name="copy-outline" size={20} color="#425010" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.statsContainer}>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{groupMembers.length}</Text>
                    <Text style={styles.statLabel}>สมาชิก</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statNumber}>
                      {userRole === 'host' ? '🏠' : '👥'}
                    </Text>
                    <Text style={styles.statLabel}>
                      {userRole === 'host' ? 'เจ้าของ' : 'สมาชิก'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>สมาชิกในกลุ่ม</Text>
                <FlatList
                  data={groupMembers}
                  keyExtractor={(item) => item.id}
                  renderItem={renderMember}
                  scrollEnabled={false}
                />
              </View>

              <TouchableOpacity style={styles.leaveButton} onPress={leaveGroup}>
                <Ionicons name="exit-outline" size={20} color="white" />
                <Text style={styles.leaveButtonText}>
                  {userRole === 'host' ? 'ยุบกลุ่ม' : 'ออกจากกลุ่ม'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="add-circle" size={28} color="#425010" />
                  <Text style={styles.cardTitle}>สร้างตู้เย็นกลุ่ม</Text>
                </View>
                <Text style={styles.description}>
                  สร้างกลุ่มครอบครัวเพื่อแชร์วัตถุดิบร่วมกัน คุณจะได้รับรหัสกลุ่มเพื่อแชร์ให้สมาชิกในครอบครัว
                </Text>
                <TouchableOpacity style={styles.primaryButton} onPress={createNewGroup}>
                  <Ionicons name="add" size={20} color="white" />
                  <Text style={styles.primaryButtonText}>สร้างกลุ่มใหม่</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="enter" size={28} color='#425010' />
                  <Text style={styles.cardTitle}>เข้าร่วมกลุ่ม</Text>
                </View>
                <Text style={styles.description}>
                  มีรหัสกลุ่มจากสมาชิกในครอบครัวแล้วใช่ไหม? กรอกรหัสด้านล่างเพื่อเข้าร่วมกลุ่ม
                </Text>
                
                <TextInput
                  style={styles.codeInput}
                  placeholder="กรอกรหัสกลุ่ม 6 หลัก"
                  value={joinCode}
                  onChangeText={setJoinCode}
                  maxLength={6}
                  autoCapitalize="characters"
                />
                
                <TouchableOpacity 
                  style={[styles.secondaryButton, joiningGroup && styles.buttonDisabled]} 
                  onPress={joinGroup}
                  disabled={joiningGroup}
                >
                  {joiningGroup ? (
                    <ActivityIndicator size="small" color="#425010" />
                  ) : (
                    <>
                      <Ionicons name="people" size={20} color="#425010" />
                      <Text style={styles.secondaryButtonText}>เข้าร่วมกลุ่ม</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="information-circle" size={24} color="#425010" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>ตู้เย็นกลุ่มคืออะไร?</Text>
                  <Text style={styles.infoText}>
                    • แชร์วัตถุดิบร่วมกันในครอบครัว{'\n'}
                    • เห็นวัตถุดิบของทุกคนในกลุ่ม{'\n'}
                    • เจ้าของกลุ่มจัดการสมาชิกได้{'\n'}
                    • วัตถุดิบของคุณยังเป็นของคุณเสมอ
                  </Text>
                </View>
              </View>
            </>
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
  scrollView: {
    flex: 1,
    padding: 16,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#F7F0CE',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000ff',
  },
  
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#F7F0CE',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#425010',
    marginLeft: 10,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 20,
  },
  
  groupCodeContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#425010',
    marginBottom: 8,
    fontWeight: '600',
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF9C3',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F7F0CE',
    borderStyle: 'dashed',
  },
  groupCodeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#425010',
    letterSpacing: 4,
  },
  
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  statBox: {
    alignItems: 'center',
    backgroundColor: '#FEF9C3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 100,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#425010',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#425010',
    marginBottom: 16,
  },
  
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF9C3',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F7F0CE',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#F7F0CE',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#425010',
    marginBottom: 4,
  },
  memberRole: {
    fontSize: 13,
    color: '#666',
  },
  kickButton: {
    padding: 8,
  },
  
  codeInput: {
    borderWidth: 2,
    borderColor: '#F7F0CE',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 4,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    backgroundColor: '#FFF',
    marginBottom: 16,
  },
  
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#425010',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: '#F7F0CE',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  secondaryButtonText: {
    color: '#425010',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  leaveButton: {
    flexDirection: 'row',
    backgroundColor: '#d62828',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  leaveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#F7F0CE',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#425010',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
});