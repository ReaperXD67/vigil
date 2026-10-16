"""Typeset actual captured command output; never fabricate terminal execution."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

DEMO = Path(__file__).resolve().parent.parent
FONT = Path("C:/Windows/Fonts/consola.ttf")
TITLE_FONT = Path("C:/Windows/Fonts/segoeuib.ttf")


def card(name: str, title: str, note: str, lines: list[str], size: int = 26):
    image = Image.new("RGB", (1920, 1080), "#080c12")
    draw = ImageDraw.Draw(image)
    draw.text((64, 44), title, font=ImageFont.truetype(str(TITLE_FONT), 44), fill="#e8f3fc")
    draw.text((64, 112), note, font=ImageFont.truetype(str(FONT), 23), fill="#a6c5df")
    draw.line((64, 165, 1856, 165), fill="#2a4053", width=2)
    font = ImageFont.truetype(str(FONT), size)
    y = 198
    for line in lines:
        line = line.expandtabs(2)
        if draw.textlength(line, font=font) > 1790:
            raise ValueError(f"Line too wide in {name}: {line}")
        if y + size > 1005:
            raise ValueError(f"Too many lines in {name}")
        color = "#a6e2c7" if any(word in line for word in ("Running", "deployed", "ready", "Plan:", "main -> main")) else "#d3e1ee"
        draw.text((64, y), line, font=font, fill=color)
        y += size * 1.3
    draw.text((64, 1030), "ACTUAL CAPTURED OUTPUT · Typeset for legibility · Full transcript in demo/evidence", font=ImageFont.truetype(str(FONT), 20), fill="#8fa8bf")
    image.save(DEMO / "evidence" / f"{name}.png")


push = (DEMO / "evidence/ci-push.txt").read_text(encoding="utf-8-sig").splitlines()
card("ci-push", "A real push. A traceable revision.", "Public repository · GitHub Actions run 38908236938", push, 33)

plan = (DEMO / "evidence/terraform-plan.txt").read_text(encoding="utf-8-sig").splitlines()
selected = [line for line in plan if any(key in line for key in (
    "aws_instance.host", "instance_type", "aws_route_table_association.public_secondary",
    "aws_subnet.public_secondary", "availability_zone ", "cidr_block ", "Plan:",
    "terraform apply", "EKS is not", "Temporary instance"))]
card("terraform-plan", "Terraform plan · actual execution excerpt", "Account and resource identifiers redacted · EKS is not included or deployed", selected, 30)

kube = (DEMO / "evidence/kubernetes.txt").read_text(encoding="utf-8-sig").splitlines()
selected = []
for line in kube[1:]:
    if "UP-TO-DATE" in line:
        break
    selected.append(line)
selected.extend(line for line in kube if line.startswith('{"status":"ready"'))
card("kubernetes", "Kubernetes · final production snapshot", "16 October 2026, after temporary-stack cleanup · EC2 / K3s · Helm revision 10", selected, 22)

aws = DEMO / "evidence/aws-infrastructure.txt"
if aws.exists():
    card("aws-infrastructure", "AWS infrastructure · actual captured evidence", "EC2 / K3s · EKS not provisioned · Identifiers redacted", aws.read_text(encoding="utf-8-sig").splitlines(), 26)

reports = []
for filename in ("trivy-backend.txt", "trivy-frontend.txt"):
    report = (DEMO / "evidence/trivy" / filename).read_text(encoding="utf-8-sig").splitlines()
    reports.extend([filename, *report[1:8], ""])
card("ci-security", "Strict container scan · actual report excerpts", "Run 38908236938 · HIGH and CRITICAL gate · Full reports in demo/evidence/trivy", reports, 21)

tests = (DEMO / "evidence/api-test-excerpts.txt").read_text(encoding="utf-8-sig").splitlines()
card("ci-tests", "94 API tests · real CI artifact", "Actual job progress and JUnit summary · 10 spending-guard checks also passed", tests, 25)
