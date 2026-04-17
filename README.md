This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Visual Provider Selection (AI Interviews)

The AI Interview environment defaults to a high-performance **Animated Orb** (`VISUAL_MODE=orb`).
To switch to a premium live video avatar, set the `VISUAL_MODE` environment variable and provide the corresponding API key. 

### Supported Modes:

1. **Orb Visual (Default, Free, Zero-latency)**
   ```env
   VISUAL_MODE=orb
   # No keys required.
   ```

2. **Tavus (Live WebRTC Video Avatar)**
   ```env
   VISUAL_MODE=tavus
   TAVUS_API_KEY=your_key
   TAVUS_PERSONA_ID=your_persona_id
   ```

3. **D-ID (REST-based Video Avatar)**
   ```env
   VISUAL_MODE=did
   DID_API_KEY=your_key
   ```

4. **Simli (WebRTC Video Avatar)**
   ```env
   VISUAL_MODE=simli
   SIMLI_API_KEY=your_key
   SIMLI_FACE_ID=your_face_id
   ```

To apply changes, update the environment variable in Vercel or `.env` and restart the application/redeploy.
