
export const getAudioDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    
    audio.addEventListener('loadedmetadata', () => {
      const durationMinutes = audio.duration / 60;
      resolve(durationMinutes);
    });
    
    audio.addEventListener('error', () => {
      reject(new Error('Failed to load audio metadata'));
    });
    
    audio.src = URL.createObjectURL(file);
  });
};
