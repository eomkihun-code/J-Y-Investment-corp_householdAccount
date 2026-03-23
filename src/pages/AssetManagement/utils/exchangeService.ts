const FALLBACK_RATE = 1350;

/**
 * Fetches the current USD to KRW exchange rate.
 * Uses a public API with a fallback in case of errors.
 */
export const getExchangeRate = async (): Promise<number> => {
  try {
    // Using a free API (v6.exchangerate-api.com) for demonstration. 
    // In production, you might want to use a more stable/paid one.
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await response.json();
    
    if (data && data.rates && data.rates.KRW) {
      console.log('Successfully fetched real-time exchange rate:', data.rates.KRW);
      return data.rates.KRW;
    }
    
    throw new Error('Could not find KRW rate in API response');
  } catch (error) {
    console.warn('Failed to fetch real-time exchange rate, using fallback:', error);
    return FALLBACK_RATE;
  }
};
