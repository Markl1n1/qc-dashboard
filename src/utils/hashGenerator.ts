
export const generateHash = (length: number = 6): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const formatDateForFilename = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const generateFileName = (agentName: string, originalName?: string): string => {
  const date = formatDateForFilename();
  const hash = generateHash(6);
  const extension = originalName ? originalName.split('.').pop() : 'mp3';
  return `${agentName}_${date}_${hash}.${extension}`;
};
