# Vigil submission walkthrough

The narrated presentation follows the [capstone submission order](https://github.com/Nency-Ravaliya/devsecops-python/blob/main/SUBMISSION.md): PPT first, then codebase, a real push and CI run, Terraform/AWS, ArgoCD, Kubernetes, Prometheus, and Grafana. The full [grading rubric](https://github.com/Nency-Ravaliya/devsecops-python/blob/main/GRADING.md) remains the authority for evaluation.

## Watch and inspect

- [MP4 walkthrough — v1.1.0 release asset](https://github.com/ReaperXD67/vigil/releases/download/v1.1.0/vigil-walkthrough.mp4)
- [Presentation deck](presentation.pptx) · [PDF slides](slides.pdf)
- [Caption transcript](walkthrough.srt)
- [Video source and narration](video/scenes.json) · [Storyboard](video/STORYBOARD.md)
- [Poster](poster.png) · [Eight-second product preview](preview.gif)

The **8 minute 14 second, 1920x1080** video includes local narration and burned-in captions. The release MP4 is approximately **13.3 MB**, keeping a large binary out of ordinary repository clones. `video/quality.json` records the exact final duration, dimensions, codecs, file size, SHA-256, and successful full-decode validation. `video/timeline.json` identifies chapter starts.

| Start | Chapter |
| --- | --- |
| 00:00 | Twelve-slide presentation |
| 03:43 | Public codebase |
| 04:13 | Actual push and complete CI run |
| 04:57 | Terraform and AWS evidence; EKS scope gap |
| 05:48 | Automatic ArgoCD promotion |
| 06:14 | Kubernetes and Helm evidence |
| 06:41 | Prometheus targets |
| 07:02 | Live Grafana dashboard |
| 07:26 | Product workspace |
| 07:55 | Closing |

## Evidence and honesty

The footage uses actual browser captures and original presentation exports. Command-output cards are explicitly labeled **actual captured output, typeset for legibility**; they are not simulated terminal executions. Long CI and ArgoCD waits are condensed, and captured frames may hold while the explanation continues. No status, metric, test result, or console is synthesized.

The submission push is recorded in [ci-push.txt](evidence/ci-push.txt), revision `dbe40442fc324ea1393e121a65887ee697131619`. Its [Actions run 38908236938](https://github.com/ReaperXD67/vigil/actions/runs/38908236938) completed all four jobs. The [initial](evidence/ci-start.json) and [completed](evidence/ci-complete.json) run records, [backend scan](evidence/trivy/trivy-backend.txt), and [frontend scan](evidence/trivy/trivy-frontend.txt) preserve the source evidence. That revision passed 94 backend, 24 frontend, and 10 spending-guard checks; integration checks also exercised real PostgreSQL and complete-stack persistence.

The [GitOps promotion push](evidence/gitops-push.txt) changes the isolated preview's desired image tags in Git. The [actual result](evidence/gitops-promoted.txt) was Synced and Healthy at revision `33f8e1f4e01e68a52922dcf4fd6f3e77edfe47af`, with application images from the passing `dbe40442` build. The preview is separate from production ownership. ArgoCD and monitoring footage documents a bounded demonstration session, not a claim that these services remain publicly available afterward.

The application is deployed on **EC2 with K3s**. EKS was not provisioned. The actual VPC console capture and the separate empty EKS console capture support that distinction. Terraform plan evidence is [preserved as text](evidence/terraform-plan.txt). Required EKS apply/destroy proof remains an explicit submission gap; K3s is never presented as EKS. AWS account IDs, credentials, and the Git commit author's contact field are excluded from the public visuals; non-secret VPC and subnet identifiers remain visible as evidence.

The [monitoring evidence](evidence/monitoring-live.json) preserves the actual target and metric queries: all three application targets were UP during capture.

Product workspace footage uses an isolated demo with visible sample-data labels. Operational Prometheus/Grafana metrics come from the real running backend and are separate from that fictional seed history.

## Rebuild locally

The original assembly follows the local FFmpeg/ffprobe pattern reviewed in [AtlasForge AI](https://github.com/ReaperXD67/atlasforge-ai/tree/1eb58335d0d26f2138d3035ff3a5074a7916053e). It does not call the project's paid or hosted generation providers. HyperFrames' planning and quality workflow informed the storyboard; the user-authorized alternative pipeline uses Python and FFmpeg for deterministic editing.

Requirements: Python 3.11+, Pillow for command-output cards, FFmpeg/ffprobe on `PATH`, and Windows PowerShell with the installed **Microsoft David Desktop** voice. Narration is disclosed local synthetic speech, not the author's recorded voice or an imitation. There is no music, stock media, paid TTS, or external model generation.

```powershell
python -m pip install Pillow
powershell -NoProfile -ExecutionPolicy Bypass -File demo/video/narrate.ps1
python demo/video/transcript_cards.py
python demo/video/prepare_clips.py
python demo/video/render.py
```

Rendering requires the original recordings under `demo/video/raw/`; these private working captures and generated audio/intermediates are intentionally ignored by Git. The source manifest documents each required recording. `narrate.ps1 -Force` refreshes local speech after script edits. `render.py --only s01` renders one scene for review; `--assemble-only` packages existing reviewed clips after an individual scene is rerendered. The full render enforces the 6–9 minute duration and a file size below 100 MB, then decodes the complete MP4 to check corruption. Audio verification measured a mean of -19.2 dB and peak of -1.1 dB, with no clipping.

The screenshot/recording runner uses an independent browser session. No credentials, authenticated storage-state files, or session tokens are included in the committed evidence or released video.
