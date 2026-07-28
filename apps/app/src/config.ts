// App feature flags — one place to hold/enable optional features.
//
// ============================================================================
//  THE РЕНДЕР STEP SHIPS. THE AI INSIDE IT DOES NOT.
//
//  The step itself (screens/RenderScreen.tsx) is a permanent part of the journey
//  now: a high-quality 3D render of the finished kitchen — sun dial, light moods,
//  open the doors, take a 2K snapshot to hand a client. It needs no flag and no
//  API key. It is just the 3D scene, finally given the time to look good.
//
//  AI_RENDER gates only the kie.ai photoreal pass ON that screen, which wears a
//  «Скоро» badge until this flips. It gates two things:
//    • the «AI-рендер» button doing anything (screens/RenderScreen.tsx)
//    • the kie.ai key being READ AT ALL (model/render.ts) — with the flag off,
//      `import.meta.env.VITE_KIE_API_KEY` folds to undefined and the bundler drops
//      the inline, so the key never reaches the client bundle.
//
//  ⚠️ .env.local still holds a live VITE_KIE_API_KEY. Flipping this to `true` WILL
//     ship it to every user. Before you do, move the call behind a Supabase Edge
//     Function so the key stays server-side, and re-add the kie.ai processor
//     paragraph to public/privacy.html.
// ============================================================================
export const AI_RENDER = false;
