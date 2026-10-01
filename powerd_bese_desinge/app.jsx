const { useState, useEffect, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#C97B5D",
  "background": "cream",
  "density": "comfy",
  "fontPair": "serif-sans",
  "lang": "en",
  "radius": 18,
  "sidebar": "expanded"
}/*EDITMODE-END*/;

function App() {
  const [view, setView] = useState('today');
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [tasks, setTasks] = useState(window.initialTasks);

  // Apply language — swap dataset on change
  useEffect(() => {
    window.applyLang(t.lang);
    setTasks(window.initialTasks); // reset to new-lang dataset
  }, [t.lang]);

  // Apply tweaks via CSS variables
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--terracotta', t.accent);
    // derive a darker shade
    r.style.setProperty('--terracotta-2', shade(t.accent, -10));

    if (t.background === 'cream') {
      r.style.setProperty('--cream',  '#FAF6EF');
      r.style.setProperty('--cream-2','#F6F0E4');
    } else if (t.background === 'oat') {
      r.style.setProperty('--cream',  '#F5EFE3');
      r.style.setProperty('--cream-2','#EFE7D5');
    } else if (t.background === 'paper') {
      r.style.setProperty('--cream',  '#FBF9F4');
      r.style.setProperty('--cream-2','#F4EFE3');
    } else if (t.background === 'dusk') {
      r.style.setProperty('--cream',  '#2B2620');
      r.style.setProperty('--cream-2','#322C25');
      r.style.setProperty('--beige',  '#3A332B');
      r.style.setProperty('--beige-2','#473E33');
      r.style.setProperty('--hairline','#4A4138');
      r.style.setProperty('--ink',    '#F4ECDC');
      r.style.setProperty('--ink-2',  '#D9CCB5');
      r.style.setProperty('--muted',  '#9F8E78');
    }
  }, [t.accent, t.background]);

  // density / radius
  useEffect(() => {
    document.documentElement.style.setProperty('--gap', t.density==='compact'?'14px':t.density==='comfy'?'24px':'18px');
    document.querySelectorAll('.card, .card-warm, .kcol').forEach(el => {
      el.style.borderRadius = t.radius + 'px';
    });
  }, [t.density, t.radius]);

  const collapsed = t.sidebar === 'collapsed';

  const ViewMap = {
    today:    <TodayView tasks={tasks} setTasks={setTasks} />,
    tasks:    <TasksView tasks={tasks} setTasks={setTasks} />,
    notes:    <NotesView />,
    cal:      <CalendarView />,
    library:  <LibraryView />,
    inbox:    <InboxView />,
    settings: <SettingsView />,
  };

  return (
    <div className="app-shell flex bg-warmth"
         style={{ fontFamily: t.fontPair==='all-sans' ? "Nunito, system-ui, sans-serif" : undefined }}
         data-screen-label="Hearth Workspace">
      <Sidebar active={view} onNav={setView} collapsed={collapsed} />
      <main className="flex-1 min-w-0 flex flex-col">
        <TopHeader view={view} />
        <div className="px-8 py-7 flex-1 scroll-y" style={{ maxWidth: 1480, width: '100%', marginLeft:'auto', marginRight:'auto' }}>
          {ViewMap[view]}
        </div>
      </main>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakColor label="Accent" value={t.accent}
                    options={['#C97B5D','#8FA284','#9A6B7E','#D4A256','#7A8FA5']}
                    onChange={(v)=>setTweak('accent', v)} />
        <TweakRadio label="Background" value={t.background}
                    options={['cream','oat','paper','dusk']}
                    onChange={(v)=>setTweak('background', v)} />

        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density}
                    options={['compact','regular','comfy']}
                    onChange={(v)=>setTweak('density', v)} />
        <TweakSlider label="Corner radius" value={t.radius} min={6} max={28} unit="px"
                     onChange={(v)=>setTweak('radius', v)} />
        <TweakRadio label="Sidebar" value={t.sidebar}
                    options={['expanded','collapsed']}
                    onChange={(v)=>setTweak('sidebar', v)} />

        <TweakSection label="Language" />
        <TweakRadio label="ภาษา / Lang" value={t.lang}
                    options={['en','th']}
                    onChange={(v)=>setTweak('lang', v)} />

        <TweakSection label="Type" />
        <TweakRadio label="Font pair" value={t.fontPair}
                    options={['serif-sans','all-sans']}
                    onChange={(v)=>setTweak('fontPair', v)} />

        <TweakSection label="Jump to view" />
        <div style={{ display:'flex', flexWrap:'wrap', gap: 6, padding: '4px 12px 12px' }}>
          {['today','tasks','notes','cal','library','inbox','settings'].map(v=>(
            <button key={v}
              onClick={()=>setView(v)}
              style={{
                fontSize: 11, padding: '4px 9px', borderRadius: 999,
                background: view===v ? '#29261b' : 'rgba(255,255,255,0.6)',
                color: view===v ? '#FAF6EF' : '#29261b',
                border: '1px solid rgba(0,0,0,0.06)', cursor:'pointer'
              }}>
              {v}
            </button>
          ))}
        </div>
      </TweaksPanel>
    </div>
  );
}

// shade a hex color by % (-100 to 100)
function shade(hex, pct) {
  const n = parseInt(hex.replace('#',''), 16);
  let r = (n>>16)&255, g=(n>>8)&255, b=n&255;
  const t = pct < 0 ? 0 : 255, p = Math.abs(pct)/100;
  r = Math.round((t-r)*p) + r;
  g = Math.round((t-g)*p) + g;
  b = Math.round((t-b)*p) + b;
  return '#' + ((1<<24) | (r<<16) | (g<<8) | b).toString(16).slice(1);
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
