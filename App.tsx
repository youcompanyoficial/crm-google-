/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MessageCircle, 
  Users, 
  BarChart2, 
  Megaphone, 
  DollarSign, 
  Settings, 
  Search, 
  Send, 
  Paperclip, 
  Filter, 
  Plus, 
  MoreVertical, 
  ChevronRight, 
  Calendar, 
  Clock, 
  Tag, 
  User, 
  Info, 
  TrendingUp, 
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@supabase/supabase-js';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Utility for tailwind classes */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- CONFIG & TYPES ---

const getStorageEnv = (key: string) => localStorage.getItem(`IMP_CRM_${key}`) || '';

type Temperature = 'Frio' | 'Morno' | 'Cliente';
type AtendimentoStatus = 'Em atendimento' | 'Aguardando cliente' | 'Aguardando pagamento' | 'Atendimento encerrado';

interface Lead {
  id: string;
  name: string;
  phone: string;
  temperature: Temperature;
  status: AtendimentoStatus;
  tags: string[];
  notes: string;
  unread_count?: number;
  last_message?: string;
  last_message_time?: string;
  created_at: string;
}

interface Message {
  id: string;
  lead_id: string;
  content: string;
  sender: 'user' | 'lead';
  type: 'text' | 'image' | 'video' | 'audio' | 'document';
  timestamp: string;
  file_url?: string;
}

interface Campaign {
  id: string;
  name: string;
  template: string;
  description: string;
  created_at: string;
}

interface CampaignLead {
  campaign_id: string;
  lead_id: string;
}

interface FollowUp {
  id: string;
  lead_id: string;
  lead_name: string;
  date: string;
  time: string;
  message: string;
  notified?: boolean;
}

// --- MOCK DATA FOR DEMO ---

const MOCK_LEADS: Lead[] = [
  { id: '1', name: 'Leitura de Tabela OK', phone: '5511999999999', temperature: 'Morno', status: 'Em atendimento', tags: ['Teste'], notes: 'Modo Demo Ativo', created_at: new Date().toISOString(), last_message: 'Configure seu Supabase para ver seus dados reais.', last_message_time: new Date().toISOString(), unread_count: 1 },
];

const MOCK_MESSAGES: Message[] = [
  { id: 'm1', lead_id: '1', content: 'Configure as chaves do Supabase nas Configurações para carregar seus dados.', sender: 'user', type: 'text', timestamp: new Date().toISOString() },
];

const MOCK_CAMPAIGNS: Campaign[] = [
  { id: '1', name: 'Boas Vindas', template: 'Olá {nome}, bem-vindo!', description: 'Campanha padrão de teste', created_at: new Date().toISOString() }
];

// --- SUPABASE CLIENT ---

let supabaseClient: any = null;

const getSupabase = () => {
  if (supabaseClient) return supabaseClient;
  const url = getStorageEnv('SB_URL') || (import.meta as any).env.VITE_SUPABASE_URL;
  const key = getStorageEnv('SB_KEY') || (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
  if (url && key) {
    supabaseClient = createClient(url, key);
    return supabaseClient;
  }
  return null;
};

// --- COMPONENTS ---

const StatusBanner = ({ status }: { status: 'connecting' | 'connected' | 'error' | null }) => {
  if (!status) return null;
  const colors = {
    connecting: 'bg-yellow-500 text-black',
    connected: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
  };
  const labels = {
    connecting: 'Conectando ao Supabase...',
    connected: 'Conectado ao tempo real',
    error: 'Erro de conexão (Modo Demo)',
  };
  return (
    <motion.div 
      initial={{ y: -50 }} animate={{ y: 0 }} exit={{ y: -50 }}
      className={`fixed top-0 left-0 right-0 z-[100] h-10 flex items-center justify-center text-xs font-semibold ${colors[status]}`}
    >
      {labels[status]}
    </motion.div>
  );
};

interface ToastProps {
  key?: React.Key;
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Toast = ({ message, type, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}
      className={cn(
        "fixed bottom-6 right-6 z-[100] p-4 rounded-xl shadow-2xl flex items-center gap-3 border",
        type === 'success' ? "bg-green-500/10 border-green-500/50 text-green-400" : "bg-red-500/10 border-red-500/50 text-red-400"
      )}
    >
      {type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      <span className="text-sm font-medium">{message}</span>
    </motion.div>
  );
};

// --- MAIN APP ---

export default function App() {
  const [view, setView] = useState<'inbox' | 'leads' | 'status' | 'campaigns' | 'sales' | 'settings'>('inbox');
  const [dbStatus, setDbStatus] = useState<'connecting' | 'connected' | 'error' | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignLeads, setCampaignLeads] = useState<CampaignLead[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<{ id: number, message: string, type: 'success' | 'error' }[]>([]);
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [config, setConfig] = useState({
    sbUrl: getStorageEnv('SB_URL') || (import.meta as any).env.VITE_SUPABASE_URL || '',
    sbKey: getStorageEnv('SB_KEY') || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '',
    evUrl: getStorageEnv('EV_URL') || (import.meta as any).env.VITE_EVOLUTION_API_URL || '',
    evKey: getStorageEnv('EV_KEY') || (import.meta as any).env.VITE_EVOLUTION_API_KEY || '',
    evInstance: getStorageEnv('EV_INSTANCE') || (import.meta as any).env.VITE_EVOLUTION_INSTANCE || '',
  });

  // Audio Beep
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  };

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  // --- SUPABASE & REALTIME ---
  const connectDb = async () => {
    const sb = getSupabase();
    if (!sb) {
      setLeads(MOCK_LEADS);
      setMessages(MOCK_MESSAGES);
      setCampaigns(MOCK_CAMPAIGNS);
      setDbStatus('error');
      setTimeout(() => setDbStatus(null), 4000);
      return;
    }

    setDbStatus('connecting');
    try {
      // 1. Carregar Leads
      const { data: leadsData } = await sb.from('leads').select('*').order('created_at', { ascending: false });
      setLeads(leadsData || []);

      // 2. Carregar Mensagens
      const { data: messagesData } = await sb.from('messages').select('*').order('timestamp', { ascending: true });
      setMessages(messagesData || []);

      // 3. Carregar Campanhas
      const { data: campaignsData } = await sb.from('campaigns').select('*').order('created_at', { ascending: false });
      setCampaigns(campaignsData || []);

      // 4. Carregar Vínculos Leads-Campanhas
      const { data: campLeadsData } = await sb.from('campaign_leads').select('*');
      setCampaignLeads(campLeadsData || []);

      setDbStatus('connected');
      setTimeout(() => setDbStatus(null), 4000);

      // Realtime para todas as tabelas
      // Garantir que removemos qualquer canal anterior com o mesmo nome para evitar o erro "after subscribe"
      const channelName = 'crm-realtime-v3';
      const existingChannel = sb.getChannels().find((c: any) => c.topic === `realtime:${channelName}`);
      if (existingChannel) {
        await sb.removeChannel(existingChannel);
      }

      sb.channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]);
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload: any) => {
          if (payload.eventType === 'INSERT') setLeads(prev => [payload.new, ...prev]);
          if (payload.eventType === 'UPDATE') setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new : l));
        })
        .subscribe();

    } catch (err) {
      console.error("Dashboard Sync Error:", err);
      setLeads(MOCK_LEADS);
      setMessages(MOCK_MESSAGES);
      setDbStatus('error');
    }
  };

  useEffect(() => {
    connectDb();
  }, []);

  // --- FOLLOW-UP TICK ---
  useEffect(() => {
    const savedFollowUps = localStorage.getItem('imp_followups');
    if (savedFollowUps) setFollowUps(JSON.parse(savedFollowUps));

    const interval = setInterval(() => {
      const now = new Date();
      setFollowUps(prev => {
        let changed = false;
        const next = prev.map(f => {
          const fDate = new Date(`${f.date}T${f.time}`);
          if (fDate <= now && !f.notified) {
            addToast(`Lembrete: ${f.lead_name} - ${f.message}`, 'success');
            playBeep();
            changed = true;
            return { ...f, notified: true };
          }
          return f;
        });
        if (changed) localStorage.setItem('imp_followups', JSON.stringify(next));
        return next;
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // --- DERIVED STATE ---
  const filteredLeads = useMemo(() => {
    return leads.filter(l => 
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      l.phone.includes(searchQuery)
    );
  }, [leads, searchQuery]);

  const activeLead = useMemo(() => leads.find(l => l.id === activeLeadId), [leads, activeLeadId]);
  const activeMessages = useMemo(() => messages.filter(m => m.lead_id === activeLeadId), [messages, activeLeadId]);

  // --- HANDLERS ---
  const handleSendMessage = async (text: string, type: 'text' | 'image' = 'text', file?: File) => {
    if (!activeLeadId || !activeLead) return;

    const newMessage: Partial<Message> = {
      lead_id: activeLeadId,
      content: text,
      sender: 'user',
      type: type,
      timestamp: new Date().toISOString(),
    };

    // Optimistic UI
    const tempId = Math.random().toString(36).substr(2, 9);
    const msgToInsert = { ...newMessage, id: tempId } as Message;
    setMessages(prev => [...prev, msgToInsert]);

    try {
      // Integration with Evolution API
      if (config.evUrl && config.evKey && config.evInstance) {
        const endpoint = type === 'text' ? `/message/sendText/${config.evInstance}` : `/message/sendMedia/${config.evInstance}`;
        const body = type === 'text' 
          ? { number: activeLead.phone, text: text }
          : { number: activeLead.phone, media: text, fileName: file?.name, caption: '' };

        await fetch(`${config.evUrl}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': config.evKey },
          body: JSON.stringify(body)
        });
      }

      const sb = getSupabase();
      if (sb) {
        await sb.from('messages').insert([newMessage]);
      }
      
      addToast('Mensagem enviada', 'success');
    } catch (err) {
      console.error(err);
      addToast('Erro ao enviar mensagem', 'error');
    }
  };

  const updateLeadTemperature = async (id: string, temp: Temperature) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, temperature: temp } : l));
    const sb = getSupabase();
    if (sb) {
      await sb.from('leads').update({ temperature: temp }).eq('id', id);
    }
    addToast('Temperatura atualizada');
  };

  const updateLeadStatus = async (id: string, status: AtendimentoStatus) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: status } : l));
    const sb = getSupabase();
    if (sb) {
      await sb.from('leads').update({ status: status }).eq('id', id);
    }
    addToast('Status atualizado');
  };

  // --- VIEWS ---

  const Sidebar = () => (
    <aside className="w-16 md:w-20 bg-[#16161a] border-r border-white/5 flex flex-col items-center py-6 gap-8 fixed inset-y-0 left-0 z-50">
      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-green-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
        <span className="text-white font-bold text-xl">I</span>
      </div>
      
      <nav className="flex flex-col gap-4">
        {[
          { id: 'inbox', icon: MessageCircle, label: 'Inbox' },
          { id: 'leads', icon: Users, label: 'Leads' },
          { id: 'status', icon: BarChart2, label: 'Status' },
          { id: 'campaigns', icon: Megaphone, label: 'Mass' },
          { id: 'sales', icon: BarChart2, label: 'Insights' },
          { id: 'settings', icon: Settings, label: 'Settings' },
        ].map((item) => (
          <button
            key={item.id}
            id={`nav-btn-${item.id}`}
            onClick={() => setView(item.id as any)}
            className={cn(
              "p-3 rounded-2xl transition-all group relative",
              view === item.id ? "bg-purple-600/10 text-purple-500" : "text-gray-500 hover:text-white"
            )}
          >
            <item.icon size={22} />
            <span className="absolute left-[100%] ml-4 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
              {item.label}
            </span>
            {item.id === 'inbox' && leads.some(l => (l.unread_count || 0) > 0) && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </button>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden border-2 border-white/10">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" alt="User" />
        </div>
      </div>
    </aside>
  );

  const InboxView = () => (
    <div className="flex h-full overflow-hidden">
      {/* Contatos */}
      <div className="w-full max-w-[350px] border-r border-white/5 bg-[#0f0f12] flex flex-col">
        <div className="p-6 gap-4 flex flex-col">
          <h2 className="text-xl font-bold">Conversas</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input 
              type="text" 
              placeholder="Buscar contato..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#16161a] border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {['Todos', 'Frio', 'Morno', 'Cliente'].map(f => (
              <button key={f} className="px-3 py-1 rounded-full bg-[#16161a] border border-white/5 text-[10px] font-medium hover:border-purple-500 transition-all whitespace-nowrap">
                {f}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {filteredLeads.map(lead => (
            <button
              key={lead.id}
              onClick={() => setActiveLeadId(lead.id)}
              className={cn(
                "w-full p-4 flex gap-4 transition-all border-b border-white/5 text-left",
                activeLeadId === lead.id ? "bg-purple-600/5 border-r-2 border-r-purple-500" : "hover:bg-white/[0.02]"
              )}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden border border-white/10">
                  <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${lead.name}`} alt={lead.name} />
                </div>
                {lead.unread_count && lead.unread_count > 0 && (
                  <span className="absolute -top-1 -right-1 bg-green-500 text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-[#0f0f12]">
                    {lead.unread_count}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-sm truncate">{lead.name}</h3>
                  <span className="text-[10px] text-gray-500 whitespace-nowrap">
                    {lead.last_message_time ? formatDistanceToNow(new Date(lead.last_message_time), { addSuffix: true, locale: ptBR }) : ''}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">{lead.last_message || 'Inicie uma conversa'}</p>
                <div className="flex gap-1 mt-2">
                  <span className={cn(
                    "text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded",
                    lead.temperature === 'Frio' ? "bg-blue-500/20 text-blue-400" :
                    lead.temperature === 'Morno' ? "bg-yellow-500/20 text-yellow-500" :
                    "bg-green-500/10 text-green-500 border border-green-500/20"
                  )}>
                    {lead.temperature}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      {activeLead ? (
        <div className="flex-1 flex flex-col bg-[#0b0b0d]">
          {/* Header */}
          <div className="h-16 border-b border-white/5 px-6 flex items-center justify-between bg-[#0f0f12]/80 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden border border-white/10">
                <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${activeLead.name}`} alt={activeLead.name} />
              </div>
              <div>
                <h3 className="text-sm font-bold">{activeLead.name}</h3>
                <p className="text-[10px] text-green-500 font-medium">● Online</p>
              </div>
            </div>
            <div className="flex gap-4 text-gray-500">
              <button className="hover:text-white"><Info size={18} /></button>
              <button className="hover:text-white"><MoreVertical size={18} /></button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
            <div className="mx-auto my-4 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] text-gray-500 font-medium uppercase tracking-widest">
              Ontem
            </div>
            {activeMessages.map(msg => (
              <div 
                key={msg.id}
                className={cn(
                  "max-w-[80%] flex flex-col",
                  msg.sender === 'user' ? "items-end self-end" : "items-start self-start"
                )}
              >
                <div className={cn(
                  "px-4 py-3 rounded-2xl text-sm shadow-xl",
                  msg.sender === 'user' 
                    ? "bg-gradient-to-br from-purple-600 to-purple-800 text-white rounded-tr-none" 
                    : "bg-[#16161a] border border-white/5 text-gray-200 rounded-tl-none"
                )}>
                  {msg.type === 'text' ? msg.content : (
                    <img src={msg.file_url} className="rounded-lg max-w-[200px] mb-1" alt="Midia" />
                  )}
                  <div className={cn(
                    "text-[9px] mt-1 opacity-50 flex items-center gap-1",
                    msg.sender === 'user' ? "justify-end" : "justify-start"
                  )}>
                    {format(new Date(msg.timestamp), 'HH:mm')}
                    {msg.sender === 'user' && <CheckCircle2 size={10} />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-4 bg-[#0f0f12] border-t border-white/5">
            <div className="bg-[#16161a] border border-white/5 rounded-2xl p-2 flex items-end gap-2 shadow-inner">
              <button className="p-2 text-gray-500 hover:text-white transition-colors">
                <Paperclip size={20} />
              </button>
              <textarea 
                placeholder="Escreva uma mensagem..."
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 resize-none max-h-32 scrollbar-none"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (e.currentTarget.value.trim()) {
                      handleSendMessage(e.currentTarget.value.trim());
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
              <button 
                onClick={() => {
                  const input = document.querySelector('textarea');
                  if (input && input.value.trim()) {
                    handleSendMessage(input.value.trim());
                    input.value = '';
                  }
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white p-2.5 rounded-xl shadow-lg shadow-purple-500/20 transition-all active:scale-95"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-600 bg-[#0b0b0d]">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <MessageCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">Bem-vindo ao Império CRM</h3>
          <p className="text-sm">Selecione um contato para começar a vender.</p>
        </div>
      )}

      {/* Info Panel */}
      {activeLead && (
        <div className="w-full max-w-[320px] bg-[#0f0f12] border-l border-white/5 flex flex-col overflow-y-auto">
          <div className="p-6 flex flex-col items-center text-center border-b border-white/5">
            <div className="w-24 h-24 rounded-3xl bg-gray-800 flex items-center justify-center overflow-hidden border-2 border-white/10 mb-4 transform rotate-3">
              <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${activeLead.name}`} alt={activeLead.name} />
            </div>
            <h2 className="text-lg font-bold mb-1">{activeLead.name}</h2>
            <p className="text-sm text-gray-500 mb-4">{activeLead.phone}</p>
            <div className="flex gap-2 w-full">
              <button className="flex-1 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
                <Calendar size={14} /> Agendar
              </button>
              <button className="flex-1 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
                <DollarSign size={14} /> Venda
              </button>
            </div>
          </div>

          <div className="p-6 flex flex-col gap-6">
            <section>
              <h4 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3">Qualificação</h4>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[10px] text-gray-400 mb-1 block">Temperatura</label>
                  <div className="flex gap-2">
                    {(['Frio', 'Morno', 'Cliente'] as Temperature[]).map(t => (
                      <button 
                        key={t}
                        onClick={() => updateLeadTemperature(activeLead.id, t)}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all",
                          activeLead.temperature === t
                            ? "bg-purple-600/10 border-purple-500 text-purple-500 ring-1 ring-purple-500/50"
                            : "bg-white/[0.02] border-white/5 text-gray-500 hover:border-white/10"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 mb-1 block">Status</label>
                  <select 
                    value={activeLead.status}
                    onChange={(e) => updateLeadStatus(activeLead.id, e.target.value as any)}
                    className="w-full bg-white/[0.02] border border-white/5 rounded-lg py-2 px-3 text-[10px] appearance-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="Em atendimento">Em atendimento</option>
                    <option value="Aguardando cliente">Aguardando cliente</option>
                    <option value="Aguardando pagamento">Aguardando pagamento</option>
                    <option value="Atendimento encerrado">Atendimento encerrado</option>
                  </select>
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3 flex justify-between items-center">
                Histórico de Vendas
                <span className="text-green-500">R$ {sales.filter(s => s.lead_id === activeLead.id).reduce((acc, s) => acc + s.amount, 0).toFixed(2)}</span>
              </h4>
              <div className="flex flex-col gap-2">
                {sales.filter(s => s.lead_id === activeLead.id).length > 0 ? (
                  sales.filter(s => s.lead_id === activeLead.id).map(sale => (
                    <div key={sale.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold">R$ {sale.amount.toFixed(2)}</p>
                        <p className="text-[9px] text-gray-500">{sale.ad_name}</p>
                      </div>
                      <span className="text-[9px] text-gray-500">{format(new Date(sale.date), 'dd/MM/yy')}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-gray-600 text-center py-4 bg-white/5 rounded-xl border border-dashed border-white/10">Sem vendas registradas</p>
                )}
              </div>
            </section>

            <section>
              <h4 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3">Lembretes</h4>
              <div className="flex flex-col gap-2">
                {followUps.filter(f => f.lead_id === activeLead.id).map(f => (
                  <div key={f.id} className={cn(
                    "p-3 rounded-xl border flex flex-col gap-1",
                    f.notified ? "bg-white/[0.01] border-white/5 opacity-50" : "bg-purple-600/5 border-purple-500/20"
                  )}>
                    <div className="flex justify-between items-center text-[9px] font-bold">
                      <span className="text-purple-400 flex items-center gap-1"><Clock size={10} /> {f.time}</span>
                      <span className="text-gray-500">{f.date}</span>
                    </div>
                    <p className="text-[10px] text-gray-300 line-clamp-1">{f.message}</p>
                  </div>
                ))}
                <button 
                  onClick={() => setShowFollowUpModal(true)}
                  className="w-full py-2 rounded-xl text-[10px] text-gray-500 border border-dashed border-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={12} /> Novo Lembrete
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );

  const KanbanLeads = () => {
    const columns: Temperature[] = ['Frio', 'Morno', 'Cliente'];
    const colors = {
      Frio: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
      Morno: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-500',
      Cliente: 'border-green-500/20 bg-green-500/10 text-green-500'
    };

    return (
      <div className="p-8 h-full flex flex-col gap-8">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold mb-1">Qualificação de Leads</h1>
            <p className="text-sm text-gray-500">Acompanhe a temperatura da sua base em tempo real.</p>
          </div>
          <button 
            onClick={() => setShowNewLeadModal(true)}
            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-2xl flex items-center gap-2 font-bold shadow-lg shadow-purple-500/20"
          >
            <Plus size={20} /> Novo Lead
          </button>
        </header>

        <div className="flex-1 grid grid-cols-3 gap-6">
          {columns.map(col => (
            <div key={col} className="flex flex-col gap-4 bg-[#16161a]/30 rounded-3xl p-4 border border-white/5">
              <div className={cn("px-4 py-2 rounded-2xl border flex items-center justify-between", colors[col])}>
                <span className="text-xs font-bold uppercase tracking-wider">{col}</span>
                <span className="text-sm">{leads.filter(l => l.temperature === col).length}</span>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3">
                {leads.filter(l => l.temperature === col).map(lead => (
                  <motion.div 
                    layoutId={lead.id}
                    key={lead.id}
                    onClick={() => { setActiveLeadId(lead.id); setView('inbox'); }}
                    className="p-4 bg-[#16161a] border border-white/5 rounded-2xl cursor-pointer hover:border-purple-500/50 transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center overflow-hidden border border-white/10 group-hover:scale-105 transition-transform">
                        <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${lead.name}`} alt={lead.name} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold truncate max-w-[140px]">{lead.name}</h4>
                        <p className="text-[10px] text-gray-500">{lead.phone}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 line-clamp-2 mb-4 bg-white/5 p-2 rounded-lg italic">
                      "{lead.last_message || 'Nenhuma mensagem'}"
                    </p>
                    <div className="flex justify-between items-center">
                      <div className="flex gap-1">
                        {lead.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[8px] bg-white/5 px-2 py-0.5 rounded text-gray-500">{tag}</span>
                        ))}
                      </div>
                      <ChevronRight size={14} className="text-gray-600 group-hover:text-purple-500 transition-all" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const InsightsView = () => {
    const stats = useMemo(() => {
      const total = leads.length;
      const clientes = leads.filter(l => l.temperature === 'Cliente').length;
      const morno = leads.filter(l => l.temperature === 'Morno').length;
      const frio = leads.filter(l => l.temperature === 'Frio').length;
      
      return {
        total,
        conversion: total ? Math.round((clientes / total) * 100) : 0,
        mornoPerc: total ? Math.round((morno / total) * 100) : 0,
        frioPerc: total ? Math.round((frio / total) * 100) : 0,
        tempData: [
          { name: 'Frio', value: frio, color: '#3b82f6' },
          { name: 'Morno', value: morno, color: '#eab308' },
          { name: 'Cliente', value: clientes, color: '#22c55e' },
        ]
      };
    }, [leads]);

    const lastMessages = useMemo(() => {
      return [...messages].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
    }, [messages]);

    return (
      <div className="p-8 h-full flex flex-col gap-8">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold mb-1">Métricas do Império</h1>
            <p className="text-sm text-gray-500">Visão geral da sua base de dados sincronizada.</p>
          </div>
          <div className="flex gap-3">
            <button className="bg-white/5 border border-white/5 text-gray-400 px-6 py-2.5 rounded-2xl flex items-center gap-2 font-bold hover:text-white transition-all">
              <Download size={18} /> Relatório Full
            </button>
          </div>
        </header>

        {/* Highlight Stats */}
        <div className="grid grid-cols-3 gap-6">
          <div className="p-8 bg-[#16161a] border border-white/5 rounded-[40px] flex flex-col relative overflow-hidden group">
            <TrendingUp size={40} className="absolute -right-4 -top-4 opacity-10 scale-150 rotate-12 group-hover:scale-110 transition-transform" />
            <span className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">Total de Leads</span>
            <span className="text-3xl font-black text-white tracking-tighter">{stats.total} Contatos</span>
            <div className="flex items-center gap-2 mt-4 text-[10px] text-blue-500 font-bold">
              {stats.frioPerc}% da base está em estágio inicial (Frio)
            </div>
          </div>
          <div className="p-8 bg-[#16161a] border border-white/5 rounded-[40px] flex flex-col">
            <span className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">Taxa de Conversão</span>
            <span className="text-3xl font-black text-green-500 tracking-tighter">{stats.conversion}% Clientes</span>
            <div className="flex items-center gap-2 mt-4 text-[10px] text-green-500 font-bold">
              <CheckCircle2 size={12} /> Leads que atingiram temperatura máxima
            </div>
          </div>
          <div className="p-8 bg-[#16161a] border border-white/5 rounded-[40px] flex flex-col">
            <span className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">Potencial de Venda</span>
            <span className="text-3xl font-black text-purple-500 tracking-tighter">{stats.mornoPerc}% Morno</span>
            <div className="flex items-center gap-2 mt-4 text-[10px] text-gray-500 font-medium">
              <Users size={12} /> leads prontos para abordagem agressiva
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 flex-1 min-h-0">
          {/* Distribuição */}
          <div className="bg-[#16161a]/30 rounded-[40px] p-8 border border-white/5 flex flex-col gap-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500">Distribuição por Temperatura</h3>
            <div className="flex-1 flex flex-col justify-center gap-8">
              {stats.tempData.map(t => (
                <div key={t.name} className="flex flex-col gap-2">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold">{t.name}</span>
                    <span className="text-xs text-gray-500">{t.value} Leads ({stats.total ? Math.round((t.value / stats.total) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: `${stats.total ? (t.value / stats.total) * 100 : 0}%` }} 
                      className="h-full rounded-full" 
                      style={{ backgroundColor: t.color, boxShadow: `0 0 10px ${t.color}40` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Atividade Recente */}
          <div className="bg-[#16161a]/30 rounded-[40px] p-8 border border-white/5 flex flex-col gap-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500">Últimas Interações (Live)</h3>
            <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-4">
              {lastMessages.map(m => {
                const lead = leads.find(l => l.id === m.lead_id);
                return (
                  <div key={m.id} className="p-4 bg-[#16161a] border border-white/5 rounded-2xl flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold">
                      {lead?.name.charAt(0) || 'L'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-bold truncate">{lead?.name || 'Lead Desconhecido'}</p>
                        <span className="text-[9px] text-gray-600">{formatDistanceToNow(new Date(m.timestamp), { addSuffix: true, locale: ptBR })}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 truncate">{m.content}</p>
                    </div>
                  </div>
                );
              })}
              {lastMessages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-600 italic text-sm">
                  Nenhuma mensagem registrada ainda.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const CampaignsView = () => {
    const [selectedCamp, setSelectedCamp] = useState<Campaign | null>(campaigns[0] || null);
    const [isSending, setIsSending] = useState(false);
    const [progress, setProgress] = useState(0);

    const activeCampaign = selectedCamp || campaigns[0];

    const handleStartCampaign = async () => {
      if (!activeCampaign) {
        addToast('Nenhum template de campanha disponível', 'error');
        return;
      }
      setIsSending(true);
      setProgress(0);
      
      // Filtra leads que pertencem a esta campanha via campaign_leads
      const targetLeadIds = campaignLeads
        .filter(cl => cl.campaign_id === activeCampaign.id)
        .map(cl => cl.lead_id);
      
      const targets = leads.filter(l => targetLeadIds.includes(l.id));
      
      if (targets.length === 0) {
        addToast('Nenhum lead vinculado a esta campanha', 'error');
        setIsSending(false);
        return;
      }

      for (let i = 0; i < targets.length; i++) {
        const lead = targets[i];
        const personalizedMsg = activeCampaign.template.replace('{nome}', lead.name);
        
        // Envio real via Evolution API
        if (config.evUrl && config.evKey && config.evInstance) {
          try {
            await fetch(`${config.evUrl}/message/sendText/${config.evInstance}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': config.evKey },
              body: JSON.stringify({ number: lead.phone, text: personalizedMsg })
            });
          } catch (e) {
            console.error(`Erro ao enviar para ${lead.name}`, e);
          }
        }

        await new Promise(r => setTimeout(r, 4000));
        setProgress(Math.round(((i + 1) / targets.length) * 100));
      }
      setIsSending(false);
      addToast('Campanha finalizada com sucesso!', 'success');
    };

    return (
      <div className="p-8 h-full flex flex-col gap-8">
        <header>
          <h1 className="text-2xl font-bold mb-1">Campanhas em Massa</h1>
          <p className="text-sm text-gray-500">Automatize seus disparos e multiplique suas conversões.</p>
        </header>

        <div className="flex gap-8 flex-1">
          {/* List */}
          <div className="w-[350px] flex flex-col gap-4 overflow-y-auto pr-2">
            {campaigns.map(camp => (
              <button 
                key={camp.id}
                onClick={() => setSelectedCamp(camp)}
                className={cn(
                  "p-6 rounded-[32px] border text-left transition-all relative overflow-hidden group",
                  activeCampaign?.id === camp.id ? "bg-purple-600/5 border-purple-500" : "bg-[#16161a] border-white/5 opacity-50 hover:opacity-100"
                )}
              >
                <div className={cn("w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4 text-purple-500")}>
                  <Megaphone size={24} />
                </div>
                <h3 className="font-bold mb-1">{camp.name}</h3>
                <p className="text-[10px] text-gray-500 line-clamp-1">{camp.description}</p>
                {activeCampaign?.id === camp.id && <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 text-purple-500" size={20} />}
              </button>
            ))}
            {campaigns.length === 0 && (
              <div className="p-8 border border-dashed border-white/10 rounded-[32px] text-center text-gray-500">
                Nenhuma campanha encontrada no Supabase.
              </div>
            )}
          </div>

          {/* Editor */}
          <div className="flex-1 bg-[#16161a] border border-white/5 rounded-[40px] p-8 flex flex-col gap-8 relative overflow-hidden">
            {!activeCampaign ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <Megaphone size={48} className="mb-4 opacity-20" />
                <p>Selecione ou crie uma campanha no seu banco de dados.</p>
              </div>
            ) : (
              <>
                {isSending && (
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-12 text-center">
                    <div className="w-24 h-24 rounded-full border-4 border-purple-600/20 border-t-purple-600 animate-spin mb-8" />
                    <h2 className="text-2xl font-bold mb-2">Disparando Campanha...</h2>
                    <p className="text-gray-500 mb-8 max-w-sm">Duração estimada: {Math.round((leads.filter(l => campaignLeads.some(cl => cl.campaign_id === activeCampaign.id && cl.lead_id === l.id)).length * 4) / 60)} minutos.</p>
                    <div className="w-full max-w-md h-3 bg-white/5 rounded-full overflow-hidden mb-2">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-purple-600 shadow-[0_0_20px_rgba(147,51,234,0.5)]" />
                    </div>
                    <span className="text-xs font-bold text-gray-400">{progress}% Concluído</span>
                  </div>
                )}

                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="px-4 py-1.5 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-bold uppercase tracking-widest border border-purple-500/20">
                      Campanha: {activeCampaign.name}
                    </div>
                  </div>
                  <button 
                    onClick={handleStartCampaign}
                    className="bg-gradient-to-br from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white px-8 py-3 rounded-2xl flex items-center gap-3 font-bold shadow-xl shadow-purple-500/20 transform hover:scale-105 active:scale-95 transition-all"
                  >
                    <Play size={18} fill="currentColor" /> Iniciar Disparos
                  </button>
                </div>

                <div className="flex-1 flex flex-col gap-6">
                  <div className="flex-1 flex flex-col gap-2">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Script da Mensagem (Sincronizado do Supabase)</label>
                    <div className="flex-1 bg-black/30 border border-white/5 rounded-3xl p-6 text-sm text-gray-300 font-medium leading-relaxed">
                      {activeCampaign.template}
                    </div>
                  </div>

                  <div className="h-[200px] border-t border-white/5 pt-6 flex flex-col gap-4">
                    <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Leads Vinculados nesta Campanha</h4>
                    <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none">
                      {leads
                        .filter(l => campaignLeads.some(cl => cl.campaign_id === activeCampaign.id && cl.lead_id === l.id))
                        .map(l => (
                          <div key={l.id} className="min-w-[120px] bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col items-center text-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden text-[10px]">
                              {l.name.charAt(0)}
                            </div>
                            <span className="text-[10px] font-bold truncate w-full">{l.name}</span>
                          </div>
                      ))}
                      {leads.filter(l => campaignLeads.some(cl => cl.campaign_id === activeCampaign.id && cl.lead_id === l.id)).length === 0 && (
                        <p className="text-[10px] text-gray-600 italic">Nenhum lead vinculado via tabela campaign_leads.</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const SettingsView = () => {
    const handleSave = () => {
      localStorage.setItem('IMP_CRM_SB_URL', config.sbUrl);
      localStorage.setItem('IMP_CRM_SB_KEY', config.sbKey);
      localStorage.setItem('IMP_CRM_EV_URL', config.evUrl);
      localStorage.setItem('IMP_CRM_EV_KEY', config.evKey);
      localStorage.setItem('IMP_CRM_EV_INSTANCE', config.evInstance);
      addToast('Configurações salvas! Recarregando...', 'success');
      setTimeout(() => window.location.reload(), 1500);
    };

    return (
      <div className="p-8 max-w-2xl mx-auto h-full flex flex-col gap-8">
        <header>
          <h1 className="text-2xl font-bold mb-1">Configurações de Integração</h1>
          <p className="text-sm text-gray-500">Conecte seu Supabase e Evolution API para sincronizar dados em tempo real.</p>
        </header>

        <div className="bg-[#16161a] border border-white/5 rounded-[40px] p-8 flex flex-col gap-8">
          <section className="flex flex-col gap-6">
            <h3 className="text-sm font-bold flex items-center gap-2 text-purple-500">
              <TrendingUp size={18} /> Supabase (Banco de Dados)
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Project URL</label>
                <input 
                  type="text" 
                  value={config.sbUrl}
                  onChange={e => setConfig(prev => ({ ...prev, sbUrl: e.target.value }))}
                  placeholder="https://sua-url.supabase.co" 
                  className="bg-black/30 border border-white/5 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" 
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Anon Key</label>
                <input 
                  type="password" 
                  value={config.sbKey}
                  onChange={e => setConfig(prev => ({ ...prev, sbKey: e.target.value }))}
                  placeholder="sua-chave-anon" 
                  className="bg-black/30 border border-white/5 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" 
                />
              </div>
            </div>
          </section>

          <div className="h-px bg-white/5" />

          <section className="flex flex-col gap-6">
            <h3 className="text-sm font-bold flex items-center gap-2 text-green-500">
              <MessageCircle size={18} /> Evolution API (WhatsApp)
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Base URL</label>
                <input 
                  type="text" 
                  value={config.evUrl}
                  onChange={e => setConfig(prev => ({ ...prev, evUrl: e.target.value }))}
                  placeholder="https://api.sua-instancia.com" 
                  className="bg-black/30 border border-white/5 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" 
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">API Key</label>
                <input 
                  type="password" 
                  value={config.evKey}
                  onChange={e => setConfig(prev => ({ ...prev, evKey: e.target.value }))}
                  placeholder="sua-chave-api" 
                  className="bg-black/30 border border-white/5 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" 
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Nome da Instância</label>
                <input 
                  type="text" 
                  value={config.evInstance}
                  onChange={e => setConfig(prev => ({ ...prev, evInstance: e.target.value }))}
                  placeholder="ex: User01" 
                  className="bg-black/30 border border-white/5 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" 
                />
              </div>
            </div>
          </section>

          <button 
            onClick={handleSave}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-purple-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Settings size={20} /> Salvar e Sincronizar Agora
          </button>
        </div>
      </div>
    );
  };

  // --- RENDERING ---

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0f0f12] text-gray-100 flex-row">
      <StatusBanner status={dbStatus} />
      <AnimatePresence>
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
        ))}
      </AnimatePresence>

      <Sidebar />

      <main className="flex-1 ml-16 md:ml-20 h-full overflow-hidden">
        {view === 'inbox' && <InboxView />}
        {view === 'leads' && <KanbanLeads />}
        {view === 'status' && <KanbanLeads />} {/* Shared Kanban logic for simplicity */}
        {view === 'sales' && <InsightsView />}
        {view === 'campaigns' && <CampaignsView />}
        {view === 'settings' && <SettingsView />}
      </main>

      {/* Modals placeholders for now */}
      {showNewLeadModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-[#16161a] border border-white/10 rounded-[40px] p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold">Novo Lead</h2>
              <button onClick={() => setShowNewLeadModal(false)} className="text-gray-500 hover:text-white"><X size={24} /></button>
            </div>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Nome Completo</label>
                <input type="text" placeholder="Ex: João Silva" className="bg-black/30 border border-white/5 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">WhatsApp (DDI + DDD + Num)</label>
                <input type="text" placeholder="Ex: 5511999999999" className="bg-black/30 border border-white/5 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Temperatura Inicial</label>
                <div className="flex gap-2">
                  {['Frio', 'Morno', 'Cliente'].map(t => (
                    <button key={t} className="flex-1 py-3 rounded-2xl bg-black/30 border border-white/5 text-[10px] font-bold text-gray-500 hover:border-purple-500 transition-all">{t}</button>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => { addToast('Lead criado com sucesso!'); setShowNewLeadModal(false); }}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-2xl mt-4 shadow-lg shadow-purple-500/20 transition-all"
              >
                Cadastrar Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewSaleModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-[#16161a] border border-white/10 rounded-[40px] p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold">Registrar Nova Venda</h2>
              <button onClick={() => setShowNewSaleModal(false)} className="text-gray-500 hover:text-white"><X size={24} /></button>
            </div>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Valor da Venda</label>
                <input type="number" placeholder="R$ 0,00" className="bg-black/30 border border-white/5 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Anúncio / Origem</label>
                <input type="text" placeholder="Ex: FB Ads - Campanha 01" className="bg-black/30 border border-white/5 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
              </div>
              <button 
                onClick={() => { addToast('Venda registrada!', 'success'); setShowNewSaleModal(false); }}
                className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-4 rounded-2xl mt-4 shadow-lg shadow-green-500/20 transition-all"
              >
                Salvar Venda
              </button>
            </div>
          </div>
        </div>
      )}

      {showFollowUpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-[#16161a] border border-white/10 rounded-[40px] p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold">Agendar Follow-up</h2>
              <button onClick={() => setShowFollowUpModal(false)} className="text-gray-500 hover:text-white"><X size={24} /></button>
            </div>
            <div className="flex flex-col gap-5">
              <div className="flex gap-4">
                <div className="flex-1 flex flex-col gap-2">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Data</label>
                  <input type="date" className="bg-black/30 border border-white/5 rounded-2xl py-3 px-4 text-sm focus:outline-none text-white" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Hora</label>
                  <input type="time" className="bg-black/30 border border-white/5 rounded-2xl py-3 px-4 text-sm focus:outline-none text-white" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Mensagem do Lembrete</label>
                <input type="text" placeholder="Ex: Oferecer desconto agressivo" className="bg-black/30 border border-white/5 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500" />
              </div>
              <button 
                onClick={() => { 
                  const date = (document.querySelector('input[type="date"]') as HTMLInputElement).value;
                  const time = (document.querySelector('input[type="time"]') as HTMLInputElement).value;
                  const msg = (document.querySelectorAll('input[type="text"]')[1] as HTMLInputElement).value;
                  if (activeLead && date && time && msg) {
                    const newFollowUp = { id: Date.now().toString(), lead_id: activeLead.id, lead_name: activeLead.name, date, time, message: msg };
                    setFollowUps(prev => {
                      const next = [...prev, newFollowUp];
                      localStorage.setItem('imp_followups', JSON.stringify(next));
                      return next;
                    });
                    addToast('Follow-up agendado!'); 
                    setShowFollowUpModal(false);
                  } else {
                    addToast('Preencha todos os campos', 'error');
                  }
                }}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-2xl mt-4 shadow-lg shadow-purple-500/20 transition-all"
              >
                Agendar Agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
