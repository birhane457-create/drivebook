import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReactMarkdown from 'react-markdown';
import {
  Bot, Send, Sparkles, BarChart3, ShoppingCart, DollarSign, Brain,
  FileText, Plus, Trash2, Pin, ChevronRight, Loader2, Zap
} from 'lucide-react';

const MODULES = [
  { id: 'general', label: 'General Assistant', icon: Bot, color: 'bg-purple-500', description: 'Ask anything about your ERP' },
  { id: 'inventory', label: 'Inventory AI', icon: Brain, color: 'bg-blue-500', description: 'Optimize stock & replenishment' },
  { id: 'purchasing', label: 'Purchasing AI', icon: ShoppingCart, color: 'bg-orange-500', description: 'PO suggestions & vendor analysis' },
  { id: 'financial', label: 'Financial AI', icon: DollarSign, color: 'bg-green-500', description: 'P&L, cash flow & forecasts' },
  { id: 'executive', label: 'Executive AI', icon: Sparkles, color: 'bg-yellow-500', description: 'KPIs, strategy & board reports' },
  { id: 'reports', label: 'Report Generator', icon: FileText, color: 'bg-red-500', description: 'Auto-generate any report' },
];

const QUICK_PROMPTS = {
  general: ['What are my top 5 alerts today?', 'Summarize system performance this week', 'What needs my attention right now?'],
  inventory: ['Which products are at risk of stockout?', 'Optimize my reorder points', 'Show dead stock analysis'],
  purchasing: ['Which vendors have best delivery performance?', 'Should I consolidate my open POs?', 'Suggest POs for next 30 days'],
  financial: ['What is my cash flow projection for Q3?', 'Analyze gross margin by category', 'Show overdue receivables summary'],
  executive: ['Board-ready KPI summary', 'Top 3 operational risks this month', 'Revenue growth vs target analysis'],
  reports: ['Generate monthly inventory report', 'Create supplier performance scorecard', 'Build sales trend analysis report'],
};

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
        {isUser ? (
          <p>{msg.content}</p>
        ) : (
          <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {msg.content}
          </ReactMarkdown>
        )}
        <p className={`text-[10px] mt-1 ${isUser ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
          {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}
        </p>
      </div>
    </div>
  );
}

export default function AICopilot() {
  const [activeModule, setActiveModule] = useState('general');
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { loadConversations(); }, [activeModule]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadConversations() {
    setLoadingConvs(true);
    const convs = await base44.entities.AIConversation.filter({ module: activeModule }, '-created_date', 20);
    setConversations(convs);
    setLoadingConvs(false);
  }

  async function newConversation() {
    const conv = await base44.entities.AIConversation.create({
      module: activeModule,
      title: 'New conversation',
      messages: [],
    });
    setConversations(prev => [conv, ...prev]);
    setActiveConv(conv);
    setMessages([]);
  }

  async function openConversation(conv) {
    setActiveConv(conv);
    setMessages(conv.messages || []);
  }

  async function deleteConv(id, e) {
    e.stopPropagation();
    await base44.entities.AIConversation.delete(id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConv?.id === id) { setActiveConv(null); setMessages([]); }
  }

  async function sendMessage(text) {
    const msg = text || input.trim();
    if (!msg) return;
    setInput('');

    let conv = activeConv;
    if (!conv) {
      conv = await base44.entities.AIConversation.create({
        module: activeModule,
        title: msg.slice(0, 60),
        messages: [],
      });
      setConversations(prev => [conv, ...prev]);
      setActiveConv(conv);
    }

    const userMsg = { role: 'user', content: msg, timestamp: new Date().toISOString() };
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    setLoading(true);

    const moduleCtx = MODULES.find(m => m.id === activeModule);
    const systemPrompt = `You are an AI assistant specialized in ${moduleCtx?.label} for an enterprise ERP/WMS platform called WMS Pro. 
You help users with ${moduleCtx?.description}. 
Provide actionable, data-driven insights. Format responses with markdown. Be concise but comprehensive.
When analyzing data, provide specific recommendations with priorities.`;

    const historyText = updatedMsgs.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    const fullPrompt = `${systemPrompt}\n\nConversation history:\n${historyText}\n\nUser: ${msg}\n\nAssistant:`;

    const response = await base44.integrations.Core.InvokeLLM({ prompt: fullPrompt });

    const assistantMsg = { role: 'assistant', content: response, timestamp: new Date().toISOString() };
    const finalMsgs = [...updatedMsgs, assistantMsg];
    setMessages(finalMsgs);
    setLoading(false);

    await base44.entities.AIConversation.update(conv.id, {
      messages: finalMsgs,
      title: conv.title === 'New conversation' ? msg.slice(0, 60) : conv.title,
    });
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, messages: finalMsgs, title: conv.title === 'New conversation' ? msg.slice(0, 60) : conv.title } : c));
  }

  const activeModuleObj = MODULES.find(m => m.id === activeModule);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Left: Module Switcher + Conversation List */}
      <div className="w-72 flex flex-col border-r bg-muted/20">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm">AI Copilot</h2>
              <p className="text-[10px] text-muted-foreground">Enterprise Intelligence</p>
            </div>
          </div>
          <Select value={activeModule} onValueChange={v => { setActiveModule(v); setActiveConv(null); setMessages([]); }}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODULES.map(m => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="p-2">
          <Button size="sm" className="w-full gap-2 text-xs" onClick={newConversation}>
            <Plus className="w-3 h-3" /> New Conversation
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => openConversation(conv)}
              className={`group flex items-start gap-2 p-2 rounded-lg cursor-pointer mb-1 text-xs transition-colors ${activeConv?.id === conv.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
            >
              <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span className="flex-1 truncate">{conv.title || 'Conversation'}</span>
              <button onClick={(e) => deleteConv(conv.id, e)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {conversations.length === 0 && !loadingConvs && (
            <p className="text-xs text-muted-foreground text-center py-4">No conversations yet</p>
          )}
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b flex items-center px-6 gap-3">
          <div className={`w-8 h-8 rounded-lg ${activeModuleObj?.color} flex items-center justify-center`}>
            {activeModuleObj && <activeModuleObj.icon className="w-4 h-4 text-white" />}
          </div>
          <div>
            <h3 className="font-semibold text-sm">{activeModuleObj?.label}</h3>
            <p className="text-xs text-muted-foreground">{activeModuleObj?.description}</p>
          </div>
          <Badge variant="outline" className="ml-auto text-[10px] gap-1">
            <Zap className="w-2.5 h-2.5 text-yellow-500" /> Powered by AI
          </Badge>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className={`w-16 h-16 rounded-2xl ${activeModuleObj?.color} flex items-center justify-center mx-auto mb-4`}>
                {activeModuleObj && <activeModuleObj.icon className="w-8 h-8 text-white" />}
              </div>
              <h3 className="font-semibold text-lg mb-1">{activeModuleObj?.label}</h3>
              <p className="text-muted-foreground text-sm mb-6">{activeModuleObj?.description}</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                {(QUICK_PROMPTS[activeModule] || []).map(p => (
                  <button key={p} onClick={() => sendMessage(p)}
                    className="text-xs bg-muted hover:bg-muted/80 border rounded-full px-3 py-1.5 transition-colors text-left">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={`Ask ${activeModuleObj?.label}...`}
              className="flex-1"
              disabled={loading}
            />
            <Button onClick={() => sendMessage()} disabled={loading || !input.trim()} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            AI responses are generated and may need verification against actual data.
          </p>
        </div>
      </div>
    </div>
  );
}