export const LIVEKIT_CONFIG = {
  url: process.env.NEXT_PUBLIC_LIVEKIT_URL || "",
  apiKey: process.env.LIVEKIT_API_KEY || "",
  apiSecret: process.env.LIVEKIT_API_SECRET || "",
};

export const hasLiveKitConfig = () => {
  return Boolean(
    LIVEKIT_CONFIG.url && 
    LIVEKIT_CONFIG.apiKey && 
    LIVEKIT_CONFIG.apiSecret && 
    !LIVEKIT_CONFIG.url.includes("placeholder")
  );
};
