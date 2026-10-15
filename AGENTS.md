# Project instructions

## AWS boundary

The owner's current authorization is **AWS Free plan only, with no bank/card charges**.

- Never upgrade the account to Paid, even while promotional credits remain.
- Never join AWS Organizations, enable Control Tower, or enroll in any service or agreement that automatically changes the account plan. Check [AWS's current plan terms](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html) before account-level changes.
- Before provisioning or remote deployment, run `python scripts/deploy-terraform.py --profile scaler-lab --check-free-plan`. Require `FREE`, `ACTIVE`, and positive finite USD credit. Do not bypass a failed check or weaken the guard.
- Use the deployment helper for Terraform operations. Reviewed cleanup remains possible when credits expire; preserve needed data before deleting resources.
- EKS is a source reference only under this authorization. Do not provision it or enable paid-plan services to complete the capstone rubric.
- Temporary capacity must be bounded, documented, and removed after verification. Confirm the final instance type, resource cleanup, and health before reporting delivery.
- Credit exhaustion or expiry ends hosting; do not promise perpetual availability or silently upgrade to keep the demo running.

## Delivery

- Deploy immutable images from a successful CI revision. Keep reported test results, live image tags, and runtime evidence distinct.
- Keep the root README and affected component READMEs current with significant changes. Record detailed evidence and limitations in `docs/VERIFICATION.md` and `docs/REQUIREMENTS.md`.
- Never commit credentials, cookies, Terraform state, database backups, or private account identifiers. Runtime artifacts belong in ignored directories.
