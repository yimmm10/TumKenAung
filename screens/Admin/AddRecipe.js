// screens/Admin/AddRecipeScreen.js
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseconfig';
import Tag from '../../components/Tag';

export default function AddRecipeScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();

  // master list + user inputs
  const [ingredientOptions, setIngredientOptions] = useState([]);
  const [ingredients, setIngredients] = useState([
  { name:'', qty:'', unit:'', availableUnits:[], suggestions:[], showUnits:false }
  ]);
  const [tags, setTags] = useState([]);    
  const [input, setInput] = useState('');
  const [seasonings, setSeasonings] = useState(['']);
  const [tools, setTools]           = useState(['']);
  const [steps, setSteps]           = useState(['']);

  const [loading, setLoading]       = useState(true);
  const [imageUri, setImageUri]     = useState(null);
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [openUnitIndex, setOpenUnitIndex] = useState(null);
  

  // 1. Fetch master ingredient list
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db,'ingredientOptions'));
        setIngredientOptions(snap.docs.map(d => d.data())); // { name, units: [] }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 2. Image picker
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required','กรุณาอนุญาตเข้าถึงรูปภาพ');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!res.cancelled) {
      setImageUri(res.assets?.[0]?.uri ?? res.uri);
    }
  };
  const uploadImageAsync = async (uri, id) => {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    const storageRef = ref(storage, `Recipeimage/${id}`);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  };

  // Autocomplete handlers
  const onChangeName = idx => text => {
    setIngredients(list => {
      const c = [...list];
      c[idx].name = text;
      c[idx].suggestions = text.trim()
        ? ingredientOptions.filter(opt => opt.name.includes(text)).slice(0,5)
        : [];
      return c;
    });
  };
  const onSelectSuggestion = (idx, opt) => {
    setIngredients(list => {
      const c = [...list];
      c[idx].name = opt.name;
      c[idx].availableUnits = opt.units;
      c[idx].unit = opt.units[0] || '';
      c[idx].suggestions = [];
      return c;
    });
  };

   // Add / remove rows
  const addIngredient    = () => setIngredients(list => [...list, { name:'', qty:'', unit:'', availableUnits:[], suggestions:[] }]);
  const removeIngredient = idx => setIngredients(list => list.filter((_,i)=>i!==idx));
  const removeItem = setter => idx =>
  setter(list => list.filter((_, i) => i !== idx));

  const handleChangeField = (idx, field) => value => {
    setIngredients(list => {
      const c = [...list];
      c[idx][field] = value;
      return c;
    });
  };
  const handleAddList = setter => () => setter(list => [...list, '']);
  const handleChangeList = setter => idx => text => {
    setter(list => {
      const copy = [...list];
      copy[idx] = text;
      return copy;
    });
  };

  const toggleUnitOptions = idx => {
  setIngredients(list => {
    const c = [...list];
    c[idx].showUnits = !c[idx].showUnits;
    return c;
  });
};
const onSelectUnit = (idx, unit) => {
  setIngredients(list => {
    const c = [...list];
    c[idx].unit        = unit;
    c[idx].showUnits   = false;
    return c;
  });
};

const toggleUnitDropdown = idx => {
    setOpenUnitIndex(openUnitIndex === idx ? null : idx);
  };

const selectUnit = (idx, unit) => {
    setIngredients(list => {
      const c = [...list];
      c[idx].unit = unit;
      return c;
    });
    setOpenUnitIndex(null);
  };

  const addTag = () => {
    if (input.trim() && !tags.includes(input.trim())) {
      setTags([...tags, input.trim()]);
      setInput('');
    }
  };
  const removeTag = idx =>
    setTags(tags.filter((_, i) => i !== idx));

  // Submit
  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('กรุณากรอกชื่อเมนู');
      return;
    }
    setLoading(true);
    try {
      // clean fields
      const cleanTags        = tags.filter(t => t.trim());
      const cleanSeasonings  = seasonings.filter(s => s.trim());
      const cleanTools       = tools.filter(t => t.trim());
      const cleanSteps       = steps.filter(s => s.trim());
      const ingClean = ingredients
        .map(i => ({
          name: i.name,
          qty: parseFloat(i.qty) || 0,
          unit: i.unit
        }))
        .filter(i => i.name && i.qty > 0 && i.unit);

      // add recipe
      const docRef = await addDoc(collection(db,'recipes'), {
        title,
        description,
        tags:        cleanTags,
        ingredients: ingClean,
        seasonings:  cleanSeasonings,
        tools:       cleanTools,
        steps:       cleanSteps,
        status:      'approved',
        createdAt:   serverTimestamp(),
      });
      if (imageUri) {
        const url = await uploadImageAsync(imageUri, docRef.id);
        await updateDoc(doc(db,'recipes',docRef.id), { imageUrl: url });
      }
      Alert.alert('สำเร็จ','บันทึกสูตรเรียบร้อยแล้ว');
      navigation.goBack();
    } catch(e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0066CC" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={{padding: 16,paddingBottom: insets.bottom + 24,}}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>เพิ่มสูตรใหม่</Text>
        </View>

        {/* Image */}
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          {imageUri
            ? <Image source={{ uri: imageUri }} style={styles.image} />
            : <Ionicons name="image-outline" size={36} color="#888" />
          }
        </TouchableOpacity>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.label}>ชื่อเมนู</Text>
          <TextInput
            style={styles.input}
            placeholder="เช่น ต้มยำกุ้ง"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>คำอธิบาย (ไม่บังคับ)</Text>
          <TextInput
            style={[styles.input, { height: 80 }]}
            placeholder="คำอธิบายสั้นๆ"
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        {/* Tags */}
        <Text style={styles.sectionTitle}>ประเภทอาหาร</Text>
        <View style={styles.simpleRow}>
        <TextInput
          style={[styles.input, { flex: 1, marginRight: 8 }]}
          placeholder="พิมพ์แล้วกด +"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={addTag}
        />
        <TouchableOpacity onPress={addTag} style={styles.addBtn}>
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>วัตถุดิบ</Text>
          {ingredients.map((ing, idx) => (
            <View key={idx} style={styles.ingCard}>
              {/* row: name + remove */}
              <View style={styles.ingHeader}>
                <TextInput
                  style={styles.ingInput}
                  placeholder="ชื่อวัตถุดิบ"
                  value={ing.name}
                  onChangeText={onChangeName(idx)}
                />
                 <TouchableOpacity
                onPress={() => setIngredients(list => list.filter((_,i)=>i!==idx))}
                style={styles.removeBtn}
              >
                <Ionicons name="close-circle" size={24} color="#E53935" />
              </TouchableOpacity>
              </View>

              {/* suggestions */}
              {ing.suggestions.length > 0 && (
                <View style={styles.suggBox}>
                  {ing.suggestions.map(opt=>(
                    <TouchableOpacity
                      key={opt.name}
                      onPress={()=>onSelectSuggestion(idx,opt)}
                      style={styles.suggItem}
                    >
                      <Text>{opt.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* row: qty + unit */}
              <View style={styles.detailRow}>
              <View style={styles.detailCol}>
                <Text style={styles.detailLabel}>จำนวน</Text>
                <TextInput
                  style={styles.detailInput}
                  placeholder="0"
                  keyboardType="numeric"
                  value={ing.qty}
                  onChangeText={text => {
                    setIngredients(list => {
                      const c = [...list]; c[idx].qty = text; return c;
                    });
                  }}
                />
              </View>

              <View style={styles.detailCol}>
                <Text style={styles.detailLabel}>หน่วย</Text>
                <TouchableOpacity
                  style={styles.unitSelector}
                  onPress={() => toggleUnitDropdown(idx)}
                >
                  <Text style={styles.unitText}>
                    {ing.unit || 'เลือกหน่วย'}
                  </Text>
                  <Ionicons
                    name={openUnitIndex === idx ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={20}
                    color="#555"
                  />
                </TouchableOpacity>

                {openUnitIndex === idx && (
                  <View style={styles.unitList}>
                    {ing.availableUnits.map(u => (
                      <TouchableOpacity
                        key={u}
                        onPress={() => selectUnit(idx, u)}
                        style={styles.unitItem}
                      >
                        <Text style={styles.unitItemText}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>
        ))}

        <TouchableOpacity onPress={addIngredient} style={styles.addBtn}>
          <Ionicons name="add-circle" size={20} color="#4CAF50" />
          <Text style={styles.addText}>เพิ่มวัตถุดิบ</Text>
        </TouchableOpacity>
      </View>

        {/* Seasonings */}
        <View style={styles.section}>
          <Text style={styles.label}>เครื่องปรุง</Text>
          {seasonings.map((s,i) => (
            <View key={i} style={styles.simpleRow}>
            <TextInput
              key={i}
              style={[styles.input, { flex: 1, marginRight: 8 }]}  
              placeholder={`เครื่องปรุง ${i+1}`}
              value={s}
              onChangeText={handleChangeList(setSeasonings)(i)}
            />
            <TouchableOpacity onPress={() => removeItem(setSeasonings)(i)}>
              <Ionicons name="close-circle" size={22} color="#E53935" />
            </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addBtn} onPress={handleAddList(setSeasonings)}>
            <Ionicons name="add-circle" size={20} color="#4CAF50" />
            <Text style={styles.addText}>เพิ่มเครื่องปรุง</Text>
          </TouchableOpacity>
        </View>

        {/* Tools */}
        <View style={styles.section}>
          <Text style={styles.label}>อุปกรณ์</Text>
          {tools.map((t,i) => (
            <View key={i} style={styles.simpleRow}>
            <TextInput
              key={i}
              style={[styles.input, { flex: 1, marginRight: 8 }]}
              placeholder={`อุปกรณ์ ${i+1}`}
              value={t}
              onChangeText={handleChangeList(setTools)(i)}
            />
            <TouchableOpacity onPress={() => removeItem(setTools)(i)}>
             <Ionicons name="close-circle" size={22} color="#E53935" />
           </TouchableOpacity>
           </View>
          ))}
          <TouchableOpacity style={styles.addBtn} onPress={handleAddList(setTools)}>
            <Ionicons name="add-circle" size={20} color="#4CAF50" />
            <Text style={styles.addText}>เพิ่มอุปกรณ์</Text>
          </TouchableOpacity>
        </View>

        {/* Steps */}
        <View style={styles.section}>
          <Text style={styles.label}>วิธีทำ</Text>
          {steps.map((st,i) => (
          <View key={i} style={styles.simpleRow}>
            <TextInput
              key={i}
              style={[styles.input, { flex: 1, marginRight: 8 }]}
              placeholder={`ขั้นตอน ${i+1}`}
              value={st}
              onChangeText={handleChangeList(setSteps)(i)}
            />
            <TouchableOpacity onPress={() => removeItem(setSteps)(i)}>
             <Ionicons name="close-circle" size={22} color="#E53935" />
           </TouchableOpacity>
          </View>
          ))}
          <TouchableOpacity style={styles.addBtn} onPress={handleAddList(setSteps)}>
            <Ionicons name="add-circle" size={20} color="#4CAF50" />
            <Text style={styles.addText}>เพิ่มขั้นตอน</Text>
          </TouchableOpacity>
        </View>

        {/* Submit */}
        <TouchableOpacity onPress={handleSubmit} style={styles.btnSubmit}>
          <Text style={styles.submitText}>บันทึกสูตร</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex:1, backgroundColor:'#FFFBEF' },
  container:   { padding:16 },
  section:       { marginBottom:24 },
  sectionTitle:  { fontSize:16, fontWeight:'600', marginBottom:12, color:'#333' },
  
  header:      { flexDirection:'row', alignItems:'center', marginBottom:16 },
  backBtn:     { width:36,height:36,borderRadius:18,backgroundColor:'#fff',
                 justifyContent:'center',alignItems:'center',elevation:2 },
  headerTitle: { fontSize:18,fontWeight:'bold',color:'#333',marginLeft:8 },
  center:      { flex:1,justifyContent:'center',alignItems:'center' },
  imagePicker: { width:'100%',height:180,backgroundColor:'#eee',
                 borderRadius:8,marginBottom:16,justifyContent:'center',
                 alignItems:'center' },
  image:       { width:'100%',height:'100%',borderRadius:8 },
  section:     { marginBottom:16 },
  label:       { fontSize:14,fontWeight:'600',marginBottom:6,color:'#333' },
  input:       {
                 backgroundColor:'#fff',borderRadius:6,paddingHorizontal:12,
                 paddingVertical:8,fontSize:14,marginBottom:8,
                 elevation:1,shadowColor:'#000',shadowOpacity:0.05,
                 shadowOffset:{width:0,height:1},shadowRadius:2,
               },
  addBtn:      { flexDirection:'row',alignItems:'center',marginTop:4 },
  addText:     { marginLeft:6,color:'#4CAF50',fontSize:14,fontWeight:'600' },
  row:         { marginBottom:20 },
  inputName:   { borderWidth:1,borderRadius:6,padding:8 },
  suggBox:     { backgroundColor:'#fff',elevation:3,marginTop:-4 },
  suggItem:    { padding:8,borderBottomWidth:1,borderColor:'#eee' },
  inputQty:    { borderWidth:1,borderRadius:6,padding:8,marginTop:8 },
  picker:      { borderWidth:1,borderRadius:6,marginTop:8 },
  unitHint:    { color:'#888',marginTop:8 },
  addSmall:    { position:'absolute',right:0,top:0 },
  btnSubmit:   { backgroundColor:'#4CAF50',padding:14,borderRadius:8,alignItems:'center',marginTop:16 },
  submitText:  { color:'#fff',fontSize:16,fontWeight:'bold' },
  safe:          { flex:1, backgroundColor:'#FFFBEF' },
  container:     { padding:16 },
  section:       { marginBottom:24 },
  sectionTitle:  { fontSize:16, fontWeight:'600', marginBottom:12, color:'#333' },

  // ingredient card
  ingCard:       { backgroundColor:'#fff', borderRadius:8, padding:12, marginBottom:12, elevation:2 },
  ingHeader:     { flexDirection:'row', alignItems:'center' },
  ingInput:      { flex:1, borderWidth:1, borderColor:'#ddd', borderRadius:6, padding:8 },
  removeBtn:     { marginLeft:8 },

  suggBox:       { backgroundColor:'#fff', elevation:3, marginTop:4, borderRadius:6 },
  suggItem:      { padding:8, borderBottomWidth:1, borderColor:'#eee' },

  detailRow:     { flexDirection:'row', marginTop:12 },
  detailCol:     { flex:1, marginRight:8 },
  detailLabel:   { fontSize:12, color:'#555', marginBottom:4 },
  detailInput:   { borderWidth:1, borderColor:'#ddd', borderRadius:6, padding:8 },

  unitSelector:  {
    flexDirection:'row', alignItems:'center',
    borderWidth:1, borderColor:'#ddd', borderRadius:6,
    paddingHorizontal:8, paddingVertical:8,
  },
  unitText:      { flex:1, fontSize:14, color:'#333' },
  unitList:      {
    backgroundColor:'#fff', borderWidth:1, borderColor:'#ddd',
    borderRadius:6, marginTop:4, maxHeight:120,
  },
  unitItem:      { paddingVertical:8, paddingHorizontal:12, borderBottomWidth:1, borderColor:'#eee' },
  unitItemText:  { fontSize:14, color:'#333' },
  simpleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
