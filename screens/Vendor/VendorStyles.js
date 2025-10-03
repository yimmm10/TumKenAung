import { StyleSheet } from 'react-native';
import { VCOLORS, VRADIUS, VSPACE, VTYPE } from './VendorTheme';

export default StyleSheet.create({
  screen: {
  flex: 1,
  backgroundColor: '#F6F1D6', // ครีมอ่อน
},


  // หัวข้อส่วน
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: VSPACE.sm, gap: VSPACE.xs },
  sectionBar: { width: 4, height: 18, borderRadius: 2, backgroundColor: VCOLORS.brand.orange },
  sectionTitle: { ...VTYPE.h2, color: VCOLORS.text.main },

  // การ์ด/กล่อง
  card: {
    backgroundColor: VCOLORS.ui.card,
    borderRadius: VRADIUS.lg,
    borderWidth: 1,
    borderColor: VCOLORS.ui.border,
    padding: VSPACE.lg,
  },
  shadow: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: {width:0,height:2}, elevation: 2 },

  // รายการสต๊อก
  stockItem: {
    backgroundColor: VCOLORS.ui.card,
    borderRadius: VRADIUS.md,
    borderWidth: 1,
    borderColor: VCOLORS.ui.border,
    padding: VSPACE.md,
    marginBottom: VSPACE.md, // ระยะห่างแต่ละบรรทัด
  },
  stockTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: VSPACE.xs },
  stockName: { ...VTYPE.h3, color: VCOLORS.text.main },
  stockQty:  { ...VTYPE.body, color: VCOLORS.text.sub },

  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: VSPACE.xs },
  expiryText: { ...VTYPE.sub, color: VCOLORS.text.sub },
  expiryWarn: { ...VTYPE.sub, color: VCOLORS.text.danger, fontWeight: '700' },

  // ปุ่ม/ลิงก์เรียบง่าย
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: VSPACE.sm },
  link: { color: VCOLORS.brand.green, fontWeight: '600' },

  // พิลล์ฟิลเตอร์
  pill: {
    backgroundColor: VCOLORS.ui.pill,
    borderRadius: 999,
    paddingHorizontal: VSPACE.md,
    paddingVertical: VSPACE.xs,
    borderWidth: 1,
    borderColor: VCOLORS.ui.border,
    marginRight: VSPACE.sm,
  },
  pillText: { ...VTYPE.body, color: VCOLORS.brand.green },
});
