import React from 'react';

interface SectionSeparatorProps {
  label?: string;
  className?: string;
  opaque?: boolean;
}

/**
 * SectionSeparator establishes clean visual boundaries between content areas
 * using subtle hairline design tokens (#E6E1D8) and opaque background masking.
 */
export const SectionSeparator: React.FC<SectionSeparatorProps> = ({
  label,
  className = '',
  opaque = true
}) => {
  return (
    <div
      className={`relative z-20 w-full py-3 flex items-center justify-center ${
        opaque ? 'bg-[#F8F7F4]' : ''
      } ${className}`}
    >
      <div className="w-full border-t border-[#E6E1D8] relative flex items-center justify-center">
        {label && (
          <span className="absolute bg-[#F8F7F4] px-4 text-[10px] font-mono text-[#6B6760] uppercase tracking-widest border border-[#E6E1D8] rounded-full py-0.5 shadow-2xs font-bold">
            {label}
          </span>
        )}
      </div>
    </div>
  );
};

export default SectionSeparator;
