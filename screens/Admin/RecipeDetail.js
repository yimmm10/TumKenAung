// screens/Admin/RecipeDetailScreen.js
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, ScrollView, View, Text, TextInput,
  TouchableOpacity, Image, ActivityIndicator, StyleSheet, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../firebaseconfig';
import Tag from '../../components/Tag';

export default function RecipeDetailScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const { recipeId } = useRoute().params;
  const [ingredientOptions, setIngredientOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [imageUri, setImageUri]         = useState(null);
  const [remoteImageUrl, setRemoteImageUrl] = useState(null);
  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [ingredients, setIngredients]   = useState([]);
  const [seasonings, setSeasonings]     = useState(['']);
  const [tools, setTools]               = useState(['']);
  const [steps, setSteps]               = useState(['']);
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [input, setInput] = useState('');

  // fetch master list and recipe data
  useEffect(() => {
    (async () => {
      try {
        // master ingredientOptions
        const optSnap = await getDocs(collection(db,'ingredientOptions'));
        setIngredientOptions(optSnap.docs.map(d=>d.data()));

        // recipe
        const snap = await getDoc(doc(db,'recipes',recipeId));
        if (!snap.exists()) {
          Alert.alert('Error','ไม่พบสูตรนี้');
          navigation.goBack();
          return;
        }
        const data = snap.data();
        setRemoteImageUrl(data.imageUrl || null);
        setTitle(data.title || '');
        setDescription(data.description || '');
        // map ingredients
        setIngredients((data.ingredients||[]).map(i=>({
          name: i.name,
          qty: String(i.qty),
          unit: i.unit,
          availableUnits: [], suggestions: [], showUnits: false
        })));
        setSeasonings(data.seasonings || ['']);
        setTools(data.tools || ['']);
        setSteps(data.steps || ['']);
        setTags(data.tags || []);
      } catch(e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  },[recipeId]);

  // pick or replace image
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permission required','กรุณาอนุญาตเข้าถึงรูปภาพ');
    }
    const res = await ImagePicker.launchImageLibraryAsync({allowsEditing:true,quality:0.7});
    if (!res.cancelled) {
      setImageUri(res.assets?.[0]?.uri ?? res.uri);
    }
  };

  const uploadImage = async id => {
    const uri = imageUri;
    if (!uri) return null;
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const storageRef = ref(storage, `Recipeimage/${id}`);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  };

  // autocomplete ingredient name
  const onChangeName = idx => text => {
    setIngredients(list => {
      const c = [...list];
      c[idx].name = text;
      c[idx].suggestions = text.trim()
        ? ingredientOptions.filter(opt=>opt.name.includes(text)).slice(0,5)
        : [];
      return c;
    });
  };
  const onSelectSuggestion = (idx,opt) => {
    setIngredients(list => {
      const c = [...list];
      c[idx].name           = opt.name;
      c[idx].availableUnits = opt.units;
      c[idx].unit           = opt.units[0]||'';
      c[idx].suggestions    = [];
      return c;
    });
  };

  // add/remove ingredient row
  const addIngredient    = () => setIngredients(list=>[...list,{name:'',qty:'',unit:'',availableUnits:[],suggestions:[],showUnits:false}]);
  const removeIngredient = idx => setIngredients(list=>list.filter((_,i)=>i!==idx));

  const toggleUnits = idx => {
    setIngredients(list=>{
      const c=[...list];
      c[idx].showUnits = !c[idx].showUnits;
      return c;
    });
  };
  const selectUnit = (idx,unit) => {
    setIngredients(list=>{
      const c=[...list];
      c[idx].unit = unit;
      c[idx].showUnits = false;
      return c;
    });
  };
  const changeField = (idx,field) => val => {
    setIngredients(list=>{
      const c=[...list];
      c[idx][field] = val;
      return c;
    });
  };

  // generic for seasonings/tools/steps
  const handleAddList    = setter => () => setter(list=>[...list,'']);
  const handleChangeList = setter => idx => text => setter(list=>{
    const c=[...list]; c[idx]=text; return c;
  });
  const handleRemoveList = setter => idx => setter(list=>list.filter((_,i)=>i!==idx));

  // save all changes
  const handleSave = async () => {
    setSaving(true);
    try {
      // update doc
      const recipeRef = doc(db,'recipes',recipeId);
      const payload = {
        title, description,
        ingredients: ingredients.map(i=>({
          name: i.name,
          qty:  parseFloat(i.qty)||0,
          unit: i.unit
        })),
        seasonings: seasonings.filter(s=>s.trim()),
        tools:      tools.filter(t=>t.trim()),
        steps:      steps.filter(s=>s.trim()),
        tags,
      };
      if (imageUri) {
        const url = await uploadImage(recipeId);
        payload.imageUrl = url;
      }
      await updateDoc(recipeRef,payload);
      Alert.alert('บันทึกสำเร็จ');
      navigation.goBack();
    } catch(e) {
      Alert.alert('Error',e.message);
    } finally {
      setSaving(false);
    }
  };

const addTag = () => {
  const t = newTag.trim();
  if (t && !tags.includes(t)) {
    setTags([...tags, t]);
    setNewTag('');
  }
};
const removeTag = idx => {
  setTags(tags.filter((_, i) => i !== idx));
};

  // delete recipe
  const handleDelete = async () => {
    await deleteDoc(doc(db,'recipes',recipeId));
    try { const imageRef = ref(storage, `Recipeimage/${recipeId}`);
    await deleteObject(imageRef);
    } catch(err) {
      console.warn('ลบภาพจาก Storage ไม่สำเร็จ:', err);
    } 
    navigation.goBack();
  };

  if (loading) {
    return <ActivityIndicator style={{flex:1,justifyContent:'center'}} size="large" />;
  }

  return (
    <SafeAreaView style={[styles.safe,{paddingTop:insets.top+8}]}>
      <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>รายละเอียดสูตร</Text>
    </View>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Image */}
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          {(imageUri||remoteImageUrl) ? (
            <Image
              source={{uri:imageUri||remoteImageUrl}}
              style={styles.image}
            />
          ) : (
            <Ionicons name="image-outline" size={36} color="#888" />
          )}
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.label}>ชื่อเมนู</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
        />

        {/* Description */}
        <Text style={styles.label}>คำอธิบาย</Text>
        <TextInput
          style={[styles.input,{height:80}]}
          multiline
          value={description}
          onChangeText={setDescription}
        />

        {/* Tags */}
        <Text style={styles.label}>ประเภทอาหาร</Text>
        <View style={styles.simpleRow}>
        <TextInput
          style={[styles.input, { flex: 1, marginRight: 8 }]}
          placeholder="พิมพ์ tag แล้วกด +"
          value={newTag}
          onChangeText={setNewTag}
          onSubmitEditing={addTag}
        />
        <TouchableOpacity onPress={addTag} style={styles.addButton}>
          <Ionicons name="add-circle-outline" size={28} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {/* แถวโชว์ Tags */}
      <View style={styles.tagContainer}>
        {tags.map((t, i) => (
          <Tag key={i} label={t} onRemove={() => removeTag(i)} />
        ))}
      </View>

        {/* Ingredients */}
        <Text style={[styles.label,{marginTop:16}]}>วัตถุดิบ</Text>
        {ingredients.map((ing,idx)=>(
          <View key={idx} style={styles.ingCard}>
            <View style={styles.ingHeader}>
              <TextInput
                style={styles.ingInput}
                placeholder="เพิ่มวัตถุดิบ"
                value={ing.name}
                onChangeText={onChangeName(idx)}
              />
              <TouchableOpacity onPress={()=>removeIngredient(idx)} style={styles.removeBtn}>
                <Ionicons name="close-circle" size={22} color="#E53935"/>
              </TouchableOpacity>
            </View>
            {ing.suggestions.length>0 && (
              <View style={styles.suggBox}>
                {ing.suggestions.map(o=>(
                  <TouchableOpacity key={o.name} onPress={()=>onSelectSuggestion(idx,o)} style={styles.suggItem}>
                    <Text>{o.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={styles.detailRow}>
              <View style={styles.detailCol}>
                <Text style={styles.detailLabel}>จำนวน</Text>
                <TextInput
                  style={styles.detailInput}
                  keyboardType="numeric"
                  value={ing.qty}
                  onChangeText={changeField(idx,'qty')}
                />
              </View>
              <View style={styles.detailCol}>
                <Text style={styles.detailLabel}>หน่วย</Text>
                <TouchableOpacity style={styles.unitSelector} onPress={()=>toggleUnits(idx)}>
                  <Text style={styles.unitText}>{ing.unit||'เลือกหน่วย'}</Text>
                  <Ionicons name={ing.showUnits?'chevron-up-outline':'chevron-down-outline'} size={18} color="#555"/>
                </TouchableOpacity>
                {ing.showUnits && (
                  <View style={styles.unitList}>
                    {ing.availableUnits.map(u=>(
                      <TouchableOpacity key={u} onPress={()=>selectUnit(idx,u)} style={styles.unitItem}>
                        <Text style={styles.unitItemText}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>
        ))}
        <TouchableOpacity onPress={addIngredient} style={styles.addRowBtn}>
          <Ionicons name="add-circle-outline" size={20} color="#4CAF50"/>
          <Text style={styles.addRowText}>เพิ่มวัตถุดิบ</Text>
        </TouchableOpacity>

        {/* Seasonings */}
        <Text style={styles.label}>เครื่องปรุง</Text>
        {seasonings.map((s,i)=>(
          <View key={i} style={styles.simpleRow}>
            <TextInput
              style={styles.input}
              placeholder={`เครื่องปรุง ${i+1}`}
              value={s}
              onChangeText={handleChangeList(setSeasonings)(i)}
            />
            <TouchableOpacity onPress={()=>handleRemoveList(setSeasonings)(i)}>
              <Ionicons name="close-circle" size={22} color="#E53935"/>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={handleAddList(setSeasonings)} style={styles.addRowBtn}>
          <Ionicons name="add-circle-outline" size={20} color="#4CAF50"/>
          <Text style={styles.addRowText}>เพิ่มเครื่องปรุง</Text>
        </TouchableOpacity>

        {/* Tools */}
        <Text style={styles.label}>อุปกรณ์</Text>
        {tools.map((t,i)=>(
          <View key={i} style={styles.simpleRow}>
            <TextInput
              style={styles.input}
              placeholder={`อุปกรณ์ ${i+1}`}
              value={t}
              onChangeText={handleChangeList(setTools)(i)}
            />
            <TouchableOpacity onPress={()=>handleRemoveList(setTools)(i)}>
              <Ionicons name="close-circle" size={22} color="#E53935"/>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={handleAddList(setTools)} style={styles.addRowBtn}>
          <Ionicons name="add-circle-outline" size={20} color="#4CAF50"/>
          <Text style={styles.addRowText}>เพิ่มอุปกรณ์</Text>
        </TouchableOpacity>

        {/* Steps */}
        <Text style={styles.label}>วิธีทำ</Text>
        {steps.map((st,i)=>(
          <View key={i} style={styles.simpleRow}>
            <TextInput
              style={[styles.input,{flex:1,height:60}]}
              placeholder={`ขั้นตอน ${i+1}`}
              value={st}
              multiline
              onChangeText={handleChangeList(setSteps)(i)}
            />
            <TouchableOpacity onPress={()=>handleRemoveList(setSteps)(i)}>
              <Ionicons name="close-circle" size={22} color="#E53935"/>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={handleAddList(setSteps)} style={styles.addRowBtn}>
          <Ionicons name="add-circle-outline" size={20} color="#4CAF50"/>
          <Text style={styles.addRowText}>เพิ่มขั้นตอน</Text>
        </TouchableOpacity>

        {/* Save / Delete */}
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn,saving&&{opacity:0.6}]}
          disabled={saving}
        >
          <Text style={styles.saveText}>{saving?'กำลังบันทึก...':'บันทึกการแก้ไข'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>ลบสูตรนี้</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex:1, backgroundColor:'#FFFBEF' },
  container: { padding:16, paddingBottom:40 },
  imagePicker:{
    width:'100%',height:180,backgroundColor:'#eee',
    borderRadius:8,marginBottom:16,justifyContent:'center',alignItems:'center'
  },
  image:     { width:'100%',height:'100%',borderRadius:8 },
  label:     { fontSize:14,fontWeight:'600',marginBottom:6,color:'#333' },
  input:     {
    backgroundColor:'#fff',borderRadius:6,padding:10,fontSize:16,
    borderWidth:1,borderColor:'#ddd',marginBottom:12
  },
  ingCard:   { backgroundColor:'#fff',borderRadius:8,padding:12,marginBottom:12,elevation:2 },
  ingHeader: { flexDirection:'row',alignItems:'center' },
  ingInput:  { flex:1,borderWidth:1,borderColor:'#ddd',borderRadius:6,padding:8 },
  removeBtn: { marginLeft:8 },
  suggBox:   { backgroundColor:'#fff',elevation:3,marginTop:4,borderRadius:6 },
  suggItem:  { padding:8,borderBottomWidth:1,borderColor:'#eee' },
  detailRow: { flexDirection:'row',marginTop:12 },
  detailCol: { flex:1,marginRight:8 },
  detailLabel:{fontSize:12,color:'#555',marginBottom:4},
  detailInput:{borderWidth:1,borderColor:'#ddd',borderRadius:6,padding:8},
  unitSelector:{
    flexDirection:'row',alignItems:'center',
    borderWidth:1,borderColor:'#ddd',borderRadius:6,padding:8
  },
  unitText:  { flex:1,color:'#333' },
  unitList:  {
    backgroundColor:'#fff',borderWidth:1,borderColor:'#ddd',
    borderRadius:6,marginTop:4,maxHeight:120
  },
  unitItem:    { padding:8,borderBottomWidth:1,borderColor:'#eee' },
  unitItemText:{ fontSize:14,color:'#333' },
  addRowBtn: { flexDirection:'row',alignItems:'center',marginVertical:12 },
  addRowText:{ marginLeft:6,color:'#4CAF50',fontSize:14 },
  simpleRow:{ flexDirection:'row',alignItems:'center',marginBottom:12 },
  saveBtn: { backgroundColor:'#4CAF50',borderRadius:8,paddingVertical:14,alignItems:'center',marginTop:8 },
  saveText:{ color:'#fff',fontSize:16,fontWeight:'600' },
  deleteBtn:{ marginTop:12,alignItems:'center' },
  deleteText:{ color:'#E53935',fontSize:16,fontWeight:'600' },
   header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
