// 📁 utils/toolSizes.js
export const STANDARD_SIZES = {
  pencil: {
    min: 1,
    max: 20,
    multiplier: 1, // Używamy bezpośredniej wartości z suwaka
    getDisplaySize: (baseSize) => Math.max(1, baseSize - 2) // 1-18
  },
  brush: {
    min: 1,
    max: 20, 
    multiplier: 1,
    getDisplaySize: (baseSize) => baseSize + 10 // 11-30
  },
  eraser: {
    min: 1,
    max: 20,
    multiplier: 1,
    getDisplaySize: (baseSize) => baseSize + 30 // 31-50
  }
};

export const getStandardizedSize = (tool, localSize) => {
  const config = STANDARD_SIZES[tool] || STANDARD_SIZES.pencil;
  
  // Normalizuj do zakresu 1-20 (zakres suwaka)
  const normalized = Math.max(config.min, Math.min(config.max, localSize));
  return normalized; // Zwracamy wartość suwaka (1-20), nie zmienioną
};

export const getDisplaySize = (tool, baseSize) => {
  const config = STANDARD_SIZES[tool] || STANDARD_SIZES.pencil;
  return config.getDisplaySize ? config.getDisplaySize(baseSize) : baseSize;
};

export const getToolEffects = (tool) => {
  const effects = {
    pencil: { shadowBlur: 0, lineCap: 'round', lineJoin: 'round' },
    brush: { shadowBlur: 0, lineCap: 'round', lineJoin: 'round' },
    eraser: { shadowBlur: 0, lineCap: 'round', lineJoin: 'round' }
  };
  return effects[tool] || effects.pencil;
};