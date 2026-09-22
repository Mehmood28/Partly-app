export const isWhiteComponent = (name: string): boolean => {
  if (!name) return false;
  const upper = name.toUpperCase();
  return upper.includes('WHITE') || 
         upper.includes('SNOW') || 
         upper.includes('SILVER') || 
         upper.includes('STEEL LEGEND') || 
         upper.includes('A-GAMING') || 
         upper.includes(' ICE') || 
         upper.includes('AERO') || 
         upper.includes('VISION');
};

export const isColorCompatible = (category: string, part: { name: string }, theme: 'white' | 'black' | 'any'): boolean => {
  if (theme === 'any') return true;
  const isWhite = isWhiteComponent(part.name);
  
  if (category === 'CPU' || category === 'Storage') return true; // Color doesn't matter
  
  if (theme === 'white') {
    return isWhite;
  } else {
    return !isWhite;
  }
};
