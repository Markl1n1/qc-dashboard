
import React from 'react';
import { Mic, CheckCircle } from 'lucide-react';

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
      <div className="relative">
        <Mic className={`${sizeClasses[size]} text-primary`} />
        <CheckCircle className={`${sizeClasses[size]} text-green-500 absolute -top-1 -right-1 ${size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-6 w-6'}`} />
      </div>
      {showText && (
        <span className={`${textSizes[size]} font-bold text-primary`}>
          VoiceQC
        </span>
      )}
    </div>
  );
};

export default VoiceQCLogo;
