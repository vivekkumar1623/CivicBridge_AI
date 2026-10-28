import React from 'react';

export const PrototypeBanner: React.FC = () => {
  return (
    <aside
      aria-label="Prototype Notice"
      className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs md:text-sm text-amber-900"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded font-semibold text-[11px] bg-amber-500/20 text-amber-900 tracking-wider uppercase">
            Prototype
          </span>
          <span>
            This report system is a campus/neighbourhood pilot. It is <strong>not automatically sent</strong> to a municipal authority. For immediate danger or emergencies, contact local emergency services directly.
          </span>
        </div>
      </div>
    </aside>
  );
};
