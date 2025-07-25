// FridgeGroupOverlay.js
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput
} from 'react-native';

export default function FridgeGroupOverlay({ visible, onClose }) {
  const [hasGroup, setHasGroup] = useState(false);
  const [groupCode, setGroupCode] = useState('ABC123');
  const [inputCode, setInputCode] = useState('');
  const [members, setMembers] = useState([
    { name: 'แม่' }, { name: 'พี่สาว' }, { name: 'เรา' }
  ]);

  const handleJoin = () => {
    setHasGroup(true);
  };

  const handleLeave = () => {
    setHasGroup(false);
    setInputCode('');
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <Text style={styles.title}>แชร์ตู้เย็นร่วมกัน</Text>

        {!hasGroup ? (
          <>
            <Text style={styles.label}>คุณยังไม่มีกลุ่ม</Text>
            <TouchableOpacity style={styles.button} onPress={handleJoin}>
              <Text style={styles.buttonText}>สร้างกลุ่ม</Text>
            </TouchableOpacity>
            <Text style={styles.or}>หรือ</Text>
            <TextInput
              placeholder="กรอกรหัสเข้าร่วม"
              value={inputCode}
              onChangeText={setInputCode}
              style={styles.input}
            />
            <TouchableOpacity style={styles.button} onPress={handleJoin}>
              <Text style={styles.buttonText}>เข้าร่วมกลุ่ม</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>รหัสเข้าร่วมกลุ่ม: <Text style={{ fontWeight: 'bold' }}>{groupCode}</Text></Text>
            <Text style={styles.label}>สมาชิก</Text>
            {members.map((m, i) => (
              <Text key={i} style={styles.member}>{m.name}</Text>
            ))}

            <TouchableOpacity style={styles.leaveButton} onPress={handleLeave}>
              <Text style={styles.leaveText}>ออกจากกลุ่ม</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>ปิด</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  label: { marginTop: 10, marginBottom: 6, fontSize: 16 },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 10, marginBottom: 10
  },
  button: {
    backgroundColor: '#f4a261', padding: 12, borderRadius: 8,
    alignItems: 'center', marginVertical: 6
  },
  buttonText: { color: 'white', fontWeight: 'bold' },
  or: { textAlign: 'center', marginVertical: 6, color: '#999' },
  member: { paddingVertical: 4, paddingLeft: 10 },
  leaveButton: { backgroundColor: '#e76f51', padding: 12, borderRadius: 8, marginTop: 20, alignItems: 'center' },
  leaveText: { color: 'white', fontWeight: 'bold' },
  closeButton: { marginTop: 30, alignItems: 'center' },
  closeText: { color: '#888' },
});
