import React, { useState } from 'react';
import { 
  Mail, X, Minimize2, Maximize2, Send, CheckCircle2, ShieldAlert, 
  ChevronRight, Landmark, ArrowRight, RefreshCw, Key, ShieldCheck 
} from 'lucide-react';

export interface InboxEmail {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  timestamp: number;
  bodyHtml: string;
  isRead: boolean;
  actionRequired?: boolean;
  actionType?: 'verify_email' | 'approve_transfer' | 'confirm_2fa';
  actionPayload?: any;
}

interface EmailInboxProps {
  emails: InboxEmail[];
  onReadEmail: (id: string) => void;
  onConfirmAction: (actionType: string, payload: any) => void;
  userEmail?: string;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function EmailInbox({
  emails,
  onReadEmail,
  onConfirmAction,
  userEmail,
  isOpen,
  setIsOpen
}: EmailInboxProps) {
  const [selectedEmail, setSelectedEmail] = useState<InboxEmail | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const inboxEmail = userEmail || 'account@secure.local';

  const htmlToSafeText = (html: string) => {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const unreadCount = emails.filter(e => !e.isRead).length;

  const handleSelectEmail = (email: InboxEmail) => {
    setSelectedEmail(email);
    onReadEmail(email.id);
  };

  const handleActionClick = (actionType: string, payload: any) => {
    onConfirmAction(actionType, payload);
    // Add success indication or close
    if (selectedEmail) {
      setSelectedEmail({
        ...selectedEmail,
        actionRequired: false
      });
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-40 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center space-x-2.5 transition-all animate-bounce cursor-pointer group"
        id="email-client-fob"
      >
        <div className="relative">
          <Mail className="h-5 w-5 text-[#0052FF]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center text-white border-2 border-slate-900 animate-pulse">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="text-left text-xs">
          <span className="font-bold block text-[11px] text-gray-100">Email Inbox</span>
          <p className="text-[9px] text-gray-400">{inboxEmail}</p>
        </div>
      </button>
    );
  }

  return (
    <div 
      className={`fixed bottom-6 left-6 z-40 bg-white border border-gray-200 rounded-2xl shadow-2xl transition-all duration-300 flex flex-col overflow-hidden max-w-sm sm:max-w-md w-[380px] sm:w-[450px] ${
        isMinimized ? 'h-14' : 'h-[480px]'
      }`}
      id="email-client-drawer"
    >
      {/* Header Bar */}
      <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between select-none shrink-0 border-b border-white/5">
        <div className="flex items-center space-x-2.5">
          <div className="p-1 bg-[#0052FF]/10 text-[#0052FF] rounded-lg">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <span className="text-xs font-bold block">Secure Message Center</span>
            <p className="text-[9px] text-gray-400">Monitoring inbox for: <span className="text-blue-400 font-mono">{inboxEmail}</span></p>
          </div>
        </div>
        
        <div className="flex items-center space-x-1.5">
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </button>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
          {selectedEmail ? (
            /* Email Detail Screen */
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
              
              {/* Back Bar */}
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between shrink-0 text-xs">
                <button 
                  onClick={() => setSelectedEmail(null)}
                  className="text-xs text-[#0052FF] hover:underline font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <span>← Back to Inbox</span>
                </button>
                <span className="text-[9px] text-gray-400 font-mono">
                  {new Date(selectedEmail.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Email Envelope Header */}
              <div className="p-4 border-b border-gray-100 space-y-2 shrink-0">
                <h3 className="text-sm font-extrabold text-gray-900 leading-tight">
                  {selectedEmail.subject}
                </h3>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-800">{selectedEmail.sender}</span>
                    <span className="text-[10px] text-gray-400 block font-mono">&lt;{selectedEmail.senderEmail}&gt;</span>
                  </div>
                  <span className="text-[10px] text-gray-400">to: me</span>
                </div>
              </div>

              {/* Email Content Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* Embedded HTML Body */}
                <div className="text-xs text-gray-700 leading-relaxed font-sans whitespace-pre-wrap">
                  {htmlToSafeText(selectedEmail.bodyHtml)}
                </div>

                {/* Secure authorization request */}
                {selectedEmail.actionRequired && (
                  <div className="p-4 bg-amber-50 rounded-xl border border-dashed border-amber-400 space-y-3">
                    <span className="text-[10px] font-bold text-amber-700 block uppercase tracking-wider">Secure Authorization Portal</span>
                    <p className="text-[11px] text-amber-900 font-medium">
                      This action requires direct confirmation to satisfy compliance and authorization requirements.
                    </p>
                    <button
                      onClick={() => handleActionClick(selectedEmail.actionType!, selectedEmail.actionPayload)}
                      className="w-full py-2 bg-[#0052FF] hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg shadow-sm cursor-pointer flex items-center justify-center space-x-1"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Confirm Secure Action</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-gray-50 border-t border-gray-100 shrink-0 text-center text-[10px] text-gray-400">
                🔒 Protected by end-to-end TLS and signed message verification.
              </div>
            </div>
          ) : (
            /* Email List Screen */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 bg-white border-b border-gray-150 flex items-center justify-between shrink-0 text-xs">
                <span className="font-bold text-gray-700">Inbox ({inboxEmail})</span>
                <span className="text-[10px] text-gray-400 font-mono font-bold">
                  {unreadCount} Unread Emails
                </span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                {emails.map((email) => (
                  <button
                    key={email.id}
                    onClick={() => handleSelectEmail(email)}
                    className={`w-full p-4 flex items-start space-x-3 text-left transition-all cursor-pointer ${
                      email.isRead ? 'bg-white' : 'bg-[#0052FF]/5 border-l-4 border-[#0052FF]'
                    } hover:bg-gray-50`}
                  >
                    <div className="shrink-0 mt-0.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${email.isRead ? 'bg-transparent' : 'bg-[#0052FF]'}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs truncate ${email.isRead ? 'text-gray-600 font-semibold' : 'text-gray-900 font-bold'}`}>
                          {email.sender}
                        </span>
                        <span className="text-[9px] text-gray-400 font-mono">
                          {new Date(email.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      <p className={`text-xs truncate mt-0.5 ${email.isRead ? 'text-gray-800' : 'text-gray-900 font-bold'}`}>
                        {email.subject}
                      </p>
                      
                      <div className="flex items-center space-x-1.5 mt-1">
                        {email.actionRequired && (
                          <span className="text-[8px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full uppercase">
                            Action Pending
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 truncate block">
                                  Open receipt/alert...
                        </span>
                      </div>
                    </div>
                  </button>
                ))}

                {emails.length === 0 && (
                  <div className="py-24 text-center space-y-3">
                    <Mail className="h-8 w-8 text-gray-300 mx-auto" />
                    <div>
                      <span className="text-xs font-bold text-gray-400">Your inbox is empty</span>
                      <p className="text-[10px] text-gray-400 mt-1">Sign up, trade, or transfer to receive emails.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
