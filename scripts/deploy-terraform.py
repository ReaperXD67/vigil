#!/usr/bin/env python3
"""Pass AWS CLI browser-login credentials privately to a Terraform child process."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


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
    parser.add_argument("args", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.args[1:] if args.args[:1] == ["--"] else args.args
    if not command:
        parser.error("Supply Terraform arguments after --")
    local = Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData/Local")))
    temporary = Path(tempfile.gettempdir())
    try:
        aws = find_binary("aws", args.aws, [local / "Programs/Amazon/AWSCLIV2/aws.exe"])
        terraform = find_binary("terraform", args.terraform, [temporary / "scaler-devops-tools/terraform.exe", temporary / "devops-tools/terraform.exe"])
    except ValueError as error:
        print(error, file=sys.stderr)
        return 2
    env = os.environ.copy()
    for key in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_SECURITY_TOKEN"):
        env.pop(key, None)
    env.update(AWS_REGION=args.region, AWS_DEFAULT_REGION=args.region)
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
    return subprocess.run([terraform, *command], env=env).returncode


if __name__ == "__main__":
    raise SystemExit(main())
