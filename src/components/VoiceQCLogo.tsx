
import React from 'react';

interface VoiceQCLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const VoiceQCLogo: React.FC<VoiceQCLogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-6 w-auto',
    md: 'h-8 w-auto', 
    lg: 'h-12 w-auto'
  };

  return (
    <img 
      src="/lovable-uploads/de6310b0-e236-4f5d-92e4-d908b970f9d8.png" 
      alt="VoiceQC" 
      className={`${sizeClasses[size]} ${className}`}
    />
  );
};

export default VoiceQCLogo;
