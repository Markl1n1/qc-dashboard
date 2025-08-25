
import React from 'react';

interface VoiceQCLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

const VoiceQCLogo: React.FC<VoiceQCLogoProps> = ({ size = 'md', showText = true }) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl'
  };

  return (
    <div className="flex items-center space-x-2">
      <img 
        src="/VoiceQC-icon.png" 
        alt="VoiceQC Logo" 
        className={sizeClasses[size]}
      />
      {showText && (
        <span className={`${textSizes[size]} font-bold text-primary`}>
          VoiceQC
        </span>
      )}
    </div>
  );
};

export default VoiceQCLogo;
