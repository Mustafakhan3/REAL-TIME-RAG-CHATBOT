// services/serperService.js
import axios from 'axios';

// Base Serper call with safe defaults
const fetchFromSerper = async (endpoint, query) => {
  if (!query || typeof query !== 'string') return null;
  try {
    const response = await axios.post(
      `https://google.serper.dev/${endpoint}`,
      { q: query },
      {
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
        validateStatus: (s) => s >= 200 && s < 500,
      }
    );
    if (response.status >= 400) {
      console.error(`❌ Serper ${endpoint} status ${response.status}:`, response.data);
      return null;
    }
    return response.data;
  } catch (error) {
    console.error(`❌ Error fetching from Serper (${endpoint}):`, error.message);
    return null;
  }
};

export const fetchWebResults = async (query) => {
  return await fetchFromSerper('search', query);
};

export const fetchNewsResults = async (query) => {
  return await fetchFromSerper('news', query);
};
