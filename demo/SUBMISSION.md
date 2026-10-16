# Submission handoff

Repository to enter in the [course form](https://forms.gle/XWAP1vAumDJgAPM1A):

**https://github.com/ReaperXD67/vigil**

Presenter: **Aman Kumar**. The form requires an authorized Scaler Google account. No form response has been submitted by this project workflow.

## Required package

| Item | Location |
| --- | --- |
| Technical overview and local setup | [Main README](../README.md) |
| Editable twelve-slide deck | [presentation.pptx](presentation.pptx) |
| Portable slide export | [slides.pdf](slides.pdf) |
| Walkthrough MP4 | [GitHub release asset](https://github.com/ReaperXD67/vigil/releases/download/v1.1.0/vigil-walkthrough.mp4) |
| Chapters, captions, production method | [VIDEO.md](VIDEO.md) |
| Requirement-by-requirement evidence | [Requirements](../docs/REQUIREMENTS.md) |
| Exact revisions and operational results | [Verification](../docs/VERIFICATION.md) |
| Infrastructure source | [infra/ec2](../infra/ec2), [infra/eks](../infra/eks) — this repository uses `infra/` as its Terraform directory |

## Review before sending

1. Open the repository and release assets while signed out of GitHub.
2. Play the MP4 and open the PPT/PDF. The video starts with the slides and proceeds through code, CI, infrastructure, GitOps, Kubernetes, Prometheus, and Grafana.
3. Open the live app and try an isolated demo. Finite AWS Free-plan credits bound its availability.
4. Enter the public repository URL in the form using your authorized Scaler account. Confirm any identity fields yourself.
5. Keep the response receipt after you submit. The project does not claim a receipt or acceptance until the form confirms it.

## Explicit exceptions

EKS provisioning, an EKS node group, and EKS teardown are **not completed**. The owner prohibited any AWS account upgrade. The deployed cluster is K3s on EC2. A real AWS console capture shows zero EKS clusters; the infrastructure section explains the alternative openly.

The production host remains available for evaluation. Temporary GitOps/monitoring resources are cleaned up, but that is not a full Terraform destruction of the retained production environment. Follow [teardown instructions](../docs/DEPLOYMENT.md) when evaluation is finished and retained data has been backed up.

These exceptions may affect grading; the repository does not claim complete rubric compliance or a predicted score.

## Deadline clarification

The [submission guide](https://github.com/Nency-Ravaliya/devsecops-python/blob/main/SUBMISSION.md) names **19 October 2026, 11:59 PM IST**, but labels that date Sunday. The calendar date is Monday. Confirm the intended deadline with the course; this package does not silently choose between the conflicting date and weekday.
