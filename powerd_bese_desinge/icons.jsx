// Lightweight, line-style icons — original, consistent stroke
const Ic = ({ d, size = 18, sw = 1.6, fill, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill || "none"} stroke="currentColor"
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...p}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

const Icon = {
  Home:   (p)=> <Ic {...p} d={<><path d="M3.5 11 12 4l8.5 7"/><path d="M5 10v9h14v-9"/><path d="M10 19v-5h4v5"/></>} />,
  Today:  (p)=> <Ic {...p} d={<><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17"/><path d="M8 3.5v3M16 3.5v3"/><circle cx="12" cy="14.5" r="1.6" fill="currentColor" stroke="none"/></>} />,
  Tasks:  (p)=> <Ic {...p} d={<><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M7.5 9.5l2 2 4-4"/><path d="M7.5 15.5h7"/></>} />,
  Notes:  (p)=> <Ic {...p} d={<><path d="M6 3.5h9l4 4V20a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 20V4z"/><path d="M14.5 3.5V8h4"/><path d="M9 13h7M9 16h5"/></>} />,
  Cal:    (p)=> <Ic {...p} d={<><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/></>} />,
  Book:   (p)=> <Ic {...p} d={<><path d="M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2z" /><path d="M20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z"/></>} />,
  Inbox:  (p)=> <Ic {...p} d={<><path d="M3.5 13.5 6 5.5h12l2.5 8"/><path d="M3.5 13.5V19a.5.5 0 0 0 .5.5h16a.5.5 0 0 0 .5-.5v-5.5"/><path d="M3.5 13.5h5l1.5 2h4l1.5-2h5"/></>} />,
  Search: (p)=> <Ic {...p} d={<><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></>} />,
  Bell:   (p)=> <Ic {...p} d={<><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></>} />,
  Plus:   (p)=> <Ic {...p} d="M12 5v14M5 12h14" />,
  Cog:    (p)=> <Ic {...p} d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 14.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>} />,
  Sparkle:(p)=> <Ic {...p} d={<><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2"/></>} />,
  Sun:    (p)=> <Ic {...p} d={<><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></>} />,
  Moon:   (p)=> <Ic {...p} d="M20 14.5A8 8 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />,
  Coffee: (p)=> <Ic {...p} d={<><path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2"/><path d="M7 4c0 1 1 1 1 2s-1 1-1 2M11 4c0 1 1 1 1 2s-1 1-1 2"/></>} />,
  Flag:   (p)=> <Ic {...p} d={<><path d="M5 21V4h12l-2 4 2 4H5"/></>} />,
  Chevron:(p)=> <Ic {...p} d="m9 6 6 6-6 6" />,
  ChevronDown:(p)=> <Ic {...p} d="m6 9 6 6 6-6" />,
  ChevronLeft:(p)=> <Ic {...p} d="m15 6-6 6 6 6" />,
  More:   (p)=> <Ic {...p} d={<><circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none"/></>} />,
  Filter: (p)=> <Ic {...p} d="M4 5h16l-6 8v5l-4 2v-7z" />,
  Pin:    (p)=> <Ic {...p} d={<><path d="M9 4h6l-1 5 3 3-6 1 1 7-1-7-6-1 3-3z"/></>} />,
  Sound:  (p)=> <Ic {...p} d={<><path d="M5 9.5h3l4-3v11l-4-3H5z"/><path d="M16 9a4 4 0 0 1 0 6"/></>} />,
  Tag:    (p)=> <Ic {...p} d={<><path d="M3.5 12.5 12 4h7v7l-8.5 8.5a1.5 1.5 0 0 1-2.1 0L3.5 14.6a1.5 1.5 0 0 1 0-2.1z"/><circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none"/></>} />,
  Folder: (p)=> <Ic {...p} d={<><path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5V18A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z"/></>} />,
  Hash:   (p)=> <Ic {...p} d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" />,
  Check:  (p)=> <Ic {...p} d="m5 12.5 4 4 10-10" />,
  Clock:  (p)=> <Ic {...p} d={<><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>} />,
  ArrowRight: (p)=> <Ic {...p} d="M5 12h14m-5-5 5 5-5 5" />,
};

Object.assign(window, { Icon });
