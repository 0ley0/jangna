// Bilingual data — switch via applyLang('th' | 'en')
// UI chrome strings use the L(en, th) helper below.

// ============ ENGLISH ============
const data_en = {
  initialTasks: [
    { id: 't1', title: 'Draft Q3 product brief',           done: false, tag: 'Work',     tagClass: 'tag-orange', due: 'Today',     priority: 2, project: 'Sunrise' },
    { id: 't2', title: 'Reply to Mara about the studio',   done: false, tag: 'Personal', tagClass: 'tag-plum',   due: 'Today',     priority: 1, project: 'Inbox'   },
    { id: 't3', title: '30 min walk before lunch',         done: true,  tag: 'Wellbeing',tagClass: 'tag-sage',   due: 'Today',     priority: 0, project: 'Routines'},
    { id: 't4', title: "Review Linnea's research notes",   done: false, tag: 'Work',     tagClass: 'tag-orange', due: 'Tomorrow',  priority: 2, project: 'Sunrise' },
    { id: 't5', title: 'Order beans from Onyx',            done: false, tag: 'Personal', tagClass: 'tag-plum',   due: 'This week', priority: 0, project: 'Errands' },
    { id: 't6', title: 'Plan weekend hike route',          done: false, tag: 'Personal', tagClass: 'tag-plum',   due: 'Sat',       priority: 1, project: 'Adventures' },
    { id: 't7', title: 'Two pages on the book chapter',    done: false, tag: 'Writing',  tagClass: 'tag-amber',  due: 'Today',     priority: 2, project: 'Memoir'  },
  ],
  recentNotes: [
    { id: 'n1', title: 'Studio visit — first impressions',         excerpt: 'Light coming in from the north wall, smell of cedar shavings. The owner spoke quietly, almost as if the room were listening.', updated: '2h ago',  tag: 'Journal' },
    { id: 'n2', title: 'Sunrise: positioning notes',               excerpt: 'We keep over-explaining. What if the homepage opened with a single question and a quiet animation?', updated: 'Yesterday', tag: 'Work' },
    { id: 'n3', title: 'Reading list — winter',                    excerpt: '· The Overstory · A Pattern Language · Letters to a Young Poet · Tinkers · The Sense of an Ending', updated: '2d',     tag: 'Reading' },
    { id: 'n4', title: 'Recipe — slow-roasted tomatoes',           excerpt: '300°F, 2 hours, with thyme and a splash of olive oil. Save the oil for vinaigrette.', updated: '4d', tag: 'Kitchen' },
    { id: 'n5', title: 'Conversation with M. about the cabin',     excerpt: 'A small porch facing east. One window. Nothing else needs to be decided yet.', updated: 'Last week', tag: 'Journal' },
  ],
  events: [
    { time: '09:00', end: '09:30', title: 'Morning pages',           where: 'Desk',           color: 'amber'  },
    { time: '10:30', end: '11:30', title: 'Sunrise weekly w/ Linnea',where: 'Hearth Room',    color: 'orange' },
    { time: '12:30', end: '13:15', title: 'Lunch — Café Lavanda',    where: 'Off-site',       color: 'plum'   },
    { time: '15:00', end: '16:00', title: 'Deep work: brief',        where: 'Focus',          color: 'orange' },
    { time: '18:00', end: '19:00', title: 'Pottery class',           where: 'Studio Eight',   color: 'sage'   },
  ],
  habits: [
    { name: 'Morning pages', streak: 12, today: true,  pct: 86 },
    { name: 'Walk 30 min',   streak: 8,  today: true,  pct: 71 },
    { name: 'Read 20 min',   streak: 21, today: false, pct: 92 },
    { name: 'No phone @ 9pm',streak: 3,  today: false, pct: 43 },
  ],
  books: [
    { id:'b1', title:'A Pattern Language',         author:'Christopher Alexander', pct: 64, tag: 'Architecture' },
    { id:'b2', title:'The Overstory',              author:'Richard Powers',        pct: 22, tag: 'Fiction'      },
    { id:'b3', title:'Letters to a Young Poet',    author:'Rainer Maria Rilke',    pct: 88, tag: 'Essays'       },
    { id:'b4', title:'Tinkers',                    author:'Paul Harding',          pct: 12, tag: 'Fiction'      },
    { id:'b5', title:'Annals of the Former World', author:'John McPhee',           pct:  4, tag: 'Geology'      },
  ],
  activity: [
    { who: 'Mara',   what: 'left a comment on',  obj: 'Sunrise: positioning notes', when: '14m' },
    { who: 'You',    what: 'completed',           obj: '30 min walk before lunch',   when: '1h' },
    { who: 'Linnea', what: 'shared a file in',    obj: 'Hearth Room',                when: '3h' },
    { who: 'You',    what: 'pinned a note',       obj: 'Studio visit — first impressions', when: 'Yesterday' },
  ],
  navItems: [
    { id:'today',   label:'Today',     icon:'Today',  badge: 3 },
    { id:'tasks',   label:'Tasks',     icon:'Tasks',  badge: 7 },
    { id:'notes',   label:'Notes',     icon:'Notes' },
    { id:'cal',     label:'Calendar',  icon:'Cal' },
    { id:'library', label:'Library',   icon:'Book' },
    { id:'inbox',   label:'Inbox',     icon:'Inbox',  badge: 2 },
  ],
  pinned: [
    { id:'p1', label:'Sunrise',     icon:'Hash',   color:'#C97B5D' },
    { id:'p2', label:'Memoir',      icon:'Hash',   color:'#9A6B7E' },
    { id:'p3', label:'Adventures',  icon:'Hash',   color:'#8FA284' },
    { id:'p4', label:'Routines',    icon:'Hash',   color:'#D4A256' },
  ],
};

// ============ THAI ============
const data_th = {
  initialTasks: [
    { id: 't1', title: 'ร่างบรีฟผลิตภัณฑ์ ไตรมาส 3',         done: false, tag: 'งาน',      tagClass: 'tag-orange', due: 'วันนี้',     priority: 2, project: 'ซันไรส์'    },
    { id: 't2', title: 'ตอบมาร่าเรื่องสตูดิโอ',              done: false, tag: 'ส่วนตัว',  tagClass: 'tag-plum',   due: 'วันนี้',     priority: 1, project: 'กล่องเข้า'  },
    { id: 't3', title: 'เดิน 30 นาทีก่อนมื้อเที่ยง',         done: true,  tag: 'สุขภาพ',   tagClass: 'tag-sage',   due: 'วันนี้',     priority: 0, project: 'กิจวัตร'    },
    { id: 't4', title: 'ตรวจโน้ตวิจัยของลินเนีย',            done: false, tag: 'งาน',      tagClass: 'tag-orange', due: 'พรุ่งนี้',   priority: 2, project: 'ซันไรส์'    },
    { id: 't5', title: 'สั่งเมล็ดกาแฟจาก Onyx',              done: false, tag: 'ส่วนตัว',  tagClass: 'tag-plum',   due: 'สัปดาห์นี้', priority: 0, project: 'ธุระ'       },
    { id: 't6', title: 'วางแผนเส้นทางเดินป่าสุดสัปดาห์',     done: false, tag: 'ส่วนตัว',  tagClass: 'tag-plum',   due: 'เสาร์',      priority: 1, project: 'ผจญภัย'     },
    { id: 't7', title: 'เขียนหนังสือต่อสองหน้า',             done: false, tag: 'งานเขียน', tagClass: 'tag-amber',  due: 'วันนี้',     priority: 2, project: 'บันทึกความทรงจำ' },
  ],
  recentNotes: [
    { id: 'n1', title: 'ไปเยี่ยมสตูดิโอ — ความรู้สึกแรก',  excerpt: 'แสงสาดเข้ามาจากผนังด้านเหนือ กลิ่นไม้ซีดาร์ลอยอบอวล เจ้าของห้องพูดเบาๆ ราวกับว่าห้องกำลังตั้งใจฟัง',                          updated: '2 ชม.ก่อน',   tag: 'ไดอารี่' },
    { id: 'n2', title: 'ซันไรส์: โน้ตการวางตำแหน่ง',       excerpt: 'เราอธิบายมากเกินไป — ถ้าหน้าแรกเปิดด้วยคำถามเดียวกับแอนิเมชั่นเงียบๆ จะเป็นอย่างไรนะ',                                       updated: 'เมื่อวาน',    tag: 'งาน' },
    { id: 'n3', title: 'รายการอ่าน — ฤดูหนาว',             excerpt: '· The Overstory · A Pattern Language · Letters to a Young Poet · Tinkers · The Sense of an Ending',                          updated: '2 วัน',       tag: 'การอ่าน' },
    { id: 'n4', title: 'สูตร — มะเขือเทศอบช้า',            excerpt: '150 องศา 2 ชั่วโมง โรยไทม์เล็กน้อย ราดน้ำมันมะกอก เก็บน้ำมันที่เหลือไว้ทำน้ำสลัด',                                          updated: '4 วัน',       tag: 'ห้องครัว' },
    { id: 'n5', title: 'คุยกับ M. เรื่องกระท่อม',          excerpt: 'ระเบียงเล็กๆ หันหน้าไปทางทิศตะวันออก หน้าต่างบานเดียว ที่เหลือยังไม่ต้องตัดสินใจในตอนนี้',                                   updated: 'สัปดาห์ก่อน', tag: 'ไดอารี่' },
  ],
  events: [
    { time: '09:00', end: '09:30', title: 'เขียนยามเช้า',                where: 'โต๊ะทำงาน',    color: 'amber'  },
    { time: '10:30', end: '11:30', title: 'ประชุมรายสัปดาห์ ซันไรส์',    where: 'ห้องเฮิร์ธ',    color: 'orange' },
    { time: '12:30', end: '13:15', title: 'มื้อเที่ยง — คาเฟ่ลาวันด้า',  where: 'นอกออฟฟิศ',     color: 'plum'   },
    { time: '15:00', end: '16:00', title: 'ทำงานเชิงลึก: บรีฟ',          where: 'โหมดโฟกัส',     color: 'orange' },
    { time: '18:00', end: '19:00', title: 'คลาสปั้นเครื่องปั้น',          where: 'สตูดิโอแปด',    color: 'sage'   },
  ],
  habits: [
    { name: 'เขียนยามเช้า',          streak: 12, today: true,  pct: 86 },
    { name: 'เดิน 30 นาที',          streak: 8,  today: true,  pct: 71 },
    { name: 'อ่านหนังสือ 20 นาที',   streak: 21, today: false, pct: 92 },
    { name: 'ไม่ใช้มือถือหลัง 21:00',streak: 3,  today: false, pct: 43 },
  ],
  books: [
    { id:'b1', title:'A Pattern Language',         author:'คริสโตเฟอร์ อเล็กซานเดอร์', pct: 64, tag: 'สถาปัตยกรรม' },
    { id:'b2', title:'The Overstory',              author:'ริชาร์ด พาวเวอร์ส',          pct: 22, tag: 'นวนิยาย'     },
    { id:'b3', title:'Letters to a Young Poet',    author:'ไรเนอร์ มาเรีย ริลเก้',      pct: 88, tag: 'ความเรียง'   },
    { id:'b4', title:'Tinkers',                    author:'พอล ฮาร์ดิง',                pct: 12, tag: 'นวนิยาย'     },
    { id:'b5', title:'Annals of the Former World', author:'จอห์น แม็คฟี',                pct:  4, tag: 'ธรณีวิทยา'   },
  ],
  activity: [
    { who: 'มาร่า',   what: 'แสดงความคิดเห็นใน', obj: 'ซันไรส์: โน้ตการวางตำแหน่ง',  when: '14 นาที' },
    { who: 'คุณ',     what: 'ทำเสร็จ',           obj: 'เดิน 30 นาทีก่อนมื้อเที่ยง', when: '1 ชม.' },
    { who: 'ลินเนีย', what: 'แชร์ไฟล์ใน',        obj: 'ห้องเฮิร์ธ',                  when: '3 ชม.' },
    { who: 'คุณ',     what: 'ปักหมุดบันทึก',     obj: 'ไปเยี่ยมสตูดิโอ — ความรู้สึกแรก', when: 'เมื่อวาน' },
  ],
  navItems: [
    { id:'today',   label:'วันนี้',    icon:'Today',  badge: 3 },
    { id:'tasks',   label:'งาน',       icon:'Tasks',  badge: 7 },
    { id:'notes',   label:'บันทึก',    icon:'Notes' },
    { id:'cal',     label:'ปฏิทิน',    icon:'Cal' },
    { id:'library', label:'ห้องสมุด',  icon:'Book' },
    { id:'inbox',   label:'กล่องเข้า', icon:'Inbox',  badge: 2 },
  ],
  pinned: [
    { id:'p1', label:'ซันไรส์',           icon:'Hash', color:'#C97B5D' },
    { id:'p2', label:'บันทึกความทรงจำ',  icon:'Hash', color:'#9A6B7E' },
    { id:'p3', label:'ผจญภัย',            icon:'Hash', color:'#8FA284' },
    { id:'p4', label:'กิจวัตร',           icon:'Hash', color:'#D4A256' },
  ],
};

// Current lang lives on window so view code can read it without prop drilling.
window.__lang = window.__lang || 'en';

function applyLang(lang) {
  window.__lang = lang;
  const d = lang === 'th' ? data_th : data_en;
  // Reassign the globals so views read fresh data on next render.
  Object.assign(window, d);
}

// Inline localizer for UI chrome strings.
function L(en, th) {
  return window.__lang === 'th' ? th : en;
}

applyLang(window.__lang);

Object.assign(window, { applyLang, L, data_en, data_th });
// Re-export for legacy references
Object.assign(window, data_en);
