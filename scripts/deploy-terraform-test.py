"""Regression checks for the AWS Free-plan spending boundary (no AWS calls)."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("deploy_terraform", Path(__file__).with_name("deploy-terraform.py"))
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class SpendingBoundaryTests(unittest.TestCase):
    def plan(self, **overrides):
        return {"accountPlanType": "FREE", "accountPlanStatus": "ACTIVE", "accountPlanRemainingCredits": {"amount": 1, "unit": "USD"}, **overrides}

    def test_active_free_plan_passes(self):
        self.assertIsNone(deploy.free_plan_error(self.plan()))

    def test_paid_plan_with_credits_is_denied(self):
        self.assertIsNotNone(deploy.free_plan_error(self.plan(accountPlanType="PAID")))

    def test_expired_plan_is_denied(self):
        self.assertIsNotNone(deploy.free_plan_error(self.plan(accountPlanStatus="EXPIRED")))

    def test_missing_or_empty_credits_are_denied(self):
        for credit in (None, {}, {"amount": 0, "unit": "USD"}, {"amount": -1, "unit": "USD"}, {"amount": "100", "unit": "USD"}, {"amount": float("nan"), "unit": "USD"}, {"amount": float("inf"), "unit": "USD"}):
            self.assertIsNotNone(deploy.free_plan_error(self.plan(accountPlanRemainingCredits=credit)))

    def test_malformed_plan_is_denied(self):
        for plan in (None, [], "FREE"):
            self.assertIsNotNone(deploy.free_plan_error(plan))

    def test_apply_requires_guard(self):
        self.assertTrue(deploy.requires_free_plan("terraform", ["-chdir=infra/ec2", "apply", "-auto-approve"], {}))

    def test_cleanup_and_read_only_commands_remain_available(self):
        for command in (["destroy"], ["apply", "-destroy"], ["plan"], ["validate"]):
            self.assertFalse(deploy.requires_free_plan("terraform", command, {}))

    def test_saved_destroy_plan_can_cleanup(self):
        plan = '{"resource_changes":[{"change":{"actions":["delete"]}}]}'
        with patch.object(deploy.subprocess, "run") as run:
            run.return_value.returncode = 0
            run.return_value.stdout = plan
            self.assertFalse(deploy.requires_free_plan("terraform", ["apply", "cleanup.tfplan"], {}))

    def test_replacement_plan_is_not_cleanup(self):
        plan = {"resource_changes": [{"change": {"actions": ["delete", "create"]}}]}
        self.assertFalse(deploy.delete_only_plan(plan))

    def test_unreadable_saved_plan_fails_closed(self):
        with patch.object(deploy.subprocess, "run") as run:
            run.return_value.returncode = 1
            self.assertTrue(deploy.requires_free_plan("terraform", ["apply", "missing.tfplan"], {}))


if __name__ == "__main__":
    unittest.main()
