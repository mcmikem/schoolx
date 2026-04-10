"use client";

import { useMemo } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { format, differenceInDays, startOfMonth, addMonths, isWithinInterval } from "date-fns";

interface Event {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  event_type: string;
}

export default function TermTimeline({ events }: { events: Event[] }) {
  // Assume a term is roughly 3-4 months. Let's find the range from events or current month
  const timelineRange = useMemo(() => {
    const today = new Date();
    const start = startOfMonth(today);
    const end = addMonths(start, 4);
    return { start, end };
  }, []);

  const totalDays = differenceInDays(timelineRange.end, timelineRange.start);

  const getPosition = (dateStr: string) => {
    const date = new Date(dateStr);
    const diff = differenceInDays(date, timelineRange.start);
    return (diff / totalDays) * 100;
  };

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [events]);

  return (
    <div className="relative py-20 px-4 overflow-x-auto custom-scrollbar">
      {/* The Main Line */}
      <div className="h-1.5 bg-slate-200 w-full absolute top-1/2 -translate-y-1/2 rounded-full" />
      
      {/* Current Day Indicator */}
      <div 
        className="absolute top-[40%] bottom-[40%] w-0.5 bg-primary-500 z-10 before:content-['TODAY'] before:absolute before:-top-6 before:-left-4 before:text-[9px] before:font-black before:text-primary-600"
        style={{ left: `${getPosition(new Date().toISOString())}%` }}
      />

      {/* Month Markers */}
      <div className="absolute top-1/2 left-0 w-full flex justify-between px-2 -translate-y-1/2 translate-y-4">
        {[0, 1, 2, 3, 4].map(m => {
          const date = addMonths(timelineRange.start, m);
          return (
             <div key={m} style={{ left: `${(m / 4) * 100}%` }} className="absolute">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(date, 'MMM')}</p>
             </div>
          );
        })}
      </div>

      {/* Events */}
      <div className="relative h-48">
        {sortedEvents.map((event, i) => {
          const pos = getPosition(event.start_date);
          if (pos < 0 || pos > 100) return null;

          const isTop = i % 2 === 0;
          const colorClass = event.event_type === 'exam' ? 'bg-red-500' : event.event_type === 'holiday' ? 'bg-emerald-500' : 'bg-primary-500';

          return (
            <div 
              key={event.id}
              className="absolute"
              style={{ left: `${pos}%` }}
            >
              {/* Connector */}
              <div className={`w-0.5 h-12 bg-slate-200 absolute left-1/2 -translate-x-1/2 ${isTop ? '-top-12' : 'top-0'}`} />
              
              {/* Dot */}
              <div className={`w-4 h-4 rounded-full border-4 border-white shadow-sm ring-4 ring-slate-50 absolute top-[-8px] left-1/2 -translate-x-1/2 z-20 ${colorClass}`} />

              {/* Box */}
              <div className={`absolute left-1/2 -translate-x-1/2 w-40 p-3 bg-white rounded-2xl shadow-xl border border-slate-100 z-30 transition-all hover:scale-105 hover:z-50 ${isTop ? '-top-32' : 'top-12'}`}>
                <div className="flex items-center gap-2 mb-1">
                   <span className={`w-1.5 h-1.5 rounded-full ${colorClass}`} />
                   <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest font-mono">{format(new Date(event.start_date), 'MMM dd')}</p>
                </div>
                <p className="text-[11px] font-bold text-slate-800 leading-tight">{event.title}</p>
                {event.description && <p className="text-[9px] text-slate-400 mt-1 line-clamp-1 italic">{event.description}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
