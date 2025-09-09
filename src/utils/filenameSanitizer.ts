// Filename sanitization utility for non-ASCII characters
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'file';
  
  // Split name and extension
  const lastDotIndex = filename.lastIndexOf('.');
  const name = lastDotIndex > 0 ? filename.slice(0, lastDotIndex) : filename;
  const extension = lastDotIndex > 0 ? filename.slice(lastDotIndex) : '';
  
  // Use built-in normalization and replace non-ASCII characters
  let sanitizedName = name
    // Normalize Unicode characters
    .normalize('NFD')
    // Remove diacritical marks
    .replace(/[\u0300-\u036f]/g, '')
    // Manual replacements for specific characters
    .replace(/[АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя]/g, (char) => {
      const cyrillicMap: Record<string, string> = {
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E', 'Ж': 'Zh',
        'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
        'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
        'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
        'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
        'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
        'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
      };
      return cyrillicMap[char] || char;
    })
    // Replace Polish characters
    .replace(/[ĄĆĘŁŃÓŚŹŻąćęłńóśźż]/g, (char) => {
      const polishMap: Record<string, string> = {
        'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
        'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z'
      };
      return polishMap[char] || char;
    })
    // Replace German characters
    .replace(/[ÄÖÜäöüß]/g, (char) => {
      const germanMap: Record<string, string> = {
        'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue', 'ß': 'ss',
        'ä': 'ae', 'ö': 'oe', 'ü': 'ue'
      };
      return germanMap[char] || char;
    })
    // Replace spaces and common unsafe characters with underscores
    .replace(/[\s\-\+\=\(\)\[\]\{\}\|\\\/\:;\*\?\"\<\>\,]/g, '_')
    // Remove any remaining non-ASCII characters
    .replace(/[^\x00-\x7F]/g, '')
    // Remove multiple consecutive underscores
    .replace(/_+/g, '_')
    // Remove leading/trailing underscores
    .replace(/^_+|_+$/g, '')
    // Ensure it's not empty
    || 'file';
  
  // Limit length to prevent overly long filenames
  if (sanitizedName.length > 50) {
    sanitizedName = sanitizedName.substring(0, 50);
  }
  
  return sanitizedName + extension;
}

export function createSafeFilenameWithMetadata(
  originalFilename: string,
  prefix: string = ''
): { filename: string; metadata: { originalName: string } } {
  const sanitizedFilename = prefix + sanitizeFilename(originalFilename);
  
  return {
    filename: sanitizedFilename,
    metadata: {
      originalName: originalFilename
    }
  };
}