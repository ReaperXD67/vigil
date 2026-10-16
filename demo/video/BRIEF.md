---
workflow: general-video
flow: automation
storyboard: no
message: "Vigil connects a useful reliability product to a verifiable, cost-conscious DevSecOps delivery path."
destination: GitHub submission
aspect: 1920x1080
language: en
length: 6–9 minutes, driven by narration and evidence
---

## Intent

A clear technical walkthrough for the DevSecOps capstone grader. Present the supplied deck first, then show the codebase, a real push and its complete Actions run, infrastructure evidence, ArgoCD, Kubernetes, Prometheus and Grafana, in the submission's specified order. The user delegates creative decisions and authorizes AtlasForge or an original local video pipeline.

## Production

Use the existing Vigil palette, actual screen recordings and original slide exports. Local Windows speech synthesis provides disclosed synthetic narration; matching captions make the evidence understandable without audio. Python and FFmpeg assemble deterministic scenes, using the local rendering and ffprobe-verification approach reviewed in AtlasForge AI at revision `1eb58335d0d26f2138d3035ff3a5074a7916053e`. No paid models, remote TTS, stock footage or purchases.

## Truth boundaries

- The application runs on EC2 with K3s, not EKS or Lightsail.
- EKS is source/plan evidence only unless independently provisioned and verified; no simulated AWS console or fabricated execution output.
- CI waiting may be condensed and evidence frames held for explanation; label this in the video.
- Sample product data and incident rehearsal are explicitly labeled simulations.
- Infrastructure account IDs, credentials and private access URLs must not appear in the public export.

## Deliverables

An H.264/AAC MP4 under GitHub's 100 MB single-file limit, a poster PNG, a short README GIF under 3 MB, captions, source scripts, evidence provenance, and reproducible verification results.
