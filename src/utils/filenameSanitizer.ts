// Filename sanitization utility for non-ASCII characters
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'file';
  
  // Split name and extension
  const lastDotIndex = filename.lastIndexOf('.');
  const name = lastDotIndex > 0 ? filename.slice(0, lastDotIndex) : filename;
  const extension = lastDotIndex > 0 ? filename.slice(lastDotIndex) : '';
  
  // Transliteration map for various languages
  const transliterationMap: Record<string, string> = {
    // Cyrillic (Russian/Ukrainian)
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E', 'Ж': 'Zh',
    'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
    'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
    'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    
    // Ukrainian specific
    'Ґ': 'G', 'Є': 'Ye', 'І': 'I', 'Ї': 'Yi',
    'ґ': 'g', 'є': 'ye', 'і': 'i', 'ї': 'yi',
    
    // Polish
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    
    // German
    'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue', 'ß': 'ss',
    'ä': 'ae', 'ö': 'oe', 'ü': 'ue',
    
    // French
    'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ç': 'C', 'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
    'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I', 'Ñ': 'N', 'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O',
    'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ý': 'Y',
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ý': 'y', 'ÿ': 'y',
    
    // Spanish
    'Ñ': 'N', 'ñ': 'n',
    
    // Italian
    'À': 'A', 'È': 'E', 'É': 'E', 'Ì': 'I', 'Í': 'I', 'Ò': 'O', 'Ó': 'O', 'Ù': 'U', 'Ú': 'U',
    'à': 'a', 'è': 'e', 'é': 'e', 'ì': 'i', 'í': 'i', 'ò': 'o', 'ó': 'o', 'ù': 'u', 'ú': 'u',
    
    // Swedish
    'Å': 'A', 'Ä': 'A', 'Ö': 'O',
    'å': 'a', 'ä': 'a', 'ö': 'o'
  };
  
  // Apply transliteration
  let sanitizedName = name;
  for (const [original, replacement] of Object.entries(transliterationMap)) {
    sanitizedName = sanitizedName.replace(new RegExp(original, 'g'), replacement);
  }
  
  // Remove or replace remaining non-ASCII characters and unsafe characters
  sanitizedName = sanitizedName
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