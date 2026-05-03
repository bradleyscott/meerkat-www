import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

const ROOT = process.env.MEERKAT_ROOT || path.resolve(process.cwd(), '..', 'meerkat');

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

export interface Page {
  title: string;
  html: string;
  frontmatter: Record<string, unknown>;
  breadcrumbs: { label: string; href: string }[];
}

function readMd(filePath: string): { frontmatter: Record<string, unknown>; content: string } {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  return { frontmatter: data, content };
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
}

const renderer = new marked.Renderer();
renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
  const id = slugify(text);
  return `<h${depth} id="${id}">${text}</h${depth}>\n`;
};

function mdToHtml(md: string): string {
  return marked.parse(md, { async: false, renderer }) as string;
}

/** Rewrite relative markdown links so they resolve on the docs site. */
function relinkForDocs(md: string): string {
  return md
    // why-i-built-this.md → /docs/why-i-built-this
    .replace(/\(why-i-built-this\.md\)/g, '(/docs/why-i-built-this)')
    // skills/README.md#anchor or skills/README.md → /docs/skills
    .replace(/\(skills\/README\.md(#[^)]+)?\)/g, '(/docs/skills$1)')
    // example/section/file.md → /docs/example/section/file (strip .md)
    .replace(/\(example\/([^)]+)\.md\)/g, '(/docs/example/$1)')
    // example/section/ or example/section/sub/ directory links → /docs/example#section
    .replace(/\(example\/([^/)]+)(?:\/[^)]*)?\/\)/g, '(/docs/example#$1)')
    // example/ → /docs/example
    .replace(/\(example\/\)/g, '(/docs/example)')
    // ../README.md#anchor or ../README.md → /docs
    .replace(/\(\.\.\/README\.md(#[^)]+)?\)/g, '(/docs$1)');
}

function titleFromFrontmatter(fm: Record<string, unknown>, fallback: string): string {
  return (
    (fm.title as string) ||
    (fm.name as string) ||
    (fm.company as string) ||
    (fm.persona as string) ||
    fallback
  );
}

function titleFromHeading(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

// ---- Skills ----

interface SkillEntry {
  slug: string;
  title: string;
  description: string;
}

export function getSkills(): SkillEntry[] {
  const skillsDir = path.join(ROOT, 'skills');
  const dirs = fs.readdirSync(skillsDir).filter((d) => {
    const skillPath = path.join(skillsDir, d, 'SKILL.md');
    return fs.existsSync(skillPath);
  });

  // Order to match the README grouping
  const order = [
    'onboard',
    'synthesise-research',
    'start-prd',
    'identify-prd-assumptions',
    'suggest-discovery-plan',
    'check-prd-ready',
    'research-competitors',
    'monitor-competitors',
    'research-industry',
    'monitor-industry',
    'push',
    'pull',
  ];

  const sorted = dirs.sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return sorted.map((slug) => {
    const { frontmatter, content } = readMd(path.join(skillsDir, slug, 'SKILL.md'));
    const title = titleFromHeading(content, titleFromFrontmatter(frontmatter, slug));
    const description = (frontmatter.description as string)?.trim().split('\n')[0] || '';
    return { slug, title, description };
  });
}

export function getSkillPage(slug: string): Page {
  const filePath = path.join(ROOT, 'skills', slug, 'SKILL.md');
  const { frontmatter, content } = readMd(filePath);
  const title = titleFromHeading(content, titleFromFrontmatter(frontmatter, slug));
  return {
    title,
    html: mdToHtml(content),
    frontmatter,
    breadcrumbs: [
      { label: 'Docs', href: '/docs' },
      { label: 'Skills', href: '/docs/skills' },
      { label: title, href: `/docs/skills/${slug}` },
    ],
  };
}

export function getSkillsOverview(): Page {
  const filePath = path.join(ROOT, 'skills', 'README.md');
  const { frontmatter, content } = readMd(filePath);
  return {
    title: 'Skills Reference',
    html: mdToHtml(relinkForDocs(content)),
    frontmatter,
    breadcrumbs: [
      { label: 'Docs', href: '/docs' },
      { label: 'Skills', href: '/docs/skills' },
    ],
  };
}

// ---- Example content ----

interface ExampleSection {
  slug: string;
  label: string;
  files: { slug: string; title: string; filePath: string }[];
}

export function getExampleSections(): ExampleSection[] {
  const exampleDir = path.join(ROOT, 'example');

  const sections: ExampleSection[] = [
    {
      slug: 'company',
      label: 'Company',
      files: [
        { slug: 'acme-anvils', title: 'Acme Anvils Corp', filePath: 'company/acme-anvils.md' },
        { slug: 'strategy', title: 'Strategy', filePath: 'company/strategy.md' },
        { slug: 'revenue-model', title: 'Revenue Model', filePath: 'company/revenue-model.md' },
      ],
    },
    {
      slug: 'product',
      label: 'Product',
      files: [
        { slug: 'okrs', title: 'OKRs', filePath: 'product/okrs.md' },
        { slug: 'positioning', title: 'Positioning', filePath: 'product/positioning.md' },
        { slug: 'roadmap', title: 'Roadmap', filePath: 'product/roadmap.md' },
        { slug: 'vision-ai-targeting', title: 'Vision: AI Targeting', filePath: 'product/vision/ai-targeting.md' },
        { slug: 'vision-urban-market', title: 'Vision: Urban Market', filePath: 'product/vision/urban-market.md' },
      ],
    },
    {
      slug: 'competitors',
      label: 'Competitors',
      files: [
        { slug: 'coyote-tech', title: 'Coyote Tech', filePath: 'competitors/coyote-tech/summary.md' },
        { slug: 'roadrunner-systems', title: 'Roadrunner Systems', filePath: 'competitors/roadrunner-systems/summary.md' },
      ],
    },
    {
      slug: 'industry',
      label: 'Industry',
      files: [
        { slug: 'landscape', title: 'Industry Landscape', filePath: 'industry/landscape.md' },
        { slug: 'digest-2026-02-15', title: 'Digest: 2026-02-15', filePath: 'industry/digests/2026-02-15.md' },
      ],
    },
    {
      slug: 'personas',
      label: 'Personas',
      files: [
        { slug: 'field-operator', title: 'Field Operator', filePath: 'personas/users/field-operator.md' },
        { slug: 'operations-manager', title: 'Operations Manager', filePath: 'personas/users/operations-manager.md' },
        { slug: 'procurement-director', title: 'Procurement Director', filePath: 'personas/buyers/procurement-director.md' },
      ],
    },
    {
      slug: 'role',
      label: 'Role',
      files: [
        { slug: 'role-context', title: 'Role Context', filePath: 'role/role-context.md' },
      ],
    },
  ];

  // Validate that files exist and enrich titles from frontmatter
  for (const section of sections) {
    section.files = section.files.filter((f) => {
      const full = path.join(exampleDir, f.filePath);
      if (!fs.existsSync(full)) return false;
      const { frontmatter, content } = readMd(full);
      const extracted = titleFromHeading(content, titleFromFrontmatter(frontmatter, f.title));
      if (extracted && extracted !== f.title) {
        f.title = extracted;
      }
      return true;
    });
  }

  return sections.filter((s) => s.files.length > 0);
}

export function getExamplePage(section: string, slug: string): Page | null {
  const sections = getExampleSections();
  const sec = sections.find((s) => s.slug === section);
  if (!sec) return null;
  const file = sec.files.find((f) => f.slug === slug);
  if (!file) return null;

  const exampleDir = path.join(ROOT, 'example');
  const filePath = path.join(exampleDir, file.filePath);
  const { frontmatter, content } = readMd(filePath);
  const title = titleFromHeading(content, titleFromFrontmatter(frontmatter, file.title));

  return {
    title,
    html: mdToHtml(content),
    frontmatter,
    breadcrumbs: [
      { label: 'Docs', href: '/docs' },
      { label: 'Example context', href: '/docs/example' },
      { label: sec.label, href: `/docs/example#${sec.slug}` },
      { label: title, href: `/docs/example/${section}/${slug}` },
    ],
  };
}

// ---- Navigation tree ----

function getReadmeHeadings(): NavItem[] {
  const filePath = path.join(ROOT, 'README.md');
  const { content } = readMd(filePath);
  const stripped = content.replace(/^[\s\S]*?\n---\n/, '');
  const headings: NavItem[] = [];
  let match;
  const re = /^## (.+)$/gm;
  while ((match = re.exec(stripped)) !== null) {
    const label = match[1].trim();
    const slug = slugify(label);
    headings.push({ label, href: `/docs#${slug}` });
  }
  return headings;
}

export function getNav(): NavItem[] {
  const skills = getSkills();
  const exampleSections = getExampleSections();

  return [
    { label: 'Overview', href: '/docs', children: getReadmeHeadings() },
    { label: 'Why I built this', href: '/docs/why-i-built-this' },
    {
      label: 'Skills',
      href: '/docs/skills',
      children: skills.map((s) => ({
        label: s.title,
        href: `/docs/skills/${s.slug}`,
      })),
    },
    {
      label: 'Example context',
      href: '/docs/example',
      children: exampleSections.map((sec) => ({
        label: sec.label,
        href: `/docs/example#${sec.slug}`,
        children: sec.files.map((f) => ({
          label: f.title,
          href: `/docs/example/${sec.slug}/${f.slug}`,
        })),
      })),
    },
  ];
}

// ---- README (docs index) ----

export function getReadme(): Page {
  const filePath = path.join(ROOT, 'README.md');
  const { frontmatter, content } = readMd(filePath);
  // Strip the HTML header block (logo, title, tagline) before the first ---
  const stripped = content.replace(/^[\s\S]*?\n---\n/, '');
  return {
    title: 'Meerkat',
    html: mdToHtml(relinkForDocs(stripped)),
    frontmatter,
    breadcrumbs: [{ label: 'Docs', href: '/docs' }],
  };
}

// ---- Why I built this ----

export function getWhyPage(): Page {
  const filePath = path.join(ROOT, 'why-i-built-this.md');
  const { frontmatter, content } = readMd(filePath);
  const title = titleFromHeading(content, 'Why I built this');
  return {
    title,
    html: mdToHtml(content),
    frontmatter,
    breadcrumbs: [
      { label: 'Docs', href: '/docs' },
      { label: title, href: '/docs/why-i-built-this' },
    ],
  };
}
