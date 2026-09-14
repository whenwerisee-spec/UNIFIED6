import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, Sparkles, User, RefreshCw, MessageSquare, ArrowRight } from 'lucide-react';
import { ChatMessage } from '../types';

interface AiChatAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

const SUGGESTED_PROMPTS = [
  'Analyze current BTC & ETH macro market structure',
  'How does Dollar-Cost Averaging (DCA) reduce risk?',
  'What are the tax implications of crypto staking yields?',
  'Explain Base Layer-2 blob gas vs Ethereum L1',
  'Should I rebalance into stablecoins during high fear?'
];

export default function AiChatAssistant({
  isOpen,
  onClose,
  showToast
}: AiChatAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: 'msg-init',
        role: 'assistant',
        content:
          'Welcome to Coinbase Intelligence! I am your AI Market Strategist powered by Gemini. Ask me anything about cryptocurrency market trends, token tokenomics, staking yields, portfolio diversification, or tax efficiency.',
        timestamp: Date.now()
      }
    ];
  });

  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now()
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputValue('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: newHistory.map((m) => ({ role: m.role, content: m.content }))
        })
      });

      const data = await res.json();
      const replyContent = data.reply || 'Market analysis completed.';

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-ai-${Date.now()}`,
          role: 'assistant',
          content: replyContent,
          timestamp: Date.now()
        }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          role: 'assistant',
          content:
            'Coinbase Intelligence analyzes that current macro signals favor disciplined DCA and prudent risk management. Ethereum and Bitcoin institutional ETF inflows remain supportive over multi-month timeframes.',
          timestamp: Date.now()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-2xs transition-opacity">
      <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col border-l border-gray-200">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-[#0052FF]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                Coinbase AI Strategist
                <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-[#0052FF]">
                  Gemini 2.5
                </span>
              </h3>
              <p className="text-xs text-gray-400">Institutional Market & Blockchain Intelligence</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages scroll area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/40">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-[#0052FF] text-white flex items-center justify-center text-xs shrink-0 mt-0.5 shadow-2xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`p-3.5 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[#0052FF] text-white rounded-br-xs shadow-2xs'
                    : 'bg-white border border-gray-200/80 text-gray-800 rounded-bl-xs shadow-2xs'
                }`}
              >
                {m.content}
              </div>

              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start items-center text-xs text-gray-400">
              <div className="w-8 h-8 rounded-full bg-[#0052FF] text-white flex items-center justify-center text-xs shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-bl-xs shadow-2xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce delay-150" />
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce delay-300" />
                <span className="text-gray-500 text-xs ml-1">Analyzing blockchain data...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts */}
        <div className="p-3 border-t border-gray-100 bg-white">
          <div className="text-2xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Suggested Prompts
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSendMessage(prompt)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-gray-100 hover:bg-blue-50 hover:text-[#0052FF] text-gray-600 text-xs font-medium transition-colors cursor-pointer shrink-0"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input box */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask about crypto markets, DCA, staking, or gas..."
              className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0052FF] focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || loading}
              className={`p-2.5 rounded-xl bg-[#0052FF] text-white transition-colors cursor-pointer shrink-0 ${
                !inputValue.trim() || loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="text-2xs text-gray-400 text-center mt-2">
            AI responses are informational and not financial advice.
          </div>
        </div>
      </div>
    </div>
  );
}
