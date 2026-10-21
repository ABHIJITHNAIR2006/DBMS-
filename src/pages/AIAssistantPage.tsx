import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Database,
  HelpCircle,
  Lightbulb,
  Info
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayChip } from '../components/clay/ClayChip';
import { useDB } from '../db/store';
import { geminiService } from '../services/gemini';
import { queries } from '../db/queries';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const AIAssistantPage: React.FC = () => {
  const { state, derivedStock } = useDB();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: `Hello! I am your AI Database Assistant for ClayStock. I can answer questions about the 10-table 3NF schema, relational normal forms, current inventory stock levels, supplier purchases, or department consumption. Ask me anything!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const dataSnapshot = {
        totalItems: state.ITEM.length,
        items: state.ITEM.map(i => i.ItemName),
        derivedStockSummary: derivedStock.map(s => ({
          id: s.item.ItemID,
          name: s.item.ItemName,
          category: s.item.Category,
          stock: s.currentStock,
          status: s.status
        })),
        departments: state.DEPARTMENT.map(d => d.DeptName),
        suppliers: state.SUPPLIER.map(s => s.SupplierName),
        lowStockItems: queries.getLowStockItems().map(s => s.item.ItemName)
      };

      const response = await geminiService.askDatabaseAssistant({
        message: text,
        contextType: 'CHAT',
        dataSnapshot
      });

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unable to connect to AI server';
      const cleanError = errorMsg.replace(/\.+$/, '');
      const aiErrorMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'assistant',
        text: `Notice: ${cleanError}. Please ensure the GEMINI_API_KEY environment variable is active or check network status.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiErrorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const SUGGESTED_QUESTIONS = [
    'Why is SUPPLIER decomposed into PINCODE_CITY?',
    'Which department consumed the most paper?',
    'Why is StockQty not stored in any table?',
    'Explain the weak entity STOCK_BATCH with HAS_BATCH.',
    'What items are currently below their reorder level?'
  ];

  return (
    <div className="w-full space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-clay-text">
              AI Database Assistant & Viva Tutor
            </h1>
            <ClayChip label="Gemini Flash" variant="periwinkle" />
          </div>
          <p className="text-xs sm:text-sm text-clay-text-muted mt-1">
            Grounded in the 10-table 3NF relational schema and real-time database state
          </p>
        </div>
      </div>

      {/* Suggested Questions */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-clay-text-muted flex items-center gap-1.5 uppercase">
          <Lightbulb size={14} className="text-amber-500" />
          <span>Recommended Viva & Schema Inquiries:</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => handleSendMessage(q)}
              className="text-xs px-3 py-1.5 rounded-full clay-card-flat bg-white/80 dark:bg-slate-900/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-clay-text cursor-pointer transition-colors text-left"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Conversation Card */}
      <ClayCard className="p-4 sm:p-6 flex flex-col h-[520px]">
        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${
                msg.sender === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white'
                    : 'bg-gradient-to-tr from-pink-400 to-rose-500 text-white'
                }`}
              >
                {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>

              <div
                className={`max-w-[80%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-xs'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-clay-text rounded-tl-xs border border-clay-border whitespace-pre-line'
                }`}
              >
                {msg.text}
                <div
                  className={`text-[10px] mt-1.5 font-mono ${
                    msg.sender === 'user' ? 'text-indigo-200 text-right' : 'text-clay-text-muted'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-pink-400 to-rose-500 text-white flex items-center justify-center">
                <Bot size={16} />
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl rounded-tl-xs border border-clay-border flex items-center gap-2 text-xs text-clay-text-muted">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
                <span className="ml-1 font-medium">Analyzing database schema & data...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="mt-4 pt-3 border-t border-clay-border flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask about 3NF, stock levels, suppliers, or SQL queries..."
            disabled={isLoading}
            className="clay-input flex-1 text-xs sm:text-sm"
          />
          <ClayButton
            variant="primary"
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputText.trim()}
            icon={<Send size={15} />}
          >
            Send
          </ClayButton>
        </div>
      </ClayCard>
    </div>
  );
};
