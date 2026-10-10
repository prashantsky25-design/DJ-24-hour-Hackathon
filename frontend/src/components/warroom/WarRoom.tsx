import React, { useRef, useEffect } from 'react';
import { AgentDiscussionMessage } from '../../types/discussion';
import { Users, Bot, Shield, FileText, CheckCircle, Search, Edit3 } from 'lucide-react';

interface WarRoomProps {
  discussions: AgentDiscussionMessage[];
}

const getRoleColor = (role: string) => {
  const r = role.toLowerCase();
  if (r.includes('planner')) return '#3b82f6'; // Blue
  if (r.includes('researcher')) return '#10b981'; // Green
  if (r.includes('critic')) return '#ef4444'; // Red
  if (r.includes('drafter')) return '#f59e0b'; // Yellow
  if (r.includes('analyst')) return '#8b5cf6'; // Purple
  return '#6b7280'; // Gray
};

const getRoleIcon = (role: string) => {
  const r = role.toLowerCase();
  if (r.includes('planner')) return <Bot className="w-4 h-4" />;
  if (r.includes('researcher')) return <Search className="w-4 h-4" />;
  if (r.includes('critic')) return <Shield className="w-4 h-4" />;
  if (r.includes('drafter')) return <Edit3 className="w-4 h-4" />;
  if (r.includes('analyst')) return <FileText className="w-4 h-4" />;
  return <Users className="w-4 h-4" />;
};

export const WarRoom: React.FC<WarRoomProps> = ({ discussions }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [discussions]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-neutral-900 rounded-xl border shadow-sm" style={{ borderColor: 'var(--border)' }}>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Agent War Room</h2>
        </div>
        <div className="text-xs text-neutral-500 font-medium">
          {discussions.length} messages
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5">
        {discussions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-neutral-500 space-y-3">
            <Users className="w-10 h-10 opacity-20" />
            <p className="text-sm">Agents are waiting for a task...</p>
          </div>
        ) : (
          discussions.map((msg) => (
            <div key={msg.id} className="flex gap-3 max-w-full">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm"
                style={{ backgroundColor: `${getRoleColor(msg.agent_role)}15`, color: getRoleColor(msg.agent_role) }}
              >
                {getRoleIcon(msg.agent_role)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {msg.agent_name}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${getRoleColor(msg.agent_role)}15`, color: getRoleColor(msg.agent_role) }}>
                    {msg.agent_role}
                  </span>
                  <span className="text-[11px] text-neutral-500 ml-auto font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div 
                  className="text-[13px] px-3.5 py-2.5 rounded-lg leading-relaxed whitespace-pre-wrap shadow-sm border"
                  style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                >
                  {msg.content}
                </div>
                {msg.confidence && (
                  <div className="mt-1.5 text-[10px] text-neutral-500 flex items-center gap-1 font-medium pl-1">
                    <CheckCircle className="w-3 h-3" style={{ color: getRoleColor(msg.agent_role) }} />
                    Confidence: {(msg.confidence * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

