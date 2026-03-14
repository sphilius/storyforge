import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, query, where, deleteDoc, getDocs, setLogLevel } from 'firebase/firestore';
import { 
  Mic, MicOff, Terminal, Image as ImageIcon, 
  Film, Save, Database, Sliders, Activity, Radio, Zap, 
  UserCircle, Cpu, Waves, Heart, MousePointer2, LogOut, 
  VolumeX, Volume2, Sparkles, Plus, Fingerprint, Search, User, Trash2, 
  Camera, BookOpen, Globe, Youtube, X, Clock, BellRing
} from 'lucide-react';

const VOICE_GROUPS = {
  "Authority": ["Kore", "Orus", "Alnilam", "Schedar"],
  "Creative": ["Zephyr", "Puck", "Fenrir", "Aoede"],
  "Deep": ["Algenib", "Gacrux", "Algieba", "Sulafat"]
};

const DEFAULT_MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025';
const FAST_GEN_MODEL = 'gemini-2.5-flash-image-preview';

const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'director-os-v4-2';

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState('');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [activeProfileId, setActiveProfileId] = useState(() => localStorage.getItem('activeProfileId') || '');
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProjectId, setActiveProjectId] = useState(() => localStorage.getItem('activeProjectId') || '');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('director_os_apiKey') || '');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profiles' | 'gallery'>('dashboard');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [isHandsFreeActive, setIsHandsFreeActive] = useState(true);
  const [showConnectors, setShowConnectors] = useState(false);
  const [genTier, setGenTier] = useState<'NITRO' | 'HERO'>(() => (localStorage.getItem('genTier') as any) || 'NITRO');
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerIntervalRef = useRef<any>(null);
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 });
  const [isUserMovingMouse, setIsUserMovingMouse] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const turnSequenceRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mouseTimer = useRef<any>(null);

  const log = useCallback((msg: string, type: 'info' | 'error' | 'server' | 'action' = 'info') => {
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 50));
  }, []);

  useEffect(() => { localStorage.setItem('director_os_apiKey', apiKey); }, [apiKey]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined') {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { log("Auth Logic Failed. Retrying...", "error"); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) { setUserId(user.uid); setIsAuthReady(true); log("Auth Link: Verified", "server"); }
    });
    return () => unsubscribe();
  }, [log]);

  useEffect(() => {
    if (!isAuthReady) return;
    const profilesCol = collection(db, `artifacts/${appId}/public/data/profiles`);
    const unsubscribe = onSnapshot(profilesCol, (ss) => {
      const pList = ss.docs.map(d => ({ id: d.id, ...d.data() }));
      setProfiles(pList);
      if (!localStorage.getItem('activeProfileId') && pList.length > 0) { setActiveProfileId(pList[0].id); }
    });
    return () => unsubscribe();
  }, [isAuthReady, activeProfileId]);

  useEffect(() => {
    if (!isAuthReady || !activeProfileId) return;
    localStorage.setItem('activeProfileId', activeProfileId);
    const projectsCol = collection(db, `artifacts/${appId}/public/data/projects`);
    const q = query(projectsCol, where("profileId", "==", activeProfileId));
    const unsubscribe = onSnapshot(q, (ss) => { setProjects(ss.docs.map(d => ({ id: d.id, ...d.data() }))); });
    return () => unsubscribe();
  }, [isAuthReady, activeProfileId]);

  const createProfile = async (name: string) => {
    if (!isAuthReady) return;
    try {
      const id = crypto.randomUUID();
      await setDoc(doc(db, `artifacts/${appId}/public/data/profiles`, id), { name, creator: userId, createdAt: new Date().toISOString() });
      setActiveProfileId(id);
    } catch (e) { log("Identity Creation Error", "error"); }
  };

  const createProject = async (title: string) => {
    if (!activeProfileId) return;
    try {
      const id = crypto.randomUUID();
      await setDoc(doc(db, `artifacts/${appId}/public/data/projects`, id), { title, profileId: activeProfileId, createdAt: new Date().toISOString() });
      setActiveProjectId(id);
    } catch (e) { log("Project Initialization Error", "error"); }
  };

  const playMilestoneCue = useCallback((type: 'CHECKPOINT' | 'WARNING' | 'SUCCESS') => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type === 'CHECKPOINT') {
      osc.frequency.setValueAtTime(220, now); osc.frequency.exponentialRampToValueAtTime(440, now + 0.8);
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.1, now + 0.1); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.start(now); osc.stop(now + 0.8);
      log("Uptime Milestone: 5 Minutes.", "info");
    } else if (type === 'WARNING') {
      osc.frequency.setValueAtTime(880, now); osc.frequency.setValueAtTime(660, now + 0.15);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.05); osc.start(now); osc.stop(now + 0.4);
      log("Uptime Warning: 8 Minutes.", "action");
    } else if (type === 'SUCCESS') {
      [523.25, 659.25, 783.99].forEach((f, i) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0, now + (i * 0.1)); g.gain.linearRampToValueAtTime(0.05, now + (i * 0.1) + 0.1); g.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        o.start(now + (i * 0.1)); o.stop(now + 1.5);
      });
      log("Uptime Achievement: 10 Minutes.", "server");
    }
  }, [log]);

  useEffect(() => {
    if (status === 'connected') {
      setElapsedTime(0);
      timerIntervalRef.current = setInterval(() => {
        setElapsedTime(prev => {
          const next = prev + 1;
          if (next === 300) playMilestoneCue('CHECKPOINT'); 
          if (next === 480) playMilestoneCue('WARNING');    
          if (next === 600) playMilestoneCue('SUCCESS');    
          return next;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [status, playMilestoneCue]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60); const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const interrupt = useCallback(() => {
    if (audioSourcesRef.current.length > 0) {
      turnSequenceRef.current += 1;
      log("Neural Barge-in detected", "action");
      audioSourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
      audioSourcesRef.current = [];
      nextStartTimeRef.current = audioCtxRef.current?.currentTime || 0;
    }
  }, [log]);

  const schedulePlayback = useCallback((base64: string, seq: number) => {
    if (seq !== turnSequenceRef.current || !audioCtxRef.current) return;
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    const binary = window.atob(base64);
    const bytes = new Int16Array(new Uint8Array(binary.split('').map(c => c.charCodeAt(0))).buffer);
    const float32 = new Float32Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) float32[i] = bytes[i] / 32768.0;
    const buffer = audioCtxRef.current.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    const source = audioCtxRef.current.createBufferSource();
    source.buffer = buffer; source.connect(audioCtxRef.current.destination);
    const startTime = Math.max(audioCtxRef.current.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;
    audioSourcesRef.current.push(source);
  }, []);

  const connect = useCallback(async () => {
    if (!apiKey) return log("Key Required", "error");
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) return;

    setStatus('connecting');
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setStatus('connected');
      log("Uplink Established", "server");
      socket.send(JSON.stringify({
        setup: {
          model: DEFAULT_MODEL,
          generation_config: {
            response_modalities: ['AUDIO'],
            temperature: 0.5,
            top_p: 0.9,
            top_k: 20,
            speech_config: { voice_config: { prebuilt_voice_config: { voice_name: localStorage.getItem('lastVoice') || 'Zephyr' } } }
          },
          system_instruction: { 
            parts: [{ text: `You are Director-OS v4.2. Grounded and physically present. Acknowledge requests. Use tools.` }] 
          },
          tools: [
            { google_search: {} },
            {
              function_declarations: [
                { name: 'open_connectors', description: 'Show sources panel.', parameters: { type: 'OBJECT', properties: {} } },
                { name: 'move_mouse', description: 'Position cursor.', parameters: { type: 'OBJECT', properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } } } },
                { name: 'scroll_ui', description: 'Navigate view.', parameters: { type: 'OBJECT', properties: { direction: { type: 'STRING', enum: ['up', 'down'] } }, required: ['direction'] } }
              ]
            }
          ]
        }
      }));
    };

    socket.onmessage = async (e) => {
      const data = JSON.parse(await (e.data instanceof Blob ? e.data.text() : e.data));
      const curSeq = turnSequenceRef.current;
      const content = data.server_content || data.serverContent;
      const parts = content?.model_turn?.parts || content?.modelTurn?.parts;
      if (parts) parts.forEach((p: any) => { if (p.inline_data?.data || p.inlineData?.data) schedulePlayback(p.inline_data?.data || p.inlineData?.data, curSeq); });
      if (data.tool_call || data.toolCall) {
        const toolMsg = data.tool_call || data.toolCall;
        const calls = toolMsg.function_calls || toolMsg.functionCalls || [];
        const responses = await Promise.all(calls.map(async (call: any) => {
           log(`Executing Tool: ${call.name}`, "action");
           if (call.name === 'open_connectors') setShowConnectors(true);
           if (call.name === 'scroll_ui') {
             const amount = call.args.direction === 'down' ? 600 : -600;
             window.scrollBy({ top: amount, behavior: 'smooth' });
           }
           if (call.name === 'move_mouse' && !isUserMovingMouse) setCursorPos({ x: Math.max(5, Math.min(95, call.args.x)), y: Math.max(5, Math.min(95, call.args.y)) });
           return { id: call.id, name: call.name, response: { status: "OK" } };
        }));
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ tool_response: { function_responses: responses } }));
      }
    };
    socket.onclose = () => setStatus('idle');
    audioCtxRef.current = new window.AudioContext({ sampleRate: 24000 });
  }, [apiKey, isUserMovingMouse, schedulePlayback, log]);

  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new window.AudioContext({ sampleRate: 16000 });
      const proc = ctx.createScriptProcessor(1024, 1, 1);
      const source = ctx.createMediaStreamSource(stream);
      proc.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for(let i=0; i<input.length; i++) sum += input[i] * input[i];
        if (Math.sqrt(sum/input.length) > 0.03) interrupt();
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const pcm16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) pcm16[i] = Math.max(-1, Math.min(1, input[i])) * 32767;
          const b64 = window.btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
          wsRef.current.send(JSON.stringify({ realtime_input: { media_chunks: [{ mime_type: 'audio/pcm;rate=16000', data: b64 }] } }));
        }
      };
      source.connect(proc); proc.connect(ctx.destination);
      setIsRecording(true);
    } catch (e) { log("Mic Blocked", "error"); }
  }, [interrupt, log]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition && isHandsFreeActive) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.onresult = (event: any) => {
        const t = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        if (t.includes(localStorage.getItem('wakeWord') || "wake up") && status === 'idle') { connect(); startMic(); }
        if (t.includes(localStorage.getItem('killWord') || "go to bed") && status === 'connected') wsRef.current?.close();
      };
      recognitionRef.current.start();
    }
    return () => recognitionRef.current?.stop();
  }, [isHandsFreeActive, status, apiKey, connect, startMic]);

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans cursor-none selection:bg-cyan-500/30 overflow-x-hidden" onMouseMove={(e) => {
      setIsUserMovingMouse(true); const x = (e.clientX / window.innerWidth) * 100; const y = (e.clientY / window.innerHeight) * 100;
      setCursorPos({ x, y }); if (mouseTimer.current) clearTimeout(mouseTimer.current);
      mouseTimer.current = setTimeout(() => setIsUserMovingMouse(false), 2000);
    }}>
      
      <div className="fixed pointer-events-none z-[9999] transition-all duration-300 ease-out" style={{ left: `${cursorPos.x}%`, top: `${cursorPos.y}%`, transform: 'translate(-50%, -50%)' }}>
        <div className={`relative transition-all duration-500 ${isUserMovingMouse ? 'opacity-20 scale-75' : 'opacity-100 scale-100'}`}>
          <MousePointer2 className="w-12 h-12 text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,1)] fill-cyan-400/10" />
          <div className="absolute top-0 left-0 w-16 h-16 border-2 border-cyan-500/20 rounded-full animate-ping -translate-x-2 -translate-y-2" />
        </div>
      </div>

      <div className="fixed bottom-12 right-12 z-[100] animate-in slide-in-from-right-12 duration-1000">
         <div className={`bg-slate-900/60 backdrop-blur-xl border-2 px-8 py-5 rounded-[2.5rem] flex items-center gap-6 shadow-2xl transition-all duration-1000 ${elapsedTime >= 600 ? 'border-emerald-500/50 scale-110 shadow-emerald-500/20' : 'border-slate-800'}`}>
            <Clock className={`w-7 h-7 ${elapsedTime >= 600 ? 'text-emerald-400' : 'text-cyan-400'} ${status === 'connected' ? 'animate-pulse' : ''}`} />
            <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] leading-none mb-1">Session Uptime</span>
               <span className={`text-4xl font-mono font-black tracking-tighter tabular-nums ${elapsedTime >= 600 ? 'text-emerald-400' : 'text-cyan-400'}`}>
                 {formatTime(elapsedTime)}
               </span>
            </div>
         </div>
      </div>

      {showConnectors && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
           <div className="bg-slate-900 border border-slate-800 rounded-[3rem] w-full max-w-md p-10 shadow-2xl relative">
              <button onClick={() => setShowConnectors(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X /></button>
              <h3 className="text-xl font-black uppercase mb-10 text-white flex items-center gap-4"><Plus className="text-cyan-500" /> Connectors</h3>
              <div className="space-y-6">
                 <ConnectorItem icon={<Camera />} label="Visual Capture" color="text-emerald-400" />
                 <ConnectorItem icon={<ImageIcon />} label="Gallery Sync" color="text-blue-400" />
                 <ConnectorItem icon={<Database />} label="Cloud Drive" color="text-rose-400" />
                 <ConnectorItem icon={<Waves />} label="NotebookLM" color="text-cyan-400" />
              </div>
           </div>
        </div>
      )}

      <nav className="fixed left-0 top-0 h-full w-64 bg-slate-900/95 border-r border-slate-800 flex flex-col items-start py-10 px-6 backdrop-blur-3xl z-50 shadow-2xl">
        <div className="flex items-center gap-4 mb-16 w-full px-2">
          <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-xl shadow-cyan-500/20"><Database className="w-6 h-6 text-white" /></div>
          <span className="font-black text-sm uppercase tracking-[0.3em] text-white">Director-OS</span>
        </div>
        <NavItem active={activeTab === 'dashboard'} label="neural command" icon={<Terminal />} onClick={() => setActiveTab('dashboard')} />
        <NavItem active={activeTab === 'profiles'} label="user profiles" icon={<User />} onClick={() => setActiveTab('profiles')} />
        <NavItem active={activeTab === 'gallery'} label="asset vault" icon={<ImageIcon />} onClick={() => setActiveTab('gallery')} />
        <div className="mt-auto w-full space-y-6 pt-10 border-t border-slate-800">
           <button onClick={() => setShowConnectors(true)} className="w-full py-4 rounded-2xl bg-cyan-600/10 border border-cyan-500/30 text-cyan-400 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95"><Plus className="w-4 h-4" /> Connectors</button>
           <div className="flex justify-between items-center px-2">
             <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Active ID</span>
             <span className="text-[10px] font-bold text-cyan-400 uppercase">{activeProfile?.name || 'Unlinked'}</span>
           </div>
        </div>
      </nav>

      <main className="ml-64 p-12 max-w-[1500px] mx-auto min-h-screen relative pb-48">
        <header className="flex justify-between items-end mb-20 animate-in fade-in duration-1000">
          <div>
            <h1 className="text-7xl font-black tracking-tighter uppercase italic bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-400 bg-clip-text text-transparent">Director-OS v4.2</h1>
            <p className="text-slate-600 font-bold tracking-[0.5em] text-[11px] mt-4 uppercase flex items-center gap-4">
               <Fingerprint className="w-4 h-4 text-cyan-500" /> Grounded Intelligence // Multi-Tenant Persistence
            </p>
          </div>
          <div className="flex items-center gap-8 bg-slate-900/50 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
            <div className={`h-5 w-5 rounded-full ${status === 'connected' ? 'bg-emerald-500 shadow-lg scale-110 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{status}</span>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-12 animate-in fade-in duration-700">
            <div className="grid grid-cols-12 gap-10">
              <div className="col-span-12 xl:col-span-4 space-y-8">
                 <div className="bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 shadow-2xl space-y-8">
                    <label className="text-[11px] font-black uppercase text-slate-500 flex items-center gap-3 tracking-widest"><Zap className="w-4 h-4 text-cyan-500" /> Neural Key</label>
                    <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full bg-black/60 border border-slate-700 rounded-2xl p-5 text-sm focus:ring-2 focus:ring-cyan-500 outline-none text-white font-mono" placeholder="AUTHORIZATION_KEY" />
                    <button onClick={status === 'connected' ? () => wsRef.current?.close() : connect} className={`w-full py-6 rounded-2xl font-black text-xs tracking-widest transition-all ${status === 'connected' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-cyan-600 text-white shadow-xl hover:bg-cyan-500'}`}>
                      {status === 'connected' ? <LogOut className="w-4 h-4 mx-auto" /> : 'INITIALIZE UPLINK'}
                    </button>
                 </div>
                 <div className="bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800 shadow-2xl space-y-8">
                    <label className="text-[11px] font-black uppercase text-slate-500 block tracking-widest flex items-center gap-3"><BookOpen className="w-4 h-4 text-indigo-500" /> Project Hub</label>
                    <select value={activeProjectId} onChange={(e) => setActiveProjectId(e.target.value)} className="w-full bg-black/60 border border-slate-700 rounded-2xl p-4 text-xs font-bold text-cyan-400 outline-none">
                      <option value="">Select Project...</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.title.toUpperCase()}</option>)}
                    </select>
                    <button onClick={() => { const t = prompt("Project Title?"); if(t) createProject(t); }} className="w-full py-3 rounded-xl bg-slate-800 text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> New Chapter</button>
                 </div>
              </div>

              <div className="col-span-12 xl:col-span-8 bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800 shadow-2xl space-y-10">
                 <div className="flex justify-between items-center">
                    <label className="text-[11px] font-black uppercase text-slate-500 flex items-center gap-3 tracking-widest"><Search className="w-4 h-4 text-cyan-500" /> Grounding Ingestion</label>
                    <div className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                      <Globe className="w-3 h-3" /> Web Search Ready
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="p-8 bg-black/40 rounded-[2.5rem] border border-slate-800 space-y-6">
                       <div className="flex items-center gap-4 text-slate-500"><Youtube className="w-5 h-5 text-rose-600" /><span className="text-[10px] font-black uppercase">Asset Node Link</span></div>
                       <input className="w-full bg-black/20 border border-slate-800 rounded-xl p-4 text-xs text-cyan-400 outline-none focus:border-rose-500/50" placeholder="Paste YouTube/URL..." />
                    </div>
                    <div className="p-8 bg-black/40 rounded-[2.5rem] border border-slate-800 space-y-6">
                       <div className="flex items-center gap-4 text-slate-500"><BookOpen className="w-5 h-5 text-cyan-500" /><span className="text-[10px] font-black uppercase">Story Bible Node</span></div>
                       <textarea className="w-full bg-black/20 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 h-20 outline-none resize-none focus:border-cyan-500/50" placeholder="Paste context..." />
                    </div>
                 </div>
              </div>
            </div>

            <div className="bg-black p-12 rounded-[4rem] border border-slate-800 shadow-2xl flex flex-col h-[500px]">
              <div className="flex justify-between items-center mb-10 border-b border-slate-800/50 pb-10">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.6em] flex items-center gap-6"><Activity className="w-6 h-6 text-cyan-500" /> Telemetry Log // FEED ACTIVE</h3>
                <button onClick={() => setLogs([])} className="px-6 py-2 rounded-xl bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-cyan-400">Flush</button>
              </div>
              <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-5 pr-10 custom-scrollbar scroll-smooth">
                {logs.map((l, i) => (
                  <div key={i} className="flex gap-10 pl-8 py-2.5 transition-colors hover:bg-white/5 rounded-xl border-l-2 border-transparent">
                    <span className="text-slate-700 shrink-0 opacity-40 font-black tracking-widest">[{l.time}]</span>
                    <span className={`leading-loose tracking-wider ${l.type === 'error' ? 'text-rose-400 font-bold' : l.type === 'server' ? 'text-cyan-300 font-bold' : l.type === 'action' ? 'text-amber-300 font-black bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20 shadow-lg' : 'text-slate-400'}`}>{l.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profiles' && (
          <div className="grid grid-cols-12 gap-10 animate-in slide-in-from-bottom-12 duration-1000">
             <div className="col-span-12 xl:col-span-4 bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800 shadow-2xl space-y-10">
                <h2 className="text-3xl font-black uppercase italic text-white flex items-center gap-4"><UserCircle className="w-8 h-8 text-cyan-500" /> Core Identities</h2>
                <button onClick={() => { const n = prompt("Identity Name?"); if(n) createProfile(n); }} className="w-full py-6 rounded-2xl bg-cyan-600 text-white font-black uppercase tracking-widest shadow-xl hover:bg-cyan-500 flex items-center justify-center gap-4 transition-all active:scale-95"><Plus /> Initialize New Identity</button>
             </div>
             
             <div className="col-span-12 xl:col-span-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {profiles.map(p => (
                  <button key={p.id} onClick={() => setActiveProfileId(p.id)} className={`p-12 rounded-[3.5rem] border transition-all duration-700 flex flex-col items-center gap-6 group ${activeProfileId === p.id ? 'bg-cyan-600 border-cyan-400 shadow-2xl scale-105' : 'bg-slate-900/60 border-slate-800 hover:border-cyan-500/50'}`}>
                     <div className={`p-5 rounded-full transition-all duration-700 ${activeProfileId === p.id ? 'bg-white text-cyan-600' : 'bg-slate-800 text-slate-500 group-hover:bg-cyan-500 group-hover:text-white'}`}><User className="w-8 h-8" /></div>
                     <span className={`text-sm font-black uppercase tracking-widest ${activeProfileId === p.id ? 'text-white' : 'text-slate-400'}`}>{p.name}</span>
                  </button>
                ))}
             </div>
          </div>
        )}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 30px; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

function NavItem({ active, icon, label, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-6 w-full p-6 rounded-[2.5rem] transition-all duration-700 relative ${active ? 'bg-cyan-500/10 text-cyan-400 shadow-[inset_0_0_40px_rgba(6,182,212,0.05)]' : 'text-slate-600 hover:bg-slate-800'}`}>
      {active && <div className="absolute left-0 w-1.5 h-12 bg-cyan-500 rounded-r-full shadow-[0_0_30px_rgba(34,211,238,1)]" />}
      <div className={`transition-all duration-700 ${active ? 'scale-125 rotate-6 text-cyan-400' : ''}`}>{React.cloneElement(icon as any, { className: 'w-6 h-6' })}</div>
      <span className={`text-[12px] font-black uppercase tracking-[0.4em] transition-all ${active ? 'opacity-100' : 'opacity-30'}`}>{label}</span>
    </button>
  );
}

function ConnectorItem({ icon, label, color }: any) {
  return (
    <button className="w-full flex items-center justify-between p-5 rounded-2xl bg-black/40 border border-slate-800 hover:border-slate-700 transition-all group">
       <div className="flex items-center gap-6">
          <div className={`${color} group-hover:scale-110 transition-transform duration-500`}>{icon}</div>
          <span className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">{label}</span>
       </div>
       <div className="w-2 h-2 rounded-full bg-slate-800 group-hover:bg-cyan-500 transition-all shadow-[0_0_8px_rgba(6,182,212,0.4)]" />
    </button>
  );
}
