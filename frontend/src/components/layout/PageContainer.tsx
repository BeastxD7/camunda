import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Wrapper component for consistent page layout and spacing
 * Uses the support-shell background for atmospheric aesthetics
 */
export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`support-shell min-h-screen px-4 py-6 md:px-8 ${className}`}>
      <div className="mx-auto max-w-[1400px]">
        {children}
      </div>
    </div>
  );
};
