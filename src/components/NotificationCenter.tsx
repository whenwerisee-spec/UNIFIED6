import React, { useState } from 'react';
import { Bell, ShieldAlert, CheckCircle2, Zap, X, Clock, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface AppNotification {
  id: string;
  type: 'security' | 'transaction' | 'system';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  link?: string;
}

interface NotificationCenterProps {
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onClearAll: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkRead,
  onClearAll
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full border border-slate-900" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Sovereign Notifications</h4>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-black">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <button
                  onClick={onClearAll}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-300 transition uppercase"
                >
                  Clear All
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/50">
                {notifications.length > 0 ? (
                  notifications.map(notif => (
                    <div
                      key={notif.id}
                      className={`p-4 hover:bg-slate-800/40 transition cursor-pointer relative group ${notif.read ? 'opacity-60' : ''}`}
                      onClick={() => onMarkRead(notif.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          notif.type === 'security' ? 'bg-rose-500/10 text-rose-400' :
                          notif.type === 'transaction' ? 'bg-emerald-500/10 text-emerald-400' :
                          'bg-indigo-500/10 text-indigo-400'
                        }`}>
                          {notif.type === 'security' ? <ShieldAlert className="w-3.5 h-3.5" /> :
                           notif.type === 'transaction' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                           <Zap className="w-3.5 h-3.5" />}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-100">{notif.title}</p>
                          <p className="text-[10px] text-slate-400 leading-relaxed">{notif.message}</p>
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[9px] text-slate-500 font-medium flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {notif.link && (
                              <a
                                href={notif.link}
                                target="_blank"
                                className="text-[9px] text-indigo-400 hover:underline flex items-center gap-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      {!notif.read && (
                        <div className="absolute top-4 right-4 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center space-y-3">
                    <Bell className="w-8 h-8 text-slate-800 mx-auto" />
                    <p className="text-xs text-slate-500 font-medium">All clear! No new alerts detected.</p>
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-3 bg-slate-950/40 border-t border-slate-800 text-center">
                  <p className="text-[9px] text-slate-500 font-mono italic">Sovereign Watchtower Monitoring Active</p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
