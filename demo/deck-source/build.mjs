// Editable PowerPoint authoring with the Codex-provided Artifact Tool runtime.
// Set VIGIL_ARTIFACT_MODULES and VIGIL_PRESENTATION_SKILL to the provided paths.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const source = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(source, '../..');
const build = path.join(root, 'artifacts/deck-build');
const output = path.join(root, 'demo');
const modules = process.env.VIGIL_ARTIFACT_MODULES;
const skill = process.env.VIGIL_PRESENTATION_SKILL;
if (!modules || !skill) throw new Error('Set VIGIL_ARTIFACT_MODULES and VIGIL_PRESENTATION_SKILL from the Codex workspace dependency tool.');
process.env.RUNTIME_NODE_MODULES = modules;
const req = createRequire(path.join(modules, '_vigil_loader.cjs'));
const artifactPath = req.resolve('@oai/artifact-tool');
const artifactReq = createRequire(artifactPath);
const { FontLibrary } = artifactReq('skia-canvas');
const font = path.join(root, 'frontend/node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2');
FontLibrary.use('Geist', [font]);
const { Presentation, PresentationFile } = await import(pathToFileURL(artifactPath).href);
const { PDFDocument } = req('pdf-lib');
const { finalizePresentation } = await import(pathToFileURL(path.join(skill, 'container_tools/artifact_tool_utils.mjs')).href);
const release = JSON.parse(await fs.readFile(path.join(source, 'release.json'), 'utf8'));
const monitoring = release.monitoring;
const total = release.apiTests + release.frontendTests + release.guardTests;
const shortSha = release.ciRevision.slice(0, 7);
const C = { bg: '#071019', white: '#EAF4FC', ice: '#B5DFFF', muted: '#9CABBB', line: '#324557', node: '#101F2E', green: '#9BD8B7', amber: '#EBC68B' };
const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const notes = [];
const sources = {
  repo: 'https://github.com/ReaperXD67/vigil',
  app: 'https://vigil.13-127-163-58.sslip.io',
  evidence: 'https://github.com/ReaperXD67/vigil/blob/main/docs/VERIFICATION.md',
  ci: `https://github.com/ReaperXD67/vigil/actions/runs/${release.ciRun}`,
  rubric: 'https://github.com/Nency-Ravaliya/devsecops-python/blob/main/GRADING.md',
  submission: 'https://github.com/Nency-Ravaliya/devsecops-python/blob/main/SUBMISSION.md',
};
await fs.mkdir(build, { recursive: true });
await fs.mkdir(path.join(build, 'validated'), { recursive: true });
await fs.mkdir(path.join(output, 'slides'), { recursive: true });

function txt(slide, text, x, y, w, h, size = 28, color = C.white, bold = false, options = {}) {
  const sh = slide.shapes.add({ geometry: 'textbox', name: options.name ?? text.slice(0, 60), position: { left: x, top: y, width: w, height: h }, fill: 'none', line: { fill: 'none', width: 0 } });
  sh.text = text;
  sh.text.style = { typeface: 'Geist', fontSize: size, color, bold, insets: 0, wrap: 'square', autoFit: 'none', verticalAlignment: 'top', ...options.style };
  return sh;
}
function slide(title, narrative, links = [sources.repo, sources.evidence]) {
  const s = p.slides.add();
  s.background.fill = C.bg;
  if (title) txt(s, title, 64, 46, 1152, 78, 50, C.white, true);
  txt(s, String(p.slides.items.length).padStart(2, '0'), 1174, 664, 42, 26, 18, C.muted, false, { style: { alignment: 'right' } });
  s.speakerNotes.text = `${narrative}\n\nSources\n${links.join('\n')}`;
  notes.push({ number: p.slides.items.length, title: title || 'Vigil', narrative, links });
  return s;
}
async function picture(s, filename, x, y, w, h, fit = 'contain', alt = filename, crop) {
  const imagePath = filename.startsWith('demo/') ? path.join(root, filename) : path.join(root, 'docs/assets', filename);
  const b = await fs.readFile(imagePath);
  s.images.add({ blob: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), contentType: /\.jpe?g$/i.test(filename) ? 'image/jpeg' : 'image/png', alt, fit, ...(crop ? { crop } : {}), position: { left: x, top: y, width: w, height: h } });
}
function node(s, label, x, y, w = 220, h = 84, options = {}) {
  const sh = s.shapes.add({ geometry: 'rect', name: label, position: { left: x, top: y, width: w, height: h }, fill: options.fill ?? C.node, line: { fill: options.color ?? C.line, width: 1.5, style: options.dashed ? 'dashed' : 'solid' } });
  sh.text = label;
  sh.text.style = { typeface: 'Geist', fontSize: options.size ?? 25, color: options.textColor ?? C.white, bold: options.bold ?? false, alignment: 'center', verticalAlignment: 'middle', insets: 12, autoFit: 'none' };
  return sh;
}
function connect(s, a, b, fromSide = 'right', toSide = 'left', dashed = false) {
  return s.shapes.connect(a, b, { kind: fromSide === 'right' && toSide === 'left' ? 'straight' : 'elbow', fromSide, toSide, line: { fill: C.ice, width: 2, style: dashed ? 'dashed' : 'solid' }, tail: { type: 'arrow', width: 'med', length: 'med' } });
}
function table(s, values, x, y, widths, rowHeights, fontSize = 25) {
  const t = s.tables.add({ rows: values.length, columns: widths.length, left: x, top: y, width: widths.reduce((a, b) => a + b, 0), height: rowHeights.reduce((a, b) => a + b, 0), columnWidths: widths, values });
  t.borders.assign({ fill: C.line, width: 0.7, style: 'solid' });
  for (let r = 0; r < values.length; r++) {
    t.rows[r].height = rowHeights[r];
    for (let c = 0; c < widths.length; c++) {
      const cell = t.getCell(r, c);
      cell.fill = C.bg;
      cell.text.style = { typeface: 'Geist', fontSize, bold: r === 0, color: r === 0 ? C.ice : C.white, insets: 14, verticalAlignment: 'middle', autoFit: 'none' };
    }
  }
  return t;
}

// 1. Minimal cover with an original product image.
{
  const s = slide('', 'I built Vigil as an original reliability workspace. It combines real public HTTPS checks with incident response, dependency analysis, and recovery tasks. The public project and its delivery evidence are available in the repository. This presentation describes verified behavior and explicitly identifies the EKS gap.');
  await picture(s, 'particle-tree.png', 620, 100, 596, 520, 'contain', 'Original Vigil particle tree, cropped from the product screenshot', { left: 0.34, right: 0.34, top: 0.39, bottom: 0.21 });
  txt(s, 'VIGIL', 64, 176, 550, 150, 108, C.ice, true);
  txt(s, 'An open-source\nreliability workspace', 68, 340, 500, 130, 39, C.white);
  txt(s, `${release.presenter}\nDevSecOps capstone\n${release.date}`, 68, 562, 500, 92, 24, C.muted);
}
// 2. Product overview.
{
  const s = slide('Service health and response', 'The application organizes the response to a service problem. Registered workspaces can monitor approved public HTTPS endpoints. Public status pages expose only opted-in services and provide copyable SVG status badges with sample and stale-data labels. Incidents keep a factual timeline and connect to remediation tasks. JSON exports and deterministic Markdown postmortems preserve the work. The screenshot contains explicitly labeled demo telemetry.');
  txt(s, 'Monitor', 64, 173, 350, 42, 33, C.ice, true);
  txt(s, 'Public HTTPS checks, status pages, and SVG badges.', 64, 224, 350, 104, 27);
  txt(s, 'Respond', 64, 367, 350, 42, 33, C.ice, true);
  txt(s, 'Incident timelines, recovery tasks, and factual postmortems.', 64, 418, 350, 118, 27);
  await picture(s, 'workspace.png', 457, 148, 759, 478, 'contain', 'Vigil workspace with labeled demonstration services and tasks');
  txt(s, 'Demo telemetry is visibly labeled.', 457, 625, 759, 32, 21, C.muted);
}
// 3. The useful differentiator.
{
  const s = slide('Service dependency analysis', 'A declared connection identifies which service depends on an upstream service. Selecting a service follows the graph to count direct and indirect dependents at the shortest number of hops. Ownership checks keep every connection private. The server rejects self-connections, duplicate edges, and cycles, including concurrent opposite inserts. Production browser checks verified create, reload persistence, removal, and restoration of the original graph. Potential impact does not establish measured failure propagation or root cause.');
  await picture(s, 'dependencies-live.png', 411, 151, 805, 490, 'contain', 'Actual hosted dependency map with sample labels');
  txt(s, 'Potential impact', 64, 175, 318, 82, 34, C.ice, true);
  txt(s, 'Direct and indirect\ndependents\n\nCurrent health and\nincident severity\n\nPrivate, persistent\nconnections', 64, 285, 320, 310, 27);
  txt(s, 'Declared relationships do not prove causality.', 411, 630, 790, 30, 21, C.muted);
}
// 4. Required editable architecture diagram.
{
  const s = slide('Application architecture', 'This is the runtime request and data flow. Traefik terminates public HTTPS and routes the static React frontend and /api requests to their services. FastAPI replicas share PostgreSQL for users, sessions, services, incidents, and dependencies. A singleton worker schedules probes. The API and worker validate public destinations before an HTTPS check. PostgreSQL uses a local persistent volume on the EC2 host, so an off-host backup is necessary for host-loss recovery. All components and connectors in this diagram are editable PowerPoint objects.');
  const boundary = s.shapes.add({ geometry: 'rect', name: 'EC2 K3s host boundary', position: { left: 266, top: 151, width: 950, height: 460 }, fill: 'none', line: { fill: C.line, width: 1.5, style: 'dashed' } });
  txt(s, 'AWS EC2 / K3s', 292, 164, 400, 32, 24, C.muted);
  const browser = node(s, 'Browser', 64, 298, 160, 86);
  const ingress = node(s, 'HTTPS ingress\nTraefik', 302, 298, 200, 86);
  const front = node(s, 'React / Nginx\n2 replicas', 582, 218, 220, 86);
  const api = node(s, 'FastAPI\n2 replicas', 582, 388, 220, 86);
  const db = node(s, 'PostgreSQL\npersistent volume', 916, 388, 250, 86);
  const worker = node(s, 'Scheduled worker\n1 replica', 916, 518, 250, 72, { size: 23 });
  connect(s, browser, ingress);
  connect(s, ingress, front, 'top', 'left');
  connect(s, ingress, api, 'bottom', 'left');
  connect(s, api, db);
  connect(s, worker, db, 'top', 'bottom');
  txt(s, '/', 517, 227, 44, 32, 24, C.ice);
  txt(s, '/api', 505, 427, 70, 32, 24, C.ice);
  txt(s, 'Private database\nshared sessions', 836, 319, 350, 60, 23, C.muted);
  txt(s, 'API and worker perform bounded, validated public HTTPS probes.', 64, 632, 1120, 35, 24, C.muted);
}
// 5. Editable implementation table.
{
  const s = slide('Implementation stack', 'The stack separates product code from deployment. FastAPI uses SQLAlchemy and Alembic with PostgreSQL in production and isolated SQLite tests. React and TypeScript build with Vite and serve through a nonroot Nginx container. The interaction layer uses original WebGL geometry, Motion, GSAP, and Lenis with keyboard and reduced-motion controls. GitHub Actions builds and scans immutable images. Terraform and Helm reproduce the AWS and Kubernetes definitions.');
  table(s, [
    ['Layer', 'Implementation', 'Purpose'],
    ['API', 'Python / FastAPI', 'Validated, owner-scoped REST routes'],
    ['Data', 'PostgreSQL / SQLAlchemy / Alembic', 'Persistent sessions and versioned schema'],
    ['Frontend', 'React / TypeScript / Vite', 'Responsive app and original WebGL'],
    ['Delivery', 'Docker / Actions / Trivy / GHCR', 'Tested and scanned SHA images'],
    ['Runtime', 'Terraform / K3s / Helm', 'Reproducible AWS deployment'],
  ], 64, 160, [190, 444, 518], [58, 80, 80, 80, 80, 80], 24);
}
// 6. Native table, one arithmetic source of truth.
{
  const s = slide('Automated verification', `The CI-verified source contains ${total} automated checks: ${release.apiTests} backend tests, ${release.frontendTests} frontend tests, and ${release.guardTests} offline AWS spending-guard tests. API cases include authentication, ownership, SSRF controls, graph cycles, cascade deletion, concurrent opposite inserts, and public-badge privacy and stale-data handling. Frontend tests cover API-client behavior, graph traversal, and particle projection. CI additionally applies and rolls back all PostgreSQL migrations, then checks actual container restart persistence through Nginx.`, [sources.ci, sources.evidence]);
  txt(s, String(total), 64, 191, 380, 190, 144, C.ice, true);
  txt(s, 'automated checks', 68, 385, 390, 50, 31);
  txt(s, 'Isolated test data\nReal PostgreSQL smoke\nReal Compose restart', 68, 468, 390, 140, 27, C.muted);
  table(s, [['Suite', 'Passed'], ['API behavior', String(release.apiTests)], ['Frontend behavior', String(release.frontendTests)], ['AWS spending guard', String(release.guardTests)]], 520, 186, [496, 200], [62, 100, 100, 100], 29);
  txt(s, `Verified CI revision ${shortSha}`, 520, 590, 696, 38, 23, C.muted);
}
// 7. Editable CI diagram.
{
  const s = slide('CI and security gates', 'A push to main runs backend tests, frontend build and tests, and PostgreSQL migrations. The container job waits for all three, builds the actual runtime images, starts the full Compose stack, verifies nonroot user IDs and persistence through a backend restart, and scans both images. Trivy v0.76.0 includes operating-system and runtime dependencies, fails on HIGH or CRITICAL findings including unfixed issues, and uses no vulnerability exclusions. Only successful gates publish full-commit-SHA images to GHCR. Zero matching findings describes the scan at that time, not a vulnerability-free guarantee.', [sources.ci, sources.evidence, 'https://github.com/ReaperXD67/vigil/blob/main/.github/workflows/ci.yml']);
  const labels = ['Push to main', 'Tests + build', 'Runtime images', 'Compose smoke', 'Trivy gate', 'SHA images'];
  const ns = labels.map((v, i) => node(s, v, 64 + i * 194, 220, 174, 96, { size: 23, color: i === 4 ? C.ice : C.line }));
  for (let i = 0; i < ns.length - 1; i++) connect(s, ns[i], ns[i + 1]);
  txt(s, '0', 64, 408, 210, 150, 112, C.green, true);
  txt(s, 'HIGH or CRITICAL findings\nin both published runtime images', 270, 433, 830, 100, 34);
  txt(s, 'Unfixed findings included. No exclusions. Publication requires every gate.', 64, 606, 1140, 42, 25, C.muted);
}
// 8. Hosting boundary, no unsupported EKS claim.
{
  const s = slide('AWS Free plan deployment', 'The running public product uses one EC2 t3.small instance in Mumbai with K3s, a 20 GiB encrypted root volume, an Elastic IP, and SSM administration. The AWS Console capture shows the real Vigil VPC with public subnets in two availability zones and an Internet Gateway; the application still runs on one host. A guard requires the actual account plan to be FREE and ACTIVE with positive finite USD credit before provisioning or deployment. Paid accounts are rejected even if promotional credits remain. Temporary larger capacity supported monitoring and recovery, then returned to the budget host. The EKS source exists but EKS apply, node-group provisioning, and destroy evidence remain unverified because the authorization forbids upgrading the account or paid EKS services.', [sources.evidence, 'https://github.com/ReaperXD67/vigil/blob/main/demo/evidence/aws-vpc-console.jpg', 'https://github.com/ReaperXD67/vigil/blob/main/AGENTS.md', 'https://github.com/ReaperXD67/vigil/blob/main/docs/DEPLOYMENT.md', sources.rubric]);
  txt(s, 't3.small', 64, 156, 340, 92, 65, C.ice, true);
  txt(s, '2 GiB / EC2 / K3s\nMumbai region', 68, 259, 330, 80, 27);
  txt(s, 'Account boundary', 454, 170, 355, 45, 31, C.white, true);
  txt(s, 'FREE and ACTIVE\nPositive finite credits\nNo paid-plan upgrade', 454, 234, 355, 108, 25, C.green);
  txt(s, 'Rubric gap: EKS', 860, 170, 356, 45, 31, C.amber, true);
  txt(s, 'Source validated.\nApply and destroy\nremain unverified.', 860, 234, 356, 108, 25);
  await picture(s, 'demo/evidence/aws-vpc-console.jpg', 64, 359, 1152, 300, 'contain', 'Actual AWS Console map of the Vigil VPC with two public subnets and an Internet Gateway');
}
// 9. Operations and a real failure/recovery lesson.
{
  const s = slide('Kubernetes rollout and recovery', 'Production runs two backend replicas, two frontend replicas, and one scheduled worker. PostgreSQL migrations gate application rollout. A previous surge update exhausted headroom and mixed frontend assets across versions. The deployed fix uses Recreate for the frontend and zero-surge rolling updates for the API, trading a bounded frontend interruption for consistent assets and lower peak memory. A route error boundary handles failed lazy chunks and render exceptions. The bounded HPA load exercise on 15 October 2026 scaled from two to four replicas and naturally recovered to two. Six readiness samples on t3.small passed with 543 to 569 MiB memory available and unchanged restart counts. The 16 October application release subsequently passed health and database readiness with two API and two frontend replicas ready.', [sources.evidence, 'https://github.com/ReaperXD67/vigil/blob/main/docs/OPERATIONS.md', 'https://github.com/ReaperXD67/vigil/tree/main/helm/vigil']);
  txt(s, '2 API   2 frontend   1 worker', 64, 161, 1150, 78, 49, C.ice, true);
  txt(s, 'Frontend', 64, 296, 325, 44, 31, C.white, true);
  txt(s, 'Recreate avoids mixed\nstatic asset versions.', 64, 358, 325, 105, 28);
  txt(s, 'API', 460, 296, 325, 44, 31, C.white, true);
  txt(s, 'Zero surge reduces\npeak rollout memory.', 460, 358, 325, 105, 28);
  txt(s, 'Recovery', 856, 296, 350, 44, 31, C.white, true);
  txt(s, 'Migrations gate startup.\nRoute errors offer retry.', 856, 358, 350, 105, 28);
  txt(s, 'HPA: 2 to 4, then back to 2', 64, 549, 1110, 56, 38, C.green, true);
  txt(s, 'Six readiness checks passed on the 2 GiB host.', 64, 613, 1140, 37, 25, C.muted);
}
// 10. GitOps status is driven by verified evidence in release.json.
{
  const verified = release.argoStatus === 'verified';
  const s = slide('GitOps with Argo CD', release.argoNotes, [sources.repo, 'https://github.com/ReaperXD67/vigil/tree/main/gitops', ...(release.argoEvidence ? [release.argoEvidence, `https://github.com/ReaperXD67/vigil/commit/${release.argoRevision}`, 'https://github.com/ReaperXD67/vigil/blob/main/demo/evidence/gitops-promoted.txt'] : []), sources.submission]);
  const a = node(s, 'Git repository\nHelm + image SHA', 64, 232, 310, 120, { size: 30 });
  const b = node(s, 'Argo CD\nreconciliation', 484, 232, 310, 120, { size: 30 });
  const c = node(s, 'Isolated preview\n1 API + 1 frontend', 904, 232, 310, 120, { size: 29 });
  connect(s, a, b); connect(s, b, c);
  txt(s, verified ? 'Synced and Healthy' : 'Verification in progress', 64, 437, 1150, 70, 48, verified ? C.green : C.amber, true);
  txt(s, verified ? `${release.argoApplication} / automatic Git promotion\nSynced Git revision ${release.argoRevision.slice(0, 12)}\nProduction remains owned by Helm.` : 'The diagram shows the intended GitOps flow.\nLive reconciliation evidence remains pending.', 64, 524, 1110, 124, 27, C.muted);
}
// 11. Actual operational evidence, not synthetic dashboard telemetry.
{
  const s = slide('Live observability', monitoring.narrative, [sources.evidence, monitoring.evidence, monitoring.queryEvidence, 'https://github.com/ReaperXD67/vigil/blob/main/monitoring/README.md']);
  txt(s, 'Actual application\nmetrics', 64, 183, 435, 120, 40, C.ice, true);
  txt(s, monitoring.metricList, 64, 332, 435, 155, 28);
  txt(s, monitoring.status, 64, 538, 435, 90, 25, C.muted);
  await picture(s, monitoring.image, 540, 135, 676, 517, 'contain', 'Real AWS Grafana dashboard with actual application telemetry');
  txt(s, monitoring.caption, 540, 651, 676, 25, 19, C.muted);
}
// 12. Clear closing, useful lessons and honest scope.
{
  const s = slide('Lessons and remaining limits', 'The implementation taught three concrete lessons. Small hosts require control of rollout peak memory, not just steady-state resource requests. The application must preserve session and database state across restarts and provide recovery when asset loading fails. Evidence should distinguish source configuration, a successful CI run, a deployed image, and an observed user workflow. EKS provisioning and teardown remain the explicit rubric gap. Product limitations include a single host, finite Free-plan credits, no email recovery or team invitations, and deterministic rather than AI-generated postmortems. The live demo and public repository allow the grader to inspect the actual system.', [sources.evidence, sources.repo, sources.rubric]);
  txt(s, 'Small-host releases', 64, 173, 470, 51, 33, C.ice, true);
  txt(s, 'Peak deployment memory and\nasset consistency matter.', 64, 238, 500, 108, 29);
  txt(s, 'Evidence stays specific', 64, 397, 500, 51, 33, C.ice, true);
  txt(s, 'Separate tests, source, deployment,\nand observed behavior.', 64, 463, 500, 106, 29);
  txt(s, 'Known limits', 692, 173, 500, 51, 33, C.amber, true);
  txt(s, 'Single host and finite credits\nNo team invitations or email recovery\nEKS apply / destroy unverified', 692, 244, 500, 180, 27);
  txt(s, 'github.com/ReaperXD67/vigil', 64, 626, 920, 35, 26, C.white, true);
}

// Export slides at 1920 x 1080 for a clear video source.
for (let i = 0; i < p.slides.items.length; i++) {
  const s = p.slides.items[i];
  const stem = `slide-${String(i + 1).padStart(2, '0')}`;
  const png = await p.export({ slide: s, format: 'png', scale: 1.5 });
  await fs.writeFile(path.join(output, 'slides', `${stem}.png`), new Uint8Array(await png.arrayBuffer()));
  const layout = await s.export({ format: 'layout' });
  await fs.writeFile(path.join(build, `${stem}.layout.json`), await layout.text());
}
const montage = await p.export({ format: 'webp', montage: true, scale: 0.5 });
await fs.writeFile(path.join(build, 'contact-sheet.webp'), new Uint8Array(await montage.arrayBuffer()));

const stamp = Date.now();
const candidate = path.join(build, `candidate-${stamp}.pptx`);
const final = path.join(build, 'validated', `presentation-${stamp}.pptx`);
await (await PresentationFile.exportPptx(p)).save(candidate);
await finalizePresentation({
  workspaceDir: root,
  candidatePath: candidate,
  finalPath: final,
  pythonExecutable: process.env.VIGIL_RUNTIME_PYTHON,
  integrityValidatorPath: path.join(skill, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(skill, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-heading-fit', '--require-native-table-slide', '5', '--require-native-table-slide', '6'],
  explicitTotalSlideCount: 12,
  requiredNativeTableOwnerSlides: [5, 6],
  fontPolicy: { basis: 'design', families: ['Geist'] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(build, `validation-${stamp}.json`),
});
await fs.copyFile(final, path.join(output, 'presentation.pptx'));

// The bundled native PDF exporter has a missing standard-font module on this
// host. Embed the verified renders as PDF pages without modifying the runtime.
const pdf = await PDFDocument.create();
pdf.setTitle('Vigil — DevSecOps capstone');
pdf.setAuthor(release.presenter);
pdf.setSubject('Product, architecture, delivery, and verified runtime evidence');
for (let i = 1; i <= p.slides.items.length; i++) {
  const bytes = await fs.readFile(path.join(output, 'slides', `slide-${String(i).padStart(2, '0')}.png`));
  const image = await pdf.embedPng(bytes);
  const page = pdf.addPage([960, 540]);
  page.drawImage(image, { x: 0, y: 0, width: 960, height: 540 });
}
await fs.writeFile(path.join(output, 'slides.pdf'), await pdf.save());
await fs.writeFile(path.join(build, 'speaker-notes.json'), JSON.stringify(notes, null, 2));
await fs.writeFile(path.join(output, 'SLIDES.md'), `# Vigil presentation\n\nTwelve widescreen slides for the capstone presentation. The editable PowerPoint includes native architecture and CI/GitOps diagrams, native tables, and speaker notes with sources. The PDF and 1920×1080 slide PNGs preserve the reviewed layout.\n\n## Files\n\n- [PowerPoint](presentation.pptx)\n- [PDF](slides.pdf)\n- [Slide PNGs](slides/)\n- [Source builder](deck-source/build.mjs) and [release evidence inputs](deck-source/release.json)\n\nGeist is the project typeface. Install Geist when editing the PowerPoint on a computer that does not have it. The PDF and images do not require font installation.\n\n## Presenter notes\n\n${notes.map(n => `### ${String(n.number).padStart(2, '0')}. ${n.title}\n\n${n.narrative}\n\nSources: ${n.links.map(x => `[${x.replace('https://','')}](${x})`).join(', ')}\n`).join('\n')}\n## Rebuild\n\nRequires the Codex-provided Artifact Tool runtime and the frontend font dependency after \`npm ci\` in \`frontend/\`. Set \`VIGIL_ARTIFACT_MODULES\`, \`VIGIL_PRESENTATION_SKILL\`, and \`VIGIL_RUNTIME_PYTHON\` to the workspace dependency paths, then run \`node demo/deck-source/build.mjs\` with that runtime's Node executable. Private drafts and checks stay in ignored \`artifacts/deck-build/\`.\n`);
console.log(JSON.stringify({ slides: p.slides.items.length, tests: total, pptx: path.join(output, 'presentation.pptx'), pdf: path.join(output, 'slides.pdf'), argo: release.argoStatus }));
