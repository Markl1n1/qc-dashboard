
/**
 * Extracts username from email address
 * @param email - Full email address
 * @returns Username portion (before @) or full email if no @ found
 */
export const extractUsernameFromEmail = (email: string): string => {
  if (!email) return '';
  
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return email;
  
  return email.substring(0, atIndex);
};

/**
 * Capitalizes the first letter of a status string
 * @param status - Status string to capitalize
 * @returns Capitalized status string
 */
export const capitalizeStatus = (status: string): string => {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};
