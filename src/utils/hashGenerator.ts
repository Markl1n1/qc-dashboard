
export const generateHash = (length: number = 6): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const formatUploadDate = (date: Date = new Date()): string => {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
};

export const generateFileName = (agentName: string, originalFileName: string): string => {
  const date = formatUploadDate();
  const hash = generateHash(6);
  const extension = originalFileName.split('.').pop() || '';
  return `${agentName}_${date}_${hash}.${extension}`;
};
