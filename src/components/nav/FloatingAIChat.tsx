import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Send, Bot, User } from 'lucide-react';
import { ClayButton } from '../clay/ClayButton';
import { useDB } from '../../db/store';
import { geminiService } from '../../services/gemini';
import { queries } from '../../db/queries';

export const FloatingAIChat: React.FC = () => {
  const { state, derivedStock } = useDB();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string }>>([
    {
      sender: 'assistant',
      text: 'Hi! Ask me anything about ClayStock: 3NF design, stock quantities, or query logic.'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const dataSnapshot = {
        totalItems: state.ITEM.length,
        lowStockItems: queries.getLowStockItems().map(s => s.item.ItemName),
        departments: state.DEPARTMENT.map(d => d.DeptName),
        suppliers: state.SUPPLIER.map(s => s.SupplierName)
      };

      const response = await geminiService.askDatabaseAssistant({
        message: userText,
        contextType: 'CHAT',
        dataSnapshot
      });

      setMessages(prev => [...prev, { sender: 'assistant', text: response }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI assistant error';
      setMessages(prev => [
        ...prev,
        { sender: 'assistant', text: `AI Notice: ${msg}. Check API configuration.` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 lg:right-28 z-40 w-12 h-12 rounded-full clay-card bg-gradient-to-tr from-indigo-500 to-pink-500 text-white flex items-center justify-center shadow-2xl cursor-pointer"
        title="Open AI Database Assistant"
        aria-label="Open AI Assistant"
      >
        <Sparkles size={20} />
      </motion.button>

      {/* Floating Chat Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="fixed bottom-20 right-6 z-50 w-80 sm:w-96 clay-card p-4 bg-white/95 dark:bg-slate-900/95 shadow-2xl rounded-3xl border border-clay-border flex flex-col h-[450px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-clay-border">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-pink-400 to-indigo-500 text-white flex items-center justify-center">
                  <Bot size={15} />
                </div>
                <div>
                  <h4 className="font-display font-bold text-xs text-clay-text">AI Database Assistant</h4>
                  <span className="text-[10px] text-emerald-500 font-bold">● Active 3NF Context</span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-clay-text-muted hover:text-clay-text p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                      m.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-pink-500 text-white'
                    }`}
                  >
                    {m.sender === 'user' ? <User size={12} /> : <Bot size={12} />}
                  </div>
                  <div
                    className={`p-2.5 rounded-2xl max-w-[80%] leading-relaxed ${
                      m.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-clay-text rounded-tl-xs whitespace-pre-line'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="text-[11px] text-clay-text-muted italic flex items-center gap-1">
                  <Sparkles size={12} className="animate-spin text-indigo-500" />
                  Gemini is querying schema context...
                </div>
              )}
            </div>

            {/* Input */}
            <div className="pt-2 border-t border-clay-border flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask about tables, stock, or viva..."
                className="clay-input flex-1 text-xs py-2 px-3"
              />
              <ClayButton variant="primary" size="sm" onClick={handleSend} disabled={isLoading || !input.trim()}>
                <Send size={12} />
              </ClayButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
