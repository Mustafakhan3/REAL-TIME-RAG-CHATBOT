import axios from "axios";

// 🔹 Base function for all Serper requests
const fetchFromSerper = async (endpoint, query) => {
  try {
    const response = await axios.post(
      `https://google.serper.dev/${endpoint}`,
      { q: query },
      {
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error(`❌ Error fetching from Serper (${endpoint}):`, error.message);
    return null;
  }
};

// 🔹 Normal web search
export const fetchWebResults = async (query) => {
  return await fetchFromSerper("search", query);
};

// 🔹 News search (for real-time headlines)
export const fetchNewsResults = async (query) => {
  return await fetchFromSerper("news", query);
};
