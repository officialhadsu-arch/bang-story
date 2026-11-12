# NOTICE

This repository is a fork of [bang-story](https://github.com/bangtutorial/bang-story)
by bangtutorial, licensed under the MIT License (see LICENSE).

## Third-party components

- **Bang Story** — the upstream application this fork is based on.
  MIT License, Copyright (c) bangtutorial. See LICENSE.
- **bang-motion** — agent skill by bangtutorial, used as the motion-graphics
  engine (vendored into the motion harness, not a code dependency).
  MIT License.
- **flow2api** — self-hosted OpenAI-compatible server by TheSmallHanCat that
  drives Google Flow (Nano Banana, Veo, Omni) with the user's own Google
  account. KenStory talks to a server the user runs (tier 1, 0.3+); no flow2api
  code is vendored into this repository.
  MIT License, https://github.com/TheSmallHanCat/flow2api
- **De-Story** — Bang Story derivative by ikrammf7 whose Flow2API client
  (`flow2api.rs`) was studied as the pattern for KenStory's own Flow2API
  client (`src/main/services/flow2api.ts`, rewritten in TypeScript; no code
  copied). De-Story is published without a LICENSE file, so only its patterns
  were adopted, never its code.
  https://github.com/ikrammf7/de-story
- **GSAP** — GreenSock Animation Platform, used by the motion renderer.
  Standard "No Charge" License, effective 30 April 2025.
  Note on the Prohibited Uses clause: "Tidak tampak masuk: larangan punya
  dua syarat kumulatif (tanpa kode DAN bersaing dengan builder animasi
  visual Webflow); produk kita alat video faceless, bukan builder web.
  Interpretasi tidak pasti; perlu pemeriksaan bila dirilis."
