#!/usr/bin/env python3
"""Pass AWS CLI browser-login credentials privately to a Terraform child process."""
import argparse
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def free_plan_error(plan):
    """Fail closed: a credit balance on a PAID account is not a spending cap."""
    if not isinstance(plan, dict):
        return "The AWS account plan could not be verified."
    if plan.get("accountPlanType") != "FREE":
        return "The account is not on AWS's FREE plan. Paid-account deployment is prohibited."
    if plan.get("accountPlanStatus") != "ACTIVE":
        return "The AWS FREE plan is not ACTIVE. Deployment is prohibited."
    credit = plan.get("accountPlanRemainingCredits", {})
    if not isinstance(credit, dict):
        return "The AWS Free-plan credit balance could not be verified."
    amount = credit.get("amount")
    if credit.get("unit") != "USD" or not isinstance(amount, (int, float)) or isinstance(amount, bool) or not math.isfinite(amount) or amount <= 0:
        return "A positive USD Free-plan credit balance could not be verified."
    return None


def verify_free_plan(aws, profile, env):
    result = subprocess.run(
        [aws, "freetier", "get-account-plan-state", "--profile", profile,
         "--region", "us-east-1", "--output", "json", "--no-cli-pager"],
        env=env, capture_output=True, text=True,
    )
    if result.returncode:
        raise ValueError("Could not verify the AWS Free plan. Refresh login or check permissions; no deployment was started.")
    try:
        plan = json.loads(result.stdout)
        reason = free_plan_error(plan)
    except (ValueError, TypeError, AttributeError):
        raise ValueError("AWS returned an unreadable account plan; no deployment was started.") from None
    if reason:
        raise ValueError(reason)
    print("AWS FREE/ACTIVE plan with positive credits verified. No account upgrade is performed.", flush=True)


def delete_only_plan(plan):
    changes = plan.get("resource_changes", [])
    actions = [change.get("change", {}).get("actions", []) for change in changes]
    return bool(actions) and any("delete" in action for action in actions) and all(
        action and set(action) <= {"delete", "no-op", "read"} for action in actions
    )


def requires_free_plan(terraform, command, env):
    # Global Terraform options precede the command and use -name=value syntax.
    command_index = next((i for i, value in enumerate(command) if not value.startswith("-")), None)
    if command_index is None or command[command_index] != "apply":
        return False
    options = command[command_index + 1:]
    if "-destroy" in options or "-destroy=true" in options:
        return False  # Cleanup must remain possible when credits have expired.
    # Detect a saved plan without confusing separate flag values for filenames.
    positional = []
    takes_value = {"-var", "-var-file", "-state", "-state-out", "-backup", "-lock-timeout", "-parallelism", "-target", "-replace"}
    skip = False
    for value in options:
        if skip:
            skip = False
        elif value in takes_value:
            skip = True
        elif not value.startswith("-"):
            positional.append(value)
    if len(positional) == 1:
        # Plan JSON may contain sensitive values: consume it in memory only.
        result = subprocess.run([terraform, *command[:command_index], "show", "-json", positional[0]], env=env, capture_output=True, text=True)
        if not result.returncode:
            try:
                if delete_only_plan(json.loads(result.stdout)):
                    return False
            except (ValueError, TypeError, AttributeError):
                pass
    return True


def find_binary(name, explicit, candidates):
    if explicit:
        found = shutil.which(explicit) or (str(Path(explicit).resolve()) if Path(explicit).is_file() else None)
        if found:
            return found
        raise ValueError(f"Cannot find {name}: pass --{name} with a valid executable path")
    found = shutil.which(name)
    if found:
        return found
    for path in candidates:
        if path.is_file():
            return str(path)
    raise ValueError(f"Install {name} or supply --{name}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", default="default")
    parser.add_argument("--region", default="ap-south-1")
    parser.add_argument("--aws")
    parser.add_argument("--terraform")
    parser.add_argument("--check-free-plan", action="store_true", help="Verify FREE/ACTIVE and positive credits without running Terraform")
    parser.add_argument("args", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.args[1:] if args.args[:1] == ["--"] else args.args
    if not command and not args.check_free_plan:
        parser.error("Supply Terraform arguments after --")
    local = Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData/Local")))
    temporary = Path(tempfile.gettempdir())
    try:
        aws = find_binary("aws", args.aws, [local / "Programs/Amazon/AWSCLIV2/aws.exe"])
        terraform = None if args.check_free_plan else find_binary("terraform", args.terraform, [temporary / "scaler-devops-tools/terraform.exe", temporary / "devops-tools/terraform.exe"])
    except ValueError as error:
        print(error, file=sys.stderr)
        return 2
    env = os.environ.copy()
    for key in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_SECURITY_TOKEN"):
        env.pop(key, None)
    env.update(AWS_REGION=args.region, AWS_DEFAULT_REGION=args.region)
    if args.check_free_plan:
        try:
            verify_free_plan(aws, args.profile, env)
        except ValueError as error:
            print(error, file=sys.stderr)
            return 1
        return 0
    result = subprocess.run([aws, "configure", "export-credentials", "--profile", args.profile, "--format", "process"], env=env, capture_output=True, text=True)
    if result.returncode:
        print("AWS credentials unavailable. Run aws login for the selected profile and region. Credential output is withheld.", file=sys.stderr)
        return result.returncode
    try:
        credentials = json.loads(result.stdout)
        for key in ("AccessKeyId", "SecretAccessKey", "SessionToken"):
            if not isinstance(credentials[key], str) or not credentials[key]:
                raise ValueError("missing temporary credential")
    except (ValueError, KeyError, TypeError):
        print("AWS CLI did not return temporary session credentials.", file=sys.stderr)
        return 1
    env.pop("AWS_PROFILE", None)
    env.pop("AWS_DEFAULT_PROFILE", None)
    env.update(AWS_ACCESS_KEY_ID=credentials["AccessKeyId"], AWS_SECRET_ACCESS_KEY=credentials["SecretAccessKey"], AWS_SESSION_TOKEN=credentials["SessionToken"])
    if requires_free_plan(terraform, command, env):
        try:
            verify_free_plan(aws, args.profile, env)
        except ValueError as error:
            print(error, file=sys.stderr)
            return 1
    return subprocess.run([terraform, *command], env=env).returncode


if __name__ == "__main__":
    raise SystemExit(main())
