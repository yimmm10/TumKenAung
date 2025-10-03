import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, StyleSheet, Alert } from 'react-native';
import { db } from '../../firebaseconfig';
import { doc, deleteDoc } from 'firebase/firestore';

const MemberItem = ({ member, groupId, fetchGroupMembers }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  // ลบสมาชิกออกจากกลุ่ม
  const handleRemoveMember = async () => {
    try {
      const memberRef = doc(db, 'groups', groupId, 'members', member.id);
      await deleteDoc(memberRef);
      Alert.alert('สำเร็จ', 'สมาชิกถูกลบออกจากกลุ่ม');
      fetchGroupMembers();  // รีเฟรชข้อมูลสมาชิกในกลุ่ม
    } catch (error) {
      console.error('Error removing member:', error);
      Alert.alert('ไม่สามารถลบสมาชิกได้');
    }
  };

  return (
    <View style={styles.memberRow}>
      {/* คลิกที่รูปจะเปิด Modal */}
      <TouchableOpacity onPress={() => setIsModalVisible(true)}>
        <Image source={{ uri: member.profileImage }} style={styles.memberImage} />
      </TouchableOpacity>
      <Text style={styles.memberName}>{member.name}</Text>

      {/* Modal สำหรับลบสมาชิก */}
      <Modal visible={isModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity onPress={handleRemoveMember} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>ลบสมาชิก</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  memberImage: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  memberName: { fontWeight: 'bold', fontSize: 16, flex: 1 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: 250,
  },
  modalButton: {
    padding: 10,
    backgroundColor: '#f4a261',
    marginBottom: 10,
    borderRadius: 5,
  },
  modalButtonText: { color: '#fff', textAlign: 'center' },
});

export default MemberItem;
