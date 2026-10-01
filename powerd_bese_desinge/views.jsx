// ----------------------------- Shared bits -----------------------------
const Avatar = ({ name = 'AB', color = '#C97B5D', size = 28 }) =>
<span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}>{name}</span>;


const Section = ({ title, children, action, className = '' }) =>
<section className={"card p-5 " + className}>
    {title &&
  <header className="flex items-center justify-between mb-4">
        <h3 className="font-serif-display text-[22px] leading-none ink">{title}</h3>
        {action}
      </header>
  }
    {children}
  </section>;


const Ring = ({ pct = 70, size = 44, stroke = 5, color }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (1 - pct / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="ring-bg" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
      strokeDasharray={c} strokeDashoffset={dash}
      transform={`rotate(-90 ${size / 2} ${size / 2})`}
      style={{ stroke: color || 'var(--terracotta)' }}
      className="ring-fg" />
    </svg>);

};

// ----------------------------- Sidebar -----------------------------
function Sidebar({ active, onNav, collapsed }) {
  const I = (name) => Icon[name] || Icon.Home;
  return (
    <aside className="shrink-0 hairline border-r flex flex-col" style={{ width: collapsed ? 72 : 256, transition: 'width .25s ease', background: 'var(--cream-2)' }}>
      {/* Brand */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center"
        style={{ background: 'linear-gradient(180deg, #E89976 0%, #C97B5D 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 10px -4px rgba(201,123,93,0.5)' }}>
          {/* original mark: a soft hearth/arch */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M5 20V12a7 7 0 0 1 14 0v8" stroke="#FFF8EE" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="14" r="2" fill="#FFF8EE" />
          </svg>
        </div>
        {!collapsed &&
        <div>
            <div className="font-serif-display text-[20px] leading-none ink">Hearth</div>
            <div className="text-[11px] muted -mt-0.5">{L('your cozy workspace', 'พื้นที่ทำงานอบอุ่นของคุณ')}</div>
          </div>
        }
      </div>

      {/* Workspace switcher */}
      {!collapsed &&
      <div className="px-3 pt-1 pb-3">
          <div className="ws">
            <Avatar name="L" color="#C97B5D" size={26} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium ink truncate">{L('Linnea & Co.', 'ลินเนีย แอนด์ โค.')}</div>
              <div className="text-[11px] muted truncate">{L('Personal · 4 members', 'ส่วนตัว · 4 สมาชิก')}</div>
            </div>
            <Icon.ChevronDown size={14} />
          </div>
        </div>
      }

      {/* Search shortcut */}
      {!collapsed &&
      <div className="px-3 pb-2">
          <button className="w-full flex items-center gap-2.5 text-left input" style={{ padding: '8px 10px' }}>
            <Icon.Search size={15} />
            <span className="text-[13px] muted flex-1">{L('Search or jump to…', 'ค้นหาหรือไปยัง…')}</span>
            <span className="font-mono text-[10px] muted px-1.5 py-0.5 rounded border hairline">⌘K</span>
          </button>
        </div>
      }

      {/* Nav */}
      <nav className="px-3 pt-2 flex-1 scroll-y">
        <div className="flex flex-col gap-0.5">
          {navItems.map((n) => {
            const I = Icon[n.icon];
            return (
              <div key={n.id} className={"nav-item " + (active === n.id ? 'active' : '')} onClick={() => onNav(n.id)}>
                <I size={17} />
                {!collapsed && <span className="flex-1" style={{ fontFamily: "Lato" }}>{n.label}</span>}
                {!collapsed && n.badge && <span className="text-[11px] muted">{n.badge}</span>}
              </div>);

          })}
        </div>

        {!collapsed &&
        <>
            <div className="px-2 pt-5 pb-2 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.08em] muted">{L('Pinned', 'ปักหมุด')}</span>
              <Icon.Plus size={13} className="muted cursor-pointer" />
            </div>
            <div className="flex flex-col gap-0.5">
              {pinned.map((p) =>
            <div key={p.id} className="nav-item">
                  <span className="w-2 h-2 rounded-full" style={{ background: p.color }}></span>
                  <span>{p.label}</span>
                </div>
            )}
            </div>

            <div className="px-2 pt-5 pb-2">
              <span className="text-[11px] uppercase tracking-[0.08em] muted">{L('Spaces', 'พื้นที่')}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="nav-item"><Icon.Folder size={16} /><span>{L('Sunrise Studio', 'ซันไรส์ สตูดิโอ')}</span></div>
              <div className="nav-item"><Icon.Folder size={16} /><span>{L('The Cabin', 'กระท่อมน้อย')}</span></div>
              <div className="nav-item"><Icon.Folder size={16} /><span>{L('Shared with me', 'แชร์กับฉัน')}</span></div>
            </div>
          </>
        }
      </nav>

      {/* Footer */}
      <div className="p-3 hairline border-t">
        {!collapsed ?
        <div className="flex items-center gap-2.5">
            <Avatar name="AR" color="#8B6F56" size={30} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium ink truncate">{L('Anya Reyes', 'อัญญา เรเยส')}</div>
              <div className="text-[11px] muted truncate">anya@hearth.app</div>
            </div>
            <button className="btn-ghost p-1.5"><Icon.Cog size={16} /></button>
          </div> :

        <div className="flex justify-center"><Avatar name="AR" color="#8B6F56" /></div>
        }
      </div>
    </aside>);

}

// ----------------------------- Top Header -----------------------------
function TopHeader({ view, onCommand }) {
  const titles = {
    today: L('Today', 'วันนี้'),
    tasks: L('Tasks', 'งาน'),
    notes: L('Notes', 'บันทึก'),
    cal: L('Calendar', 'ปฏิทิน'),
    library: L('Library', 'ห้องสมุด'),
    inbox: L('Inbox', 'กล่องเข้า'),
    settings: L('Settings', 'ตั้งค่า')
  };
  const subs = {
    today: L('Tuesday, May 20 · A gentle start.', 'วันอังคารที่ 20 พ.ค. · เริ่มต้นวันอย่างเบาๆ'),
    tasks: L('7 open, 1 done · Sorted by priority', '7 งานเปิด, 1 เสร็จ · เรียงตามความสำคัญ'),
    notes: L('128 notes across 6 collections', '128 บันทึก ใน 6 คอลเลกชัน'),
    cal: L('May 2026 · Week 21', 'พฤษภาคม 2026 · สัปดาห์ที่ 21'),
    library: L('12 books · 4 currently reading', '12 เล่ม · กำลังอ่าน 4 เล่ม'),
    inbox: L('2 new updates', 'อัปเดตใหม่ 2 รายการ'),
    settings: L('Manage your workspace', 'จัดการพื้นที่ทำงานของคุณ')
  };
  return (
    <header className="glass sticky top-0 z-20">
      <div className="flex items-center gap-4 px-8 py-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[12px] muted">
            <span>{L('Linnea & Co.', 'ลินเนีย แอนด์ โค.')}</span>
            <Icon.Chevron size={11} />
            <span>{titles[view]}</span>
          </div>
          <h1 className="font-serif-display text-[28px] leading-tight ink truncate">{titles[view]}</h1>
          <div className="text-[13px] muted -mt-0.5">{subs[view]}</div>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <button className="btn-ghost flex items-center gap-2" title="Toggle theme">
            <Icon.Sun size={16} />
          </button>
          <button className="btn-ghost flex items-center gap-2 relative" title="Notifications">
            <Icon.Bell size={16} />
            <span className="ndot absolute" style={{ top: 6, right: 6 }}></span>
          </button>
          <div className="w-px h-6" style={{ background: 'var(--hairline)' }}></div>
          <button className="btn-ghost flex items-center gap-2" onClick={() => onCommand && onCommand('new')}>
            <Icon.Sparkle size={15} />
            <span className="text-[13px]">{L('Ask Hearth', 'ถามเฮิร์ธ')}</span>
          </button>
          <button className="btn-accent flex items-center gap-2" onClick={() => onCommand && onCommand('new')}>
            <Icon.Plus size={14} />
            <span>{L('New', 'สร้างใหม่')}</span>
          </button>
        </div>
      </div>
    </header>);

}

// ----------------------------- Today View -----------------------------
function TodayView({ tasks, setTasks }) {
  const toggleTask = (id) => setTasks((ts) => ts.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  const today = tasks.filter((t) => t.due === 'Today');
  const doneCount = today.filter((t) => t.done).length;
  const focus = today.find((t) => !t.done && t.priority === 2) || today.find((t) => !t.done);

  // sparkline points
  const sparkData = [3, 5, 4, 7, 6, 9, 8, 11, 9, 12, 10, 13];
  const max = Math.max(...sparkData);
  const points = sparkData.map((v, i) => `${i / (sparkData.length - 1) * 100},${40 - v / max * 36}`).join(' ');
  const areaPath = `M0,40 L${points} L100,40 Z`;
  const linePath = `M${points.split(' ').map((p, i) => (i === 0 ? '' : 'L') + p).join(' ')}`;

  return (
    <div className="view space-y-6">
      {/* Welcome row */}
      <div className="card-warm p-7 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full opacity-50"
        style={{ background: 'radial-gradient(circle, rgba(212,162,86,0.35) 0%, transparent 65%)' }}></div>
        <div className="relative flex items-center justify-between gap-6 flex-wrap">
          <div className="max-w-[640px]">
            <div className="flex items-center gap-2 mb-2">
              <Icon.Coffee size={16} />
              <span className="text-[12px] uppercase tracking-[0.12em] muted">{L('Good morning, Anya', 'อรุณสวัสดิ์ อัญญา')}</span>
            </div>
            <h2 className="font-serif-display text-[40px] leading-[1.05] ink">
              {L("The kettle's on. ", 'กาน้ำต้มแล้ว ')}<span style={{ color: 'var(--terracotta)' }}>{L('Three things', 'สามสิ่งเล็กๆ')}</span>{L(' would make today feel complete.', ' จะทำให้วันนี้สมบูรณ์')}
            </h2>
            <p className="quote ink-2 text-[16px] mt-3 max-w-[520px]">
              {L('"Begin doing what you want to do now. We have only this moment, sparkling like a star in our hand—and melting like a snowflake."', '"จงเริ่มทำสิ่งที่อยากทำตั้งแต่บัดนี้ เรามีเพียงห้วงเวลานี้ — เปล่งประกายดั่งดาวในมือ และละลายดั่งเกล็ดหิมะ"')}
              <span className="muted text-[13px] block mt-1 not-italic font-mono">— Marie Beynon Ray</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[12px] muted">{L("Today's progress", 'ความคืบหน้าวันนี้')}</div>
                <div className="font-serif-display text-[28px] ink leading-none mt-1">{doneCount}<span className="muted text-[18px]"> / {today.length}</span></div>
              </div>
              <Ring pct={today.length ? doneCount / today.length * 100 : 0} size={56} stroke={6} />
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost text-[13px]">{L('View week', 'ดูทั้งสัปดาห์')}</button>
              <button className="btn-primary">{L('Start focus session', 'เริ่มโฟกัส')}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Three-column main */}
      <div className="grid grid-cols-12 gap-6">
        {/* Focus + Tasks */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {focus &&
          <Section title={L('Your focus', 'โฟกัสของคุณ')} action={
          <div className="flex items-center gap-2">
                <span className="chip flex items-center gap-1.5"><Icon.Clock size={12} /> {L('45 min', '45 นาที')}</span>
                <button className="btn-ghost text-[13px]">{L('Change', 'เปลี่ยน')}</button>
              </div>
          }>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: '#FBE6D7' }}>
                  <Icon.Flag size={22} fill="none" />
                </div>
                <div className="flex-1">
                  <div className="text-[12px] muted mb-0.5">{focus.project} · {focus.tag}</div>
                  <div className="font-serif-display text-[24px] ink leading-tight">{focus.title}</div>
                </div>
                <button className="btn-accent flex items-center gap-2"><Icon.Sparkle size={14} /> {L('Begin', 'เริ่ม')}</button>
              </div>
            </Section>
          }

          <Section title={L('Today', 'วันนี้')} action={
          <div className="flex items-center gap-2">
              <button className="btn-ghost text-[13px] flex items-center gap-1.5"><Icon.Filter size={13} /> {L('All', 'ทั้งหมด')}</button>
              <button className="btn-ghost text-[13px] flex items-center gap-1.5"><Icon.Plus size={13} /> {L('Add task', 'เพิ่มงาน')}</button>
            </div>
          }>
            <ul className="flex flex-col gap-1">
              {today.length === 0 &&
              <li className="py-10 flex flex-col items-center text-center gap-3">
                  <div className="empty-illu"><Icon.Sparkle size={28} /></div>
                  <div className="font-serif-display text-[20px] ink">{L('Nothing on the plate.', 'วันนี้ว่างสบายๆ')}</div>
                  <div className="text-[13px] muted">{L('A clear day. Maybe a walk?', 'วันโล่งๆ ลองออกไปเดินเล่นไหม?')}</div>
                </li>
              }
              {today.map((t) =>
              <li key={t.id} className="row-hover flex items-center gap-3 px-2 py-2.5 rounded-xl cursor-pointer">
                  <span className={"check " + (t.done ? 'done' : '')} onClick={() => toggleTask(t.id)}>
                    {t.done && <Icon.Check size={12} sw={2.4} stroke="#FFF8EE" />}
                  </span>
                  <span className={"flex-1 text-[14px] " + (t.done ? 'muted line-through' : 'ink')}>{t.title}</span>
                  <span className={"tag " + t.tagClass}>{t.tag}</span>
                  <span className="text-[12px] muted hidden md:inline w-24 text-right">{t.project}</span>
                  <Icon.More size={16} className="muted" />
                </li>
              )}
            </ul>
          </Section>

          <Section title={L('A glance at the week', 'ภาพรวมสัปดาห์')} action={<button className="btn-ghost text-[13px]">{L('Open calendar →', 'เปิดปฏิทิน →')}</button>}>
            <div className="grid grid-cols-7 gap-2">
              {(window.__lang === 'th' ? ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).map((d, i) => {
                const isToday = i === 1;
                const dot = [2, 3, 1, 4, 2, 0, 1][i];
                return (
                  <div key={d} className={"rounded-xl p-3 text-center border " + (isToday ? '' : 'hairline')}
                  style={{ background: isToday ? '#FBE6D7' : '#FFFDF8', borderColor: isToday ? '#E8C2AA' : undefined }}>
                    <div className={"text-[11px] uppercase tracking-wider " + (isToday ? '' : 'muted')} style={{ color: isToday ? 'var(--terracotta-2)' : undefined }}>{d}</div>
                    <div className={"font-serif-display text-[22px] mt-1 " + (isToday ? '' : 'ink')} style={{ color: isToday ? 'var(--terracotta-2)' : undefined }}>{18 + i}</div>
                    <div className="flex justify-center gap-1 mt-2 h-1.5">
                      {Array.from({ length: dot }).map((_, k) =>
                      <span key={k} className="w-1.5 h-1.5 rounded-full" style={{ background: isToday ? 'var(--terracotta)' : 'var(--beige-2)' }}></span>
                      )}
                    </div>
                  </div>);

              })}
            </div>
          </Section>
        </div>

        {/* Right column */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Section title={L('Schedule', 'ตารางวันนี้')} action={<span className="chip">{events.length} {L('events', 'รายการ')}</span>}>
            <ol className="relative">
              <div className="absolute left-[58px] top-1 bottom-1 w-px" style={{ background: 'var(--hairline)' }}></div>
              {events.map((e, i) =>
              <li key={i} className="flex gap-4 py-2.5">
                  <div className="w-12 text-right pt-0.5">
                    <div className="text-[12px] font-mono ink-2">{e.time}</div>
                    <div className="text-[10px] muted">{e.end}</div>
                  </div>
                  <div className="relative pl-5">
                    <span className="absolute left-0 top-2 w-2 h-2 rounded-full"
                  style={{ background: e.color === 'orange' ? 'var(--terracotta)' : e.color === 'sage' ? 'var(--sage)' : e.color === 'plum' ? 'var(--plum)' : 'var(--amber)' }}></span>
                    <div className="text-[14px] ink leading-tight">{e.title}</div>
                    <div className="text-[12px] muted">{e.where}</div>
                  </div>
                </li>
              )}
            </ol>
          </Section>

          <Section title={L('Habits', 'กิจวัตร')} action={<button className="btn-ghost text-[13px]">{L('All habits', 'ทั้งหมด')}</button>}>
            <div className="grid grid-cols-2 gap-3">
              {habits.map((h, i) =>
              <div key={i} className="p-3 rounded-2xl flex items-center gap-3" style={{ background: '#FBF6EB', border: '1px solid var(--hairline)' }}>
                  <Ring pct={h.pct} size={42} stroke={5} color={h.today ? 'var(--terracotta)' : 'var(--sage)'} />
                  <div className="min-w-0">
                    <div className="text-[13px] ink truncate">{h.name}</div>
                    <div className="text-[11px] muted">{L(`${h.streak} day streak`, `ต่อเนื่อง ${h.streak} วัน`)}</div>
                  </div>
                </div>
              )}
            </div>
          </Section>

          <Section>
            <div className="flex items-center justify-between mb-1">
              <div>
                <div className="text-[12px] muted uppercase tracking-wider">{L('Quiet hours', 'ช่วงเงียบสงบ')}</div>
                <div className="font-serif-display text-[22px] ink leading-tight">{L('Notifications paused', 'หยุดแจ้งเตือนชั่วคราว')}</div>
                <div className="text-[12px] muted">{L('Until 1:30 PM', 'จนถึง 13:30')}</div>
              </div>
              <div className="toggle on"></div>
            </div>
            <div className="mt-3 -mx-1">
              <svg viewBox="0 0 100 40" width="100%" height="44" preserveAspectRatio="none">
                <path d={areaPath} className="spark-area" />
                <path d={linePath} className="spark" />
              </svg>
              <div className="flex justify-between text-[10px] muted font-mono px-1">
                <span>{L('9a', '9น.')}</span><span>{L('12p', '12น.')}</span><span>{L('3p', '15น.')}</span><span>{L('6p', '18น.')}</span><span>{L('now', 'ตอนนี้')}</span>
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* Recent notes + Activity row */}
      <div className="grid grid-cols-12 gap-6">
        <Section className="col-span-12 lg:col-span-8" title={L('Recent notes', 'บันทึกล่าสุด')} action={<button className="btn-ghost text-[13px] flex items-center gap-1.5"><Icon.ArrowRight size={13} /> {L('All notes', 'บันทึกทั้งหมด')}</button>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recentNotes.slice(0, 4).map((n) =>
            <div key={n.id} className="p-4 rounded-2xl cursor-pointer" style={{ background: '#FBF6EB', border: '1px solid var(--hairline)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="tag tag-amber">{n.tag}</span>
                  <span className="text-[11px] muted">{n.updated}</span>
                </div>
                <div className="font-serif-display text-[18px] ink leading-tight">{n.title}</div>
                <p className="text-[13px] ink-2 mt-1.5 line-clamp-2" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.excerpt}</p>
              </div>
            )}
          </div>
        </Section>

        <Section className="col-span-12 lg:col-span-4" title={L('Activity', 'กิจกรรม')}>
          <ul className="space-y-3">
            {activity.map((a, i) =>
            <li key={i} className="flex gap-3">
                <Avatar name={a.who === 'You' ? 'AR' : a.who.slice(0, 1)} color={a.who === 'Mara' ? '#9A6B7E' : a.who === 'Linnea' ? '#8FA284' : '#8B6F56'} />
                <div className="text-[13px] ink-2 leading-snug">
                  <span className="ink font-medium">{a.who}</span> {a.what} <span className="ink">{a.obj}</span>
                  <div className="text-[11px] muted">{L(`${a.when} ago`, `${a.when}ที่ผ่านมา`)}</div>
                </div>
              </li>
            )}
          </ul>
        </Section>
      </div>
    </div>);

}

// ----------------------------- Tasks View (kanban) -----------------------------
function TasksView({ tasks, setTasks }) {
  const T = (s) => L(s, { 'Today':'วันนี้', 'Tomorrow':'พรุ่งนี้', 'This week':'สัปดาห์นี้' }[s] || s);
  const groups = {
    'Today': tasks.filter((t) => t.due === 'Today'),
    'Tomorrow': tasks.filter((t) => t.due === 'Tomorrow'),
    'This week': tasks.filter((t) => ['This week', 'Sat'].includes(t.due))
  };
  const toggle = (id) => setTasks((ts) => ts.map((t) => t.id === id ? { ...t, done: !t.done } : t));

  return (
    <div className="view space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button className="chip" style={{ background: '#FFFDF8' }}>{L('All','ทั้งหมด')}</button>
          <button className="chip">{L('Work','งาน')}</button>
          <button className="chip">{L('Personal','ส่วนตัว')}</button>
          <button className="chip">{L('Writing','งานเขียน')}</button>
          <button className="chip">{L('Wellbeing','สุขภาพ')}</button>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost text-[13px] flex items-center gap-1.5"><Icon.Filter size={13} /> {L('Filter','ตัวกรอง')}</button>
          <button className="btn-ghost text-[13px] flex items-center gap-1.5"><Icon.Tag size={13} /> {L('Group: due date','จัดกลุ่ม: วันครบกำหนด')}</button>
          <button className="btn-accent flex items-center gap-2"><Icon.Plus size={14} /> {L('New task','งานใหม่')}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {Object.entries(groups).map(([title, items]) =>
        <div key={title} className="kcol">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="font-serif-display text-[20px] ink">{T(title)}</span>
                <span className="chip">{items.length}</span>
              </div>
              <button className="btn-ghost p-1.5"><Icon.Plus size={14} /></button>
            </div>
            <div className="space-y-2.5">
              {items.map((t) =>
            <div key={t.id} className="card p-3.5">
                  <div className="flex items-start gap-3">
                    <span className={"check mt-0.5 " + (t.done ? 'done' : '')} onClick={() => toggle(t.id)}>
                      {t.done && <Icon.Check size={12} sw={2.4} stroke="#FFF8EE" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={"text-[14px] " + (t.done ? 'muted line-through' : 'ink')}>{t.title}</div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={"tag " + t.tagClass}>{t.tag}</span>
                        <span className="text-[11px] muted flex items-center gap-1"><Icon.Folder size={11} /> {t.project}</span>
                        {t.priority === 2 && <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--terracotta-2)' }}><Icon.Flag size={11} /> {L('High','สำคัญ')}</span>}
                      </div>
                    </div>
                  </div>
                </div>
            )}
              <button className="w-full text-[13px] muted py-2 rounded-xl hover:bg-[#F3EAD9]/50 transition-colors">{L('+ Add task','+ เพิ่มงาน')}</button>
            </div>
          </div>
        )}
      </div>
    </div>);

}

// ----------------------------- Notes View -----------------------------
function NotesView() {
  const collections = window.__lang==='th' ? [
  { name: 'ไดอารี่',     count: 42, color: '#C97B5D' },
  { name: 'งาน',         count: 31, color: '#8FA284' },
  { name: 'การอ่าน',     count: 18, color: '#9A6B7E' },
  { name: 'ห้องครัว',    count: 14, color: '#D4A256' },
  { name: 'ผจญภัย',       count: 12, color: '#8B6F56' },
  { name: 'กล่องเข้า',   count: 11, color: '#7A8FA5' }] : [
  { name: 'Journal', count: 42, color: '#C97B5D' },
  { name: 'Work', count: 31, color: '#8FA284' },
  { name: 'Reading', count: 18, color: '#9A6B7E' },
  { name: 'Kitchen', count: 14, color: '#D4A256' },
  { name: 'Adventures', count: 12, color: '#8B6F56' },
  { name: 'Inbox', count: 11, color: '#7A8FA5' }];

  return (
    <div className="view grid grid-cols-12 gap-6">
      {/* Collections */}
      <div className="col-span-12 lg:col-span-3">
        <Section title={L('Collections','คอลเลกชัน')} action={<button className="btn-ghost p-1"><Icon.Plus size={14} /></button>}>
          <div className="flex flex-col gap-1">
            {collections.map((c, i) =>
            <button key={i} className="nav-item">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c.color }}></span>
                <span className="flex-1 text-left">{c.name}</span>
                <span className="text-[11px] muted">{c.count}</span>
              </button>
            )}
          </div>
          <div className="divider my-3"></div>
          <div className="text-[11px] uppercase tracking-wider muted px-2 mb-1">{L('Tags','แท็ก')}</div>
          <div className="flex flex-wrap gap-1.5 px-1">
            {['ideas', 'sunrise', 'quiet', 'recipes', 'quotes', 'dreams', 'places'].map((t) =>
            <span key={t} className="tag tag-amber cursor-pointer">#{t}</span>
            )}
          </div>
        </Section>
      </div>

      {/* Note list + preview */}
      <div className="col-span-12 lg:col-span-9 grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-5 card p-2">
          <div className="px-3 py-2 flex items-center gap-2">
            <Icon.Search size={14} className="muted" />
            <input className="bg-transparent outline-none flex-1 text-[13px]" placeholder={L('Filter notes…','กรองบันทึก…')} />
          </div>
          <div className="divider"></div>
          <div className="scroll-y" style={{ maxHeight: 600 }}>
            {recentNotes.map((n, i) =>
            <div key={n.id} className={"p-3 rounded-xl cursor-pointer " + (i === 0 ? 'bg-beige' : '')}
            style={i === 0 ? { border: '1px solid var(--hairline)' } : null}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] muted">{n.tag}</span>
                  <span className="text-[11px] muted">{n.updated}</span>
                </div>
                <div className="font-medium text-[14px] ink leading-tight">{n.title}</div>
                <div className="text-[12px] muted mt-0.5 line-clamp-2"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.excerpt}</div>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-12 md:col-span-7 card p-7">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="tag tag-orange">{L('Journal','ไดอารี่')}</span>
              <span className="text-[12px] muted">{L('Updated 2h ago · 312 words','แก้ไข 2 ชม.ก่อน · 312 คำ')}</span>
            </div>
            <div className="flex items-center gap-1">
              <button className="btn-ghost p-1.5"><Icon.Pin size={15} /></button>
              <button className="btn-ghost p-1.5"><Icon.More size={15} /></button>
            </div>
          </div>
          <h2 className="font-serif-display text-[34px] ink leading-tight mb-4">{L('Studio visit — first impressions','ไปเยี่ยมสตูดิโอ — ความรู้สึกแรก')}</h2>
          <div className="space-y-3.5 text-[15px] ink-2 leading-[1.7]">
            <p>{L('Light coming in from the north wall, smell of cedar shavings. The owner spoke quietly, almost as if the room were listening. A bench beneath the window, two stools, a kettle on the floor like an afterthought.', 'แสงสาดเข้ามาจากผนังด้านเหนือ กลิ่นไม้ซีดาร์ลอยอบอวล เจ้าของห้องพูดเบาๆ ราวกับว่าห้องกำลังตั้งใจฟัง มีม้านั่งตัวหนึ่งใต้หน้าต่าง สตูลสองตัว และกาน้ำบนพื้นราวกับถูกลืมวางเอาไว้')}</p>
            <p>{L("I asked about the rent. She said it depended on what I'd make there, which struck me as both impractical and exactly right. We agreed I'd think about it for a week.", 'ฉันถามเรื่องค่าเช่า เธอบอกว่าขึ้นอยู่กับสิ่งที่ฉันจะสร้างขึ้นที่นั่น ฟังแล้วรู้สึกทั้งไม่เหมาะสมและถูกต้องไปพร้อมกัน เราตกลงกันว่าฉันจะคิดดูสักอาทิตย์')}</p>
            <div className="img-ph rounded-xl" style={{ height: 180 }}>{L('insert · studio photo · 1600×1000','ใส่ · รูปสตูดิโอ · 1600×1000')}</div>
            <p>{L("On the way home I kept turning over a sentence she'd said about the difference between a place to work and a place to be. I'd been making the first kind for years. I'm not sure I've ever made the second.",'ระหว่างทางกลับบ้าน ฉันคิดถึงประโยคที่เธอพูดถึงความต่างระหว่าง "ที่ที่ไว้ทำงาน" กับ "ที่ที่ไว้เป็น" ฉันสร้างแบบแรกมาหลายปี ไม่แน่ใจว่าเคยสร้างแบบหลังไหม')}</p>
            <blockquote className="quote text-[18px] ink pl-4 border-l-2" style={{ borderColor: 'var(--terracotta)' }}>
              {L('"A room is finished when you stop wanting to leave it."','"ห้องหนึ่งจะสมบูรณ์ก็ต่อเมื่อเราไม่อยากจะออกจากมันอีกต่อไป"')}
            </blockquote>
          </div>
        </div>
      </div>
    </div>);

}

// ----------------------------- Calendar View -----------------------------
function CalendarView() {
  // build a month grid for May 2026 — May 1 2026 is a Friday
  const offset = 4; // 0=Sun ... we start week on Mon, so Friday is index 4
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push({ d: 27 + i, muted: true, prev: true });
  for (let i = 1; i <= 31; i++) cells.push({ d: i });
  while (cells.length % 7 !== 0) cells.push({ d: cells.length - (31 + offset) + 1, muted: true });

  const eventsByDay = window.__lang==='th' ? {
    20: [{ t: 'ลินเนีย 1:1', c: 'orange' }, { t: 'คลาสปั้นไห', c: 'sage' }],
    21: [{ t: 'ส่งบรีฟ', c: 'orange' }],
    22: [{ t: 'คาเฟ่ลาวันด้า', c: 'plum' }],
    23: [{ t: 'เดินป่า Bear Cr.', c: 'sage' }],
    25: [{ t: 'นั่งสตูดิโอ', c: 'amber' }, { t: 'ชมรมหนังสือ', c: 'plum' }],
    27: [{ t: 'ทบทวนโน้ต', c: 'orange' }],
    28: [{ t: 'Off-site', c: 'orange' }, { t: 'รับกาแฟ Onyx', c: 'amber' }]
  } : {
    20: [{ t: 'Linnea 1:1', c: 'orange' }, { t: 'Pottery class', c: 'sage' }],
    21: [{ t: 'Brief due', c: 'orange' }],
    22: [{ t: 'Café Lavanda', c: 'plum' }],
    23: [{ t: 'Hike — Bear Cr.', c: 'sage' }],
    25: [{ t: 'Studio sit', c: 'amber' }, { t: 'Book club', c: 'plum' }],
    27: [{ t: 'Review notes', c: 'orange' }],
    28: [{ t: 'Off-site', c: 'orange' }, { t: 'Onyx pickup', c: 'amber' }]
  };

  return (
    <div className="view space-y-4">
      <div className="card p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="btn-ghost p-1.5"><Icon.ChevronLeft size={16} /></button>
          <span className="font-serif-display text-[22px] ink px-2">{L('May 2026','พฤษภาคม 2026')}</span>
          <button className="btn-ghost p-1.5"><Icon.Chevron size={16} /></button>
          <button className="chip ml-2">{L('Today','วันนี้')}</button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-beige rounded-xl p-1">
            <button className="px-3 py-1 text-[12px] rounded-lg" style={{ background: '#FFFDF8', border: '1px solid var(--hairline)' }}>{L('Month','เดือน')}</button>
            <button className="px-3 py-1 text-[12px] rounded-lg muted">{L('Week','สัปดาห์')}</button>
            <button className="px-3 py-1 text-[12px] rounded-lg muted">{L('Day','วัน')}</button>
          </div>
          <button className="btn-accent flex items-center gap-2"><Icon.Plus size={14} /> {L('Event','กิจกรรม')}</button>
        </div>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-7 gap-2 mb-2 px-1">
          {(window.__lang==='th' ? ['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).map((d) =>
          <div key={d} className="text-[11px] uppercase tracking-wider muted text-center">{d}</div>
          )}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((c, i) => {
            const isToday = !c.muted && c.d === 20;
            const evs = !c.muted ? eventsByDay[c.d] || [] : [];
            return (
              <div key={i} className={"cal-cell " + (c.muted ? 'muted ' : '') + (isToday ? 'today ' : '')}>
                <div className={"text-[12px] font-mono " + (isToday ? '' : '')} style={{ color: isToday ? 'var(--terracotta-2)' : undefined }}>
                  {c.d}
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {evs.map((e, k) => {
                    const bg = e.c === 'orange' ? '#FBE6D7' : e.c === 'sage' ? '#E3EBDB' : e.c === 'plum' ? '#ECDDE3' : '#F4E6C7';
                    const fg = e.c === 'orange' ? '#8E4A30' : e.c === 'sage' ? '#4B5C42' : e.c === 'plum' ? '#6B4254' : '#7A5A1D';
                    return <div key={k} className="cal-event" style={{ background: bg, color: fg }}>{e.t}</div>;
                  })}
                </div>
              </div>);

          })}
        </div>
      </div>
    </div>);

}

// ----------------------------- Library View -----------------------------
function LibraryView() {
  return (
    <div className="view space-y-6">
      <div className="grid grid-cols-12 gap-4">
        {(window.__lang==='th' ? [
        { label: 'อ่านปีนี้', value: '14', sub: '+3 จากปีก่อน' },
        { label: 'กำลังอ่าน', value: '4', sub: 'เฉลี่ยอ่านไป 36%' },
        { label: 'บนชั้นหนังสือ', value: '48', sub: 'ยืมมา 12 เล่ม' },
        { label: 'สตรีกการอ่าน', value: '21 วัน', sub: 'ยาวที่สุดปีนี้' }] : [
        { label: 'Books read this year', value: '14', sub: '+3 vs last year' },
        { label: 'Currently reading', value: '4', sub: 'avg 36% through' },
        { label: 'On your shelf', value: '48', sub: '12 borrowed' },
        { label: 'Reading streak', value: '21 days', sub: 'longest this year' }]).
        map((s, i) =>
        <div key={i} className="card p-4 col-span-6 lg:col-span-3">
            <div className="text-[12px] muted">{s.label}</div>
            <div className="font-serif-display text-[28px] ink mt-1 leading-none">{s.value}</div>
            <div className="text-[11px] muted mt-1">{s.sub}</div>
          </div>
        )}
      </div>

      <Section title={L('Currently reading','กำลังอ่าน')} action={<button className="btn-ghost text-[13px]">{L('All books →','หนังสือทั้งหมด →')}</button>}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map((b) =>
          <div key={b.id} className="flex gap-4 p-3.5 rounded-2xl items-center" style={{ background: '#FBF6EB', border: '1px solid var(--hairline)' }}>
              <div className="img-ph rounded-lg" style={{ width: 56, height: 84 }}>{L('book','หนังสือ')}</div>
              <div className="flex-1 min-w-0">
                <div className="font-serif-display text-[17px] ink leading-tight truncate">{b.title}</div>
                <div className="text-[12px] muted truncate">{b.author}</div>
                <div className="mt-2 progress"><div style={{ width: b.pct + '%' }}></div></div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="tag tag-amber">{b.tag}</span>
                  <span className="text-[11px] muted font-mono">{b.pct}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      <div className="grid grid-cols-12 gap-6">
        <Section className="col-span-12 lg:col-span-7" title={L('Highlights','ประโยคที่ขีดเส้น')}
        action={<button className="btn-ghost text-[13px]">{L('Export','ส่งออก')}</button>}>
          <div className="space-y-3">
            {[
            { book: 'A Pattern Language', quote: 'A building that is full of life will not be smooth, nor will it be made by a single hand.', page: 'p. 248' },
            { book: 'Letters to a Young Poet', quote: 'Be patient toward all that is unsolved in your heart and try to love the questions themselves.', page: 'p. 34' },
            { book: 'The Overstory', quote: 'The most wonderful thing about trees is how they live in long, slow time.', page: 'p. 102' }].
            map((h, i) =>
            <div key={i} className="pl-4 py-1 border-l-2" style={{ borderColor: 'var(--terracotta)' }}>
                <p className="quote text-[16px] ink-2">"{h.quote}"</p>
                <div className="text-[12px] muted mt-1 font-mono">— {h.book}, {h.page}</div>
              </div>
            )}
          </div>
        </Section>

        <Section className="col-span-12 lg:col-span-5" title={L('Up next','รออ่านต่อ')}>
          <ul className="space-y-2.5">
            {['Tinkers — Paul Harding', 'Annals of the Former World — John McPhee', 'The Sense of an Ending — Julian Barnes', 'Bluets — Maggie Nelson'].map((b, i) =>
            <li key={i} className="flex items-center justify-between p-2.5 rounded-xl row-hover">
                <div className="flex items-center gap-3">
                  <div className="img-ph rounded" style={{ width: 30, height: 42 }}></div>
                  <span className="text-[14px] ink">{b}</span>
                </div>
                <button className="btn-ghost text-[13px]">{L('Start','เริ่มอ่าน')}</button>
              </li>
            )}
          </ul>
        </Section>
      </div>
    </div>);

}

// ----------------------------- Inbox View -----------------------------
function InboxView() {
  const items = window.__lang==='th' ? [
  { from: 'มาร่า',     subj: 'Re: ค่าเช่าสตูดิโอ',     preview: 'ฉันถามเธออีกรอบ — ยังยืดหยุ่นเรื่องค่าเช่าถ้าเธออยากเริ่มแค่สองวันต่อสัปดาห์', when: '14 นาที', unread: true,  color: '#9A6B7E' },
  { from: 'ลินเนีย',  subj: 'ฟีดแบ็กบรีฟ',       preview: 'ชอบช่วงเปิดมาก มีข้อหนึ่งตรงส่วนที่สอง — คิดว่าตัดย่อหน้าที่สามออกได้ทั้งหมดเลยจะคมขึ้น', when: '1 ชม.', unread: true, color: '#8FA284' },
  { from: 'Hearth',        subj: 'สรุปรายสัปดาห์ของคุณ', preview: 'สัปดาห์นี้คุณทำงานเสร็จไป 17 จาก 22 รายการ ช่วงโฟกัสยาวที่สุดคือ 1 ชม. 48 นาทีเช้าวันพุธ', when: 'เมื่อวาน', unread: false, color: '#C97B5D' },
  { from: 'Onyx Coffee',   subj: 'ออกพัสดุแล้ว',         preview: 'แนบหมายติดตาม คาดว่าถึงวันศุกร์', when: '2 วัน', unread: false, color: '#8B6F56' },
  { from: 'คลาสปั้น',     subj: 'ตารางเทอร์มถัดไป',     preview: 'ย้ายคลาสวันอังคารเย็นไปเป็น 18:30 เริ่ม 2 มิ.ย.', when: '3 วัน', unread: false, color: '#D4A256' }] : [
  { from: 'Mara', subj: 'Re: studio rent', preview: "I asked her again — she's still flexible on the rent if you want to start with two days a week.", when: '14m', unread: true, color: '#9A6B7E' },
  { from: 'Linnea', subj: 'Brief feedback', preview: 'Loved the opening. I have one note about the second section — I think we can cut the third paragraph entirely.', when: '1h', unread: true, color: '#8FA284' },
  { from: 'Hearth', subj: 'Your weekly summary', preview: 'You finished 17 of 22 tasks this week. Your longest focus session was 1h 48m on Wednesday morning.', when: 'Yesterday', unread: false, color: '#C97B5D' },
  { from: 'Onyx Coffee', subj: 'Your order has shipped', preview: 'Tracking attached. Expected arrival: Friday.', when: '2d', unread: false, color: '#8B6F56' },
  { from: 'Pottery class', subj: 'Schedule for next term', preview: "We're moving Tuesday evenings to 6:30 PM starting June 2.", when: '3d', unread: false, color: '#D4A256' }];

  return (
    <div className="view grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-5">
        <Section action={
        <div className="flex items-center gap-1">
            <button className="btn-ghost p-1.5"><Icon.Filter size={15} /></button>
            <button className="btn-ghost p-1.5"><Icon.More size={15} /></button>
          </div>
        } title={L('All updates','อัปเดตทั้งหมด')}>
          <div className="flex flex-col gap-1">
            {items.map((it, i) =>
            <button key={i} className={"text-left p-3 rounded-xl row-hover " + (i === 0 ? 'bg-beige' : '')}
            style={i === 0 ? { border: '1px solid var(--hairline)' } : null}>
                <div className="flex items-start gap-3">
                  <Avatar name={it.from.slice(0, 1)} color={it.color} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={"text-[13px] " + (it.unread ? 'ink font-medium' : 'ink-2')}>{it.from}</span>
                      <span className="text-[11px] muted ml-auto">{it.when}</span>
                      {it.unread && <span className="ndot"></span>}
                    </div>
                    <div className={"text-[13px] truncate " + (it.unread ? 'ink' : 'muted')}>{it.subj}</div>
                    <div className="text-[12px] muted truncate">{it.preview}</div>
                  </div>
                </div>
              </button>
            )}
          </div>
        </Section>
      </div>
      <div className="col-span-12 lg:col-span-7">
        <Section>
          <div className="flex items-center gap-3 mb-2">
            <Avatar name="M" color="#9A6B7E" size={36} />
            <div className="flex-1">
              <div className="font-serif-display text-[20px] ink leading-none">{L('Mara','มาร่า')}</div>
              <div className="text-[12px] muted">{L('to you · 14 minutes ago','ถึงคุณ · 14 นาทีที่ผ่านมา')}</div>
            </div>
            <button className="btn-ghost text-[13px]">{L('Reply','ตอบกลับ')}</button>
            <button className="btn-ghost text-[13px]">{L('Archive','เก็บถาวร')}</button>
          </div>
          <h3 className="font-serif-display text-[26px] ink mt-2">{L('Re: studio rent','Re: ค่าเช่าสตูดิโอ')}</h3>
          <div className="space-y-3 text-[15px] ink-2 leading-[1.7] mt-3">
            <p>{L('Hi Anya,','สวัสดีอัญญา,')}</p>
            <p>{L("I asked her again — she's still flexible on the rent if you want to start with two days a week. She also mentioned there's a shared kiln in the back that you'd have access to, which I hadn't realized.",'ฉันถามเธออีกรอบ — เธอยังยืดหยุ่นเรื่องค่าเช่า ถ้าเธออยากเริ่มแค่สองวันต่อสัปดาห์ เธอบอกด้วยว่ามีเตาเผารวมอยู่ด้านหลังที่เธอจะใช้ได้ ซึ่งฉันไม่รู้มาก่อน')}</p>
            <p>{L("If you're free Thursday, I'd love to drop by together. I think you'll feel differently the second time.",'ถ้าวันพฤหัสบดีว่าง อยากชวนไปด้วยกัน ฉันว่าครั้งที่สองคุณจะรู้สึกต่างออกไป')}</p>
            <p>{L('— Mara','— มาร่า')}</p>
          </div>
          <div className="divider my-5"></div>
          <div className="flex items-center gap-2">
            <input className="input" placeholder={L('Write a reply…','เขียนตอบกลับ…')} />
            <button className="btn-primary">{L('Send','ส่ง')}</button>
          </div>
        </Section>
      </div>
    </div>);

}

// ----------------------------- Settings View -----------------------------
function SettingsView() {
  return (
    <div className="view grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-8 space-y-6">
        <Section title={L('Profile','โปรไฟล์')}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #C97B5D, #8B6F56)', color: '#FFF8EE', fontSize: 22, fontWeight: 600 }}>AR</div>
            <div className="flex-1">
              <div className="font-serif-display text-[22px] ink">{L('Anya Reyes','อัญญา เรเยส')}</div>
              <div className="text-[13px] muted">{L('anya@hearth.app · Pacific Time','anya@hearth.app · เขตเวลาแปซิฟิก')}</div>
            </div>
            <button className="btn-ghost text-[13px]">{L('Change avatar','เปลี่ยนรูปโปรไฟล์')}</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <div>
              <label className="text-[12px] muted">{L('Full name','ชื่อเต็ม')}</label>
              <input className="input mt-1" defaultValue={L('Anya Reyes','อัญญา เรเยส')} />
            </div>
            <div>
              <label className="text-[12px] muted">{L('Email','อีเมล')}</label>
              <input className="input mt-1" defaultValue="anya@hearth.app" />
            </div>
            <div>
              <label className="text-[12px] muted">{L('Pronouns','สรรพนาม')}</label>
              <input className="input mt-1" defaultValue={L('she/her','เธอ')} />
            </div>
            <div>
              <label className="text-[12px] muted">{L('Time zone','เขตเวลา')}</label>
              <input className="input mt-1" defaultValue="America/Los_Angeles" />
            </div>
          </div>
        </Section>

        <Section title={L('Preferences','การตั้งค่า')}>
          {(window.__lang==='th' ? [
          { label: 'ช่วงเงียบสงบ',  sub: 'หยุดแจ้งเตือนระหว่าง 21:00 ถึง 07:00', on: true },
          { label: 'เสียงนุ่มนวล',  sub: 'เสียงเบาๆ เมื่อทำงานเสร็จ', on: true },
          { label: 'สรุปรายสัปดาห์', sub: 'บทสะท้อนสั้นๆ ส่งถึงคุณทุกเช้าวันอาทิตย์', on: true },
          { label: 'โปรไฟล์สาธารณะ',     sub: 'อนุญาตให้ผู้อื่นค้นหาคุณจาก handle', on: false }] : [
          { label: 'Quiet hours', sub: 'Pause notifications between 9 PM and 7 AM', on: true },
          { label: 'Soft sounds', sub: 'A gentle chime when you complete a task', on: true },
          { label: 'Weekly summary', sub: 'A short reflection delivered every Sunday morning', on: true },
          { label: 'Public profile', sub: 'Let others find you by your handle', on: false }]).
          map((p, i) =>
          <div key={i} className="flex items-center justify-between py-3" style={{ borderTop: i ? '1px solid var(--hairline)' : 'none' }}>
              <div>
                <div className="text-[14px] ink">{p.label}</div>
                <div className="text-[12px] muted">{p.sub}</div>
              </div>
              <div className={"toggle " + (p.on ? 'on' : '')}></div>
            </div>
          )}
        </Section>
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-6">
        <Section title={L('Plan','แพ็กเกจ')}>
          <div className="card-warm p-4">
            <div className="text-[12px] muted">{L('Current plan','แพ็กเกจปัจจุบัน')}</div>
            <div className="font-serif-display text-[24px] ink">Hearth Cozy</div>
            <div className="text-[12px] muted mt-1">{L('$8 / month · Renews June 12','$8 / เดือน · ต่ออายุ 12 มิ.ย.')}</div>
            <button className="btn-primary mt-3 w-full">{L('Manage subscription','จัดการการสมัครสมาชิก')}</button>
          </div>
        </Section>
        <Section title={L('Danger zone','โซนอันตราย')}>
          <button className="w-full text-left p-3 rounded-xl row-hover">
            <div className="text-[14px] ink">{L('Export your data','ส่งออกข้อมูลของคุณ')}</div>
            <div className="text-[12px] muted">{L('Download everything as Markdown + JSON','ดาวน์โหลดทุกอย่างเป็น Markdown + JSON')}</div>
          </button>
          <button className="w-full text-left p-3 rounded-xl row-hover">
            <div className="text-[14px]" style={{ color: '#A14F3A' }}>{L('Delete account','ลบบัญชี')}</div>
            <div className="text-[12px] muted">{L('This cannot be undone','การกระทำนี้ไม่สามารถย้อนกลับได้')}</div>
          </button>
        </Section>
      </div>
    </div>);

}

Object.assign(window, {
  Sidebar, TopHeader,
  TodayView, TasksView, NotesView, CalendarView, LibraryView, InboxView, SettingsView,
  Avatar, Section, Ring
});