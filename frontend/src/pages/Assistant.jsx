import { useEffect, useRef, useState } from 'react';
import { BrainCircuit, Send, Sparkles } from 'lucide-react';
import client, { errMsg } from '../api/client';
import { Card, btnPrimary } from '../components/ui';

const SUGGESTIONS = [
  'Why did my profit decrease this month?',
  'What are my best-selling products?',
  'Which products are likely to run out of stock?',
  'What is my sales forecast?',
  'Which product should I promote?',
  'How many orders were cancelled?',
];

export default function Assistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [followups, setFollowups] = useState(SUGGESTIONS.slice(0, 4));
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const ask = async (q) => {
    if (!q?.trim() || busy) return;
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setBusy(true);
    try {
      const { data } = await client.post('/ai/assistant', { question: q });
      setMessages((m) => [...m, { role: 'ai', text: data.answer, intent: data.intent }]);
      setFollowups(data.suggestedFollowups?.length ? data.suggestedFollowups : SUGGESTIONS.slice(2, 6));
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', text: `Sorry — ${errMsg(e)}`, error: true }]);
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="text-center pt-2">
        <div className="inline-flex w-12 h-12 rounded-2xl bg-indigo-600 items-center justify-center mb-3 shadow-lg shadow-indigo-600/30">
          <BrainCircuit size={24} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800">AI Business Assistant</h1>
        <p className="text-sm text-slate-500 mt-1">Ask anything about your business — answers use your real data</p>
      </div>

      <Card className="min-h-[420px] flex flex-col">
        <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[52vh]">
          {messages.length === 0 && (
            <div className="text-center py-10">
              <Sparkles className="mx-auto text-indigo-300 mb-3" size={32} />
              <div className="text-slate-500 text-sm">Try one of these questions:</div>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="text-xs border border-slate-200 rounded-full px-3.5 py-2 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition">{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-line leading-relaxed ${
                m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-md' : m.error ? 'bg-rose-50 text-rose-700 border border-rose-200 rounded-bl-md' : 'bg-slate-100 text-slate-700 rounded-bl-md'
              }`}>
                {m.text}
                {m.intent && <div className="mt-2 text-[10px] uppercase tracking-wider opacity-50">intent: {m.intent}</div>}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {messages.length > 0 && (
          <div className="px-5 pb-2 flex flex-wrap gap-1.5">
            {followups.map((f) => (
              <button key={f} onClick={() => ask(f)} disabled={busy} className="text-xs bg-indigo-50 text-indigo-600 rounded-full px-3 py-1.5 hover:bg-indigo-100 disabled:opacity-50">{f}</button>
            ))}
          </div>
        )}

        <form className="p-4 border-t border-slate-100 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
          <input
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            placeholder="e.g. Which products have the highest return rate?"
            value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
          />
          <button className={btnPrimary + ' px-5'} disabled={busy || !input.trim()}><Send size={15} /></button>
        </form>
      </Card>

      <p className="text-xs text-slate-400 text-center">The assistant reads your authorized business data only. Predictions are estimates, not guarantees.</p>
    </div>
  );
}
