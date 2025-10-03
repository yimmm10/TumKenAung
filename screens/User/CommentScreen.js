// screens/User/CommentScreen.js
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { getAuth } from 'firebase/auth';
import { db } from '../../firebaseconfig';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';

const THEME = {
  bg: '#fefae0',
  card: '#ffffff',
  green: '#6a994e',
  yellow: '#ffd166',
  text: '#111827',
  sub: '#6B7280',
  line: '#e5e7eb',
  red: '#ef4444',
};

export default function CommentScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const auth = getAuth();

  const recipeId = route?.params?.recipeId || null;
  const recipeTitle = route?.params?.recipeTitle || '';

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  // ความสูงจริงของ input bar (ใช้คำนวณ padding ของ list)
  const [inputBarH, setInputBarH] = useState(64);

  // === Animate input bar to stay above keyboard ===
  const kbBottom = useRef(new Animated.Value(0)).current;
  const [keyboardH, setKeyboardH] = useState(0);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'ความคิดเห็น' }); // เหลือหัวแถบเดียว (ของ Stack)
  }, [navigation]);

  // โหลดคอมเมนต์แบบเรียลไทม์
  useEffect(() => {
    if (!recipeId) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'comments'), where('recipeId', '==', recipeId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.timestamp?.seconds || 0;
            const tb = b.timestamp?.seconds || 0;
            return ta - tb; // เก่า→ใหม่
          });
        setComments(list);
        setLoading(false);
      },
      (err) => {
        console.error('comments error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [recipeId]);

  // ฟัง event คีย์บอร์ดเพื่อขยับกล่องอินพุต (ไม่โดนบัง)
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e) => {
      const h = e?.endCoordinates?.height || 0;
      setKeyboardH(h);
      Animated.timing(kbBottom, {
        toValue: h,
        duration: Platform.OS === 'ios' ? 220 : 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    };
    const onHide = () => {
      setKeyboardH(0);
      Animated.timing(kbBottom, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? 220 : 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
    };

    const s = Keyboard.addListener(showEvt, onShow);
    const h = Keyboard.addListener(hideEvt, onHide);
    return () => {
      s.remove();
      h.remove();
    };
  }, [kbBottom]);

  const canSend = useMemo(() => {
    return String(newComment).trim().length > 0 && !!auth.currentUser;
  }, [newComment, auth.currentUser]);

  const handleAddComment = useCallback(async () => {
    const user = auth.currentUser;
    const text = String(newComment).trim();
    if (!user) {
      return alert('กรุณาเข้าสู่ระบบก่อนแสดงความคิดเห็น');
    }
    if (!text) return;

    try {
      await addDoc(collection(db, 'comments'), {
        recipeId,
        comment: text,
        userId: user.uid,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        timestamp: serverTimestamp(),
      });
      setNewComment('');
    } catch (e) {
      console.error('add comment error:', e);
      alert('ส่งความคิดเห็นไม่สำเร็จ');
    }
  }, [auth, newComment, recipeId]);

  // === ฟังก์ชันรายงานความคิดเห็น ===
  const handleReportComment = useCallback(async (comment) => {
    const user = auth.currentUser;
    if (!user) {
      return Alert.alert('เข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนรายงาน');
    }

    // เช็คว่าเป็นความคิดเห็นของตัวเองหรือไม่
    if (user.uid === comment.userId) {
      return Alert.alert('ไม่สามารถรายงานได้', 'คุณไม่สามารถรายงานความคิดเห็นของตัวเองได้');
    }

    console.log('Reporting comment:', {
      commentId: comment.id,
      commentUserId: comment.userId,
      currentUserId: user.uid,
      comment: comment.comment
    });

    // ตรวจสอบว่าเคยรายงานแล้วหรือยัง
    try {
      const existingReportQuery = query(
        collection(db, 'commentReports'),
        where('commentId', '==', comment.id),
        where('reportedBy', '==', user.uid)
      );
      const existingReports = await getDocs(existingReportQuery);
      
      if (!existingReports.empty) {
        return Alert.alert('รายงานแล้ว', 'คุณได้รายงานความคิดเห็นนี้แล้ว');
      }

      Alert.alert(
        'รายงานความคิดเห็น',
        `คุณต้องการรายงานความคิดเห็นนี้หรือไม่?\n\n"${String(comment.comment).substring(0, 50)}${String(comment.comment).length > 50 ? '...' : ''}"`,
        [
          { text: 'ยกเลิก', style: 'cancel' },
          {
            text: 'รายงาน',
            style: 'destructive',
            onPress: async () => {
              try {
                const reportData = {
                  commentId: comment.id,
                  commentText: String(comment.comment || ''),
                  commentAuthor: String(comment.displayName || 'ผู้ใช้'),
                  commentAuthorId: comment.userId,
                  recipeId: comment.recipeId || recipeId,
                  reportedBy: user.uid,
                  reportedByName: String(user.displayName || 'ผู้ใช้'),
                  timestamp: serverTimestamp(),
                  status: 'pending',
                  reason: 'inappropriate_content',
                };

                console.log('Submitting report:', reportData);
                
                await addDoc(collection(db, 'commentReports'), reportData);
                Alert.alert('สำเร็จ', 'ได้รับรายงานของคุณแล้ว ทางทีมงานจะตรวจสอบโดยเร็วที่สุด');
              } catch (error) {
                console.error('Report submission error:', error);
                Alert.alert('ผิดพลาด', `ไม่สามารถส่งรายงานได้: ${error.message}`);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Check existing report error:', error);
      Alert.alert('ผิดพลาด', `ไม่สามารถตรวจสอบได้: ${error.message}`);
    }
  }, [auth, recipeId]);

  const renderItem = ({ item }) => {
    const name = String(item.displayName || 'ผู้ใช้').trim() || 'ผู้ใช้';
    const avatar = item.photoURL || null;
    const isOwnComment = auth.currentUser?.uid === item.userId;

    let when = '';
    if (item.timestamp?.seconds) {
      const d = new Date(item.timestamp.seconds * 1000);
      when = d.toLocaleString();
    }

    return (
      <View style={styles.commentRow}>
        <View style={styles.avatarWrap}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPh]}>
              <Ionicons name="person" size={16} color="#9ca3af" />
            </View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.nameTxt} numberOfLines={1}>
              {name}
            </Text>
            {!!when && (
              <Text style={styles.timeTxt} numberOfLines={1}>
                {when}
              </Text>
            )}
          </View>
          <Text style={styles.commentTxt}>{String(item.comment || '')}</Text>
          
          {/* ปุ่มรายงาน (ไม่แสดงถ้าเป็นความคิดเห็นของตัวเอง) */}
          {!isOwnComment && (
            <TouchableOpacity
              style={styles.reportBtn}
              onPress={() => handleReportComment(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="flag-outline" size={12} color={THEME.sub} />
              <Text style={styles.reportTxt}>รายงาน</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // padding ของรายการด้านล่าง: กันพื้นที่ input + คีย์บอร์ด
  const listBottomPad = inputBarH + (keyboardH > 0 ? keyboardH : insets.bottom) + 12;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.bg }} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ชื่อเมนูใต้หัวแถบ */}
        {!!recipeTitle && (
          <View style={styles.subHeader}>
            <Ionicons name="restaurant" size={14} color="#64748B" />
            <Text style={styles.subTitle} numberOfLines={1}>
              {recipeTitle}
            </Text>
          </View>
        )}

        {/* รายการคอมเมนต์ */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={THEME.green} />
            <Text style={{ marginTop: 8, color: '#666' }}>กำลังโหลดความคิดเห็น…</Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: listBottomPad,
            }}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={48}
                  color="#cbd5e1"
                />
                <Text style={styles.emptyTxt}>
                  ยังไม่มีความคิดเห็น ลองเป็นคนแรกเลย!
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* กล่องพิมพ์คอมเมนต์ (ลอยขึ้นตามคีย์บอร์ด) */}
        <Animated.View
          style={[
            styles.inputBar,
            {
              paddingBottom: 10 + insets.bottom,
              bottom: kbBottom, // <-- ขยับตามความสูงคีย์บอร์ด
            },
          ]}
          onLayout={(e) => setInputBarH(e.nativeEvent.layout.height)}
        >
          <View style={styles.inputWrap}>
            <TextInput
              value={newComment}
              onChangeText={setNewComment}
              placeholder={
                auth.currentUser
                  ? 'พิมพ์ความคิดเห็นของคุณ…'
                  : 'กรุณาเข้าสู่ระบบเพื่อแสดงความคิดเห็น'
              }
              placeholderTextColor="#9ca3af"
              style={styles.input}
              editable={!!auth.currentUser}
              multiline
            />
            <TouchableOpacity
              onPress={handleAddComment}
              style={[styles.sendBtn, { opacity: canSend ? 1 : 0.5 }]}
              disabled={!canSend}
              activeOpacity={0.85}
            >
              <Ionicons name="send" size={16} color="#111" />
              <Text style={styles.sendTxt}>ส่ง</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ===================== Styles ===================== */
const styles = StyleSheet.create({
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
    backgroundColor: THEME.bg,
  },
  subTitle: { color: '#64748B', fontSize: 12 },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { alignItems: 'center', marginTop: 48 },
  emptyTxt: { marginTop: 8, color: '#94a3b8' },

  commentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.line,
  },
  avatarWrap: { width: 36, height: 36 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb' },
  avatarPh: { alignItems: 'center', justifyContent: 'center' },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameTxt: { fontWeight: '800', color: THEME.text, flexShrink: 1 },
  timeTxt: { color: '#9ca3af', fontSize: 11 },

  commentTxt: { color: THEME.text, marginTop: 2, lineHeight: 18 },

  // === ปุ่มรายงาน ===
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  reportTxt: {
    color: THEME.sub,
    fontSize: 11,
    fontWeight: '500',
  },

  // ===== Input Bar (absolute, animated bottom) =====
  inputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0, // จะถูก animate ทับด้วย kbBottom
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: THEME.line,
    paddingHorizontal: 12,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: THEME.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: THEME.text,
    backgroundColor: '#fff',
  },
  sendBtn: {
    backgroundColor: THEME.yellow,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sendTxt: { fontWeight: '800', color: '#111' },

  // Back button style
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: -8,
  },
});