import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Toolkit — Internal",
  robots: { index: false, follow: false },
};

/* ───────────────────────────────────────────────
   Section data — edit here to add/remove content
   ─────────────────────────────────────────────── */

const mcpServers = [
  {
    name: "sentry",
    level: "Projet (Queen_Mama)",
    type: "SSE",
    url: "mcp.sentry.dev/sse",
    usage: "Diagnostics d'erreurs prod, triage Sentry",
  },
  {
    name: "claude-mem",
    level: "Global (plugin)",
    type: "Plugin MCP",
    url: "thedotmack v9.0.4",
    usage: "Mémoire de session et recherche de contexte",
  },
  {
    name: "context7",
    level: "Global (plugin)",
    type: "Plugin MCP",
    url: "claude-plugins-official",
    usage: "Docs de librairies (React, Next.js, Prisma…)",
  },
];

const pluginsWithSkills = [
  { name: "ralph-loop", version: "1.0.0", skills: "/ralph-loop, /cancel-ralph, /ralph-loop:help" },
  { name: "frontend-design", version: "latest", skills: "/frontend-design" },
  { name: "code-review", version: "latest", skills: "/code-review" },
  { name: "feature-dev", version: "latest", skills: "/feature-dev" },
  { name: "stripe", version: "0.1.0", skills: "/stripe:explain-error, /stripe:test-cards, /stripe:stripe-best-practices" },
  { name: "commit-commands", version: "latest", skills: "/commit, /commit-push-pr, /clean_gone" },
  { name: "claude-md-management", version: "1.0.0", skills: "/revise-claude-md, /claude-md-improver" },
  { name: "claude-code-setup", version: "1.0.0", skills: "/claude-automation-recommender" },
  { name: "skill-creator", version: "latest", skills: "/skill-creator" },
  { name: "superpowers", version: "5.0.6", skills: "Voir section dédiée" },
];

const lspPlugins = [
  { name: "swift-lsp", role: "Autocomplétion et analyse Swift" },
  { name: "typescript-lsp", role: "Autocomplétion et analyse TypeScript" },
  { name: "rust-analyzer-lsp", role: "Autocomplétion et analyse Rust (Tauri)" },
];

const personalSkills = [
  { name: "session-optimizer", cmd: "/session-optimizer [objectif]", usage: "Début de session — recommande les outils optimaux" },
  { name: "copywriting", cmd: "/copywriting", usage: "Rédiger/améliorer du copy marketing" },
  { name: "find-skills", cmd: "/find-skills", usage: "Trouver un skill adapté à un besoin" },
  { name: "kling-3-prompting", cmd: "/kling-3-prompting", usage: "Prompts pour Kling 3.0 (vidéo AI)" },
  { name: "linkedin-post", cmd: "/linkedin-post [angle]", usage: "Post LinkedIn FR + prompt image + 1er commentaire UTM" },
  { name: "tip", cmd: "/tip", usage: "Flux continu de tips Claude Code" },
];

const projectSkills = [
  { name: "copywriting", cmd: "/copywriting", desc: "Rédaction copy Queen Mama (hérite du global)" },
  { name: "deploy", cmd: "/deploy [plateforme] [env]", desc: "Déploiement Queen Mama" },
];

const deployCommands = [
  { cmd: "/deploy", desc: "Interactif (demande plateforme + env)" },
  { cmd: "/deploy staging", desc: "Staging (demande plateforme)" },
  { cmd: "/deploy prod", desc: "Production (demande plateforme)" },
  { cmd: "/deploy mac staging", desc: "macOS Swift → staging.queenmama.co" },
  { cmd: "/deploy mac prod", desc: "macOS Swift → queenmama.co" },
  { cmd: "/deploy win staging", desc: "Windows Electron → staging" },
  { cmd: "/deploy win prod", desc: "Windows Electron → prod" },
  { cmd: "/deploy electron-mac staging", desc: "Electron macOS DMG → staging" },
  { cmd: "/deploy electron-mac prod", desc: "Electron macOS DMG → prod" },
  { cmd: "/deploy all staging", desc: "mac + win → staging" },
  { cmd: "/deploy all prod", desc: "mac + win → production" },
];

const superpowersSkills = [
  { name: "using-superpowers", usage: "Au démarrage — apprend les skills" },
  { name: "brainstorming", usage: "Avant tout travail créatif" },
  { name: "writing-plans", usage: "Avant de coder une tâche multi-fichiers" },
  { name: "executing-plans", usage: "Exécuter un plan avec checkpoints" },
  { name: "systematic-debugging", usage: "Face à un bug, avant de proposer un fix" },
  { name: "verification-before-completion", usage: "Avant de clore une tâche" },
  { name: "test-driven-development", usage: "Avant d'écrire du code d'implémentation" },
  { name: "writing-skills", usage: "Créer ou modifier un skill" },
  { name: "requesting-code-review", usage: "Après implémentation, avant merge" },
  { name: "receiving-code-review", usage: "Réception d'une review — rigor first" },
  { name: "using-git-worktrees", usage: "Feature nécessitant isolation" },
  { name: "subagent-driven-development", usage: "Tâches indépendantes en parallèle" },
  { name: "dispatching-parallel-agents", usage: "2+ tâches sans état partagé" },
  { name: "finishing-a-development-branch", usage: "Implémentation terminée, avant merge" },
];

const docCommands = [
  { cmd: "/doc <fichier>", desc: "Crée ou améliore une documentation" },
  { cmd: "/worktree", desc: "Git worktree pour dev en parallèle" },
  { cmd: "/worktree-clean", desc: "Nettoie un worktree après merge" },
  { cmd: "/recap", desc: "Récapitule la session Claude Code" },
  { cmd: "/daily [date]", desc: "Rapport CTO + JIRA du jour" },
  { cmd: "/sprint [options]", desc: "Rapport de sprint (défaut: 14j)" },
];

const autoRules = [
  { situation: "Travail UI/frontend", tool: "/frontend-design", behavior: "Auto-activé" },
  { situation: 'Import anthropic', tool: "/claude-api", behavior: "Auto-activé" },
  { situation: "PR / review mentionnée", tool: "/code-review", behavior: "Suggestion" },
  { situation: "Feature multi-fichiers", tool: "/feature-dev", behavior: "Suggestion" },
  { situation: "Tâche autonome + critères", tool: "/ralph-loop", behavior: "Suggestion" },
  { situation: "Docs librairie", tool: "context7 MCP", behavior: "Silencieux" },
  { situation: "Erreurs Sentry", tool: "Sentry MCP", behavior: "Disponible" },
];

const configFiles = [
  { file: "~/.claude/settings.json", role: "Config globale : modèle, plugins, hooks, statusline" },
  { file: "~/.claude/config/config.json", role: "MCP servers globaux" },
  { file: "~/.claude/skills/", role: "Skills personnels globaux" },
  { file: "~/.claude/hooks/rtk-rewrite.sh", role: "Hook RTK" },
  { file: "~/.claude/statusline-command.sh", role: "Statusline : modèle, contexte, git, plugins" },
  { file: ".mcp.json", role: "MCP Sentry (niveau projet)" },
  { file: ".claude/settings.local.json", role: "Permissions + activation MCP Sentry" },
  { file: ".claude/commands/deploy.md", role: "Skill /deploy Queen_Mama" },
  { file: ".claude/skills/copywriting/", role: "Skill copywriting Queen_Mama" },
  { file: "CLAUDE.md", role: "Instructions projet pour Claude Code" },
  { file: "~/.claude/CLAUDE.md", role: "Instructions globales (confidentialité, RTK)" },
  { file: "~/.claude/projects/.../memory/", role: "Mémoire persistante inter-sessions" },
];

/* ─────────────── Shared UI helpers ─────────────── */

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "purple" | "blue" | "green" | "orange" }) {
  const colors = {
    default: "bg-[var(--qm-surface-medium)] text-[var(--qm-text-secondary)]",
    purple: "bg-purple-500/15 text-purple-400",
    blue: "bg-blue-500/15 text-blue-400",
    green: "bg-emerald-500/15 text-emerald-400",
    orange: "bg-orange-500/15 text-orange-400",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[variant]}`}>
      {children}
    </span>
  );
}

function SectionCard({ id, icon, title, subtitle, children }: { id: string; icon: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="glass-card p-6 md:p-8 scroll-mt-24 animate-[fade-in_0.5s_ease-out_forwards]">
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-lg">
          {icon}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[var(--qm-text-primary)]">{title}</h2>
          {subtitle && <p className="text-sm text-[var(--qm-text-tertiary)] mt-1">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-[var(--qm-surface-medium)] text-purple-400 text-sm font-mono">
      {children}
    </code>
  );
}

/* ────────────────────── Nav ────────────────────── */

const navItems = [
  { id: "mcp", label: "MCP", icon: "🔌" },
  { id: "plugins", label: "Plugins", icon: "🧩" },
  { id: "skills-perso", label: "Skills perso", icon: "⚡" },
  { id: "skills-projet", label: "Skills projet", icon: "👑" },
  { id: "deploy", label: "Deploy", icon: "🚀" },
  { id: "superpowers", label: "Superpowers", icon: "💪" },
  { id: "docs", label: "Docs & Gestion", icon: "📄" },
  { id: "hooks", label: "Hooks", icon: "🔧" },
  { id: "auto", label: "Auto-activation", icon: "⚙️" },
  { id: "files", label: "Fichiers config", icon: "📁" },
];

/* ──────────────────── Page ──────────────────── */

export default function ToolkitPage() {
  return (
    <div className="min-h-screen bg-[var(--qm-bg-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--qm-border-subtle)] bg-[var(--qm-bg-primary)]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center text-sm font-bold">
              Q
            </div>
            <div>
              <h1 className="text-lg font-semibold gradient-text">Internal Toolkit</h1>
              <p className="text-xs text-[var(--qm-text-tertiary)]">Claude Code Configuration Reference</p>
            </div>
          </div>
          <Badge variant="purple">v1.0 — 30 mars 2026</Badge>
        </div>
      </header>

      {/* Navigation pills */}
      <nav className="sticky top-[73px] z-40 border-b border-[var(--qm-border-subtle)] bg-[var(--qm-bg-primary)]/60 backdrop-blur-xl overflow-x-auto">
        <div className="max-w-6xl mx-auto px-4 py-3 flex gap-2">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[var(--qm-text-secondary)] bg-[var(--qm-surface-light)] hover:bg-[var(--qm-surface-hover)] hover:text-[var(--qm-text-primary)] transition-all duration-200"
            >
              <span>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* MCP Servers */}
        <SectionCard id="mcp" icon="🔌" title="MCP Servers" subtitle="Serveurs Model Context Protocol connectés">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--qm-border-subtle)]">
                  <th className="text-left py-3 px-4 text-[var(--qm-text-tertiary)] font-medium">Nom</th>
                  <th className="text-left py-3 px-4 text-[var(--qm-text-tertiary)] font-medium">Niveau</th>
                  <th className="text-left py-3 px-4 text-[var(--qm-text-tertiary)] font-medium">Type</th>
                  <th className="text-left py-3 px-4 text-[var(--qm-text-tertiary)] font-medium">Utilisation</th>
                </tr>
              </thead>
              <tbody>
                {mcpServers.map((s) => (
                  <tr key={s.name} className="border-b border-[var(--qm-border-subtle)]/50 hover:bg-[var(--qm-surface-light)] transition-colors">
                    <td className="py-3 px-4 font-mono text-purple-400">{s.name}</td>
                    <td className="py-3 px-4 text-[var(--qm-text-secondary)]">{s.level}</td>
                    <td className="py-3 px-4"><Badge variant="blue">{s.type}</Badge></td>
                    <td className="py-3 px-4 text-[var(--qm-text-secondary)]">{s.usage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs text-orange-400">
            <strong>Supprimés le 29/03 :</strong> n8n-mcp, Atlassian — overhead inutile.
            Vercel plugin installé mais désactivé (re-activer si travail sur landing/).
          </div>
        </SectionCard>

        {/* Plugins */}
        <SectionCard id="plugins" icon="🧩" title="Plugins installés" subtitle="Plugins avec skills (slash commands) et LSP">
          <h3 className="text-sm font-semibold text-[var(--qm-text-secondary)] uppercase tracking-wider mb-3">Skills Plugins</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {pluginsWithSkills.map((p) => (
              <div key={p.name} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--qm-surface-light)] hover:bg-[var(--qm-surface-hover)] transition-colors">
                <div className="w-2 h-2 rounded-full gradient-bg mt-2 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-[var(--qm-text-primary)]">{p.name}</span>
                    <Badge>{p.version}</Badge>
                  </div>
                  <p className="text-xs text-[var(--qm-text-tertiary)] mt-1 truncate">{p.skills}</p>
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-sm font-semibold text-[var(--qm-text-secondary)] uppercase tracking-wider mb-3 mt-6">LSP Plugins</h3>
          <div className="grid gap-2 md:grid-cols-3">
            {lspPlugins.map((p) => (
              <div key={p.name} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--qm-surface-light)]">
                <span className="text-green-400 text-xs">LSP</span>
                <div>
                  <span className="font-mono text-sm text-[var(--qm-text-primary)]">{p.name}</span>
                  <p className="text-xs text-[var(--qm-text-tertiary)]">{p.role}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Personal Skills */}
        <SectionCard id="skills-perso" icon="⚡" title="Skills personnels" subtitle="~/.claude/skills/ — disponibles dans tous les projets">
          <div className="space-y-2">
            {personalSkills.map((s) => (
              <div key={s.name} className="flex items-center gap-4 p-3 rounded-lg hover:bg-[var(--qm-surface-light)] transition-colors group">
                <Code>{s.cmd}</Code>
                <span className="text-sm text-[var(--qm-text-secondary)] group-hover:text-[var(--qm-text-primary)] transition-colors">{s.usage}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Project Skills */}
        <SectionCard id="skills-projet" icon="👑" title="Skills projet Queen_Mama" subtitle=".claude/skills/ et .claude/commands/">
          <div className="space-y-2">
            {projectSkills.map((s) => (
              <div key={s.name} className="flex items-center gap-4 p-3 rounded-lg hover:bg-[var(--qm-surface-light)] transition-colors">
                <Code>{s.cmd}</Code>
                <span className="text-sm text-[var(--qm-text-secondary)]">{s.desc}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Deploy */}
        <SectionCard id="deploy" icon="🚀" title="/deploy — Référence complète" subtitle="Déploiement multi-plateforme via GitHub Actions">
          <div className="rounded-lg overflow-hidden border border-[var(--qm-border-subtle)]">
            {deployCommands.map((d, i) => (
              <div
                key={d.cmd}
                className={`flex items-center justify-between px-4 py-3 ${
                  i % 2 === 0 ? "bg-[var(--qm-surface-light)]" : ""
                } ${i < deployCommands.length - 1 ? "border-b border-[var(--qm-border-subtle)]/50" : ""}`}
              >
                <code className="text-sm font-mono text-purple-400">{d.cmd}</code>
                <span className="text-sm text-[var(--qm-text-tertiary)]">{d.desc}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--qm-text-tertiary)] mt-3">
            Processus : vérifie git clean &rarr; récupère les tags &rarr; incrémente version &rarr; crée tag &rarr; déclenche GitHub Actions
          </p>
        </SectionCard>

        {/* Superpowers */}
        <SectionCard id="superpowers" icon="💪" title="Superpowers" subtitle="Plugin v5.0.6 — méthodologies de développement structuré">
          <div className="grid gap-2 md:grid-cols-2">
            {superpowersSkills.map((s) => (
              <div key={s.name} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--qm-surface-light)]">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-2 flex-shrink-0" />
                <div>
                  <code className="text-xs font-mono text-purple-400">/{s.name}</code>
                  <p className="text-xs text-[var(--qm-text-tertiary)] mt-0.5">{s.usage}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Docs & Gestion */}
        <SectionCard id="docs" icon="📄" title="Documentation & Gestion" subtitle="Commandes utilitaires">
          <div className="space-y-2">
            {docCommands.map((d) => (
              <div key={d.cmd} className="flex items-center gap-4 p-3 rounded-lg hover:bg-[var(--qm-surface-light)] transition-colors">
                <Code>{d.cmd}</Code>
                <span className="text-sm text-[var(--qm-text-secondary)]">{d.desc}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Hooks */}
        <SectionCard id="hooks" icon="🔧" title="Automatisations (Hooks)" subtitle="RTK — Rust Token Killer">
          <div className="p-4 rounded-lg bg-[var(--qm-surface-light)] border border-[var(--qm-border-subtle)]">
            <div className="flex items-center gap-3 mb-3">
              <Badge variant="green">PreToolUse &rarr; Bash</Badge>
              <span className="text-sm text-[var(--qm-text-secondary)]">Réécrit les commandes Bash pour économiser 60-90% de tokens</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2 mt-4">
              {[
                { cmd: "rtk gain", desc: "Affiche les économies de tokens" },
                { cmd: "rtk gain --history", desc: "Historique avec économies" },
                { cmd: "rtk discover", desc: "Opportunités manquées" },
                { cmd: "rtk proxy <cmd>", desc: "Commande brute (debug)" },
              ].map((r) => (
                <div key={r.cmd} className="flex items-center gap-3 p-2 rounded bg-[var(--qm-bg-primary)]/50">
                  <code className="text-xs font-mono text-emerald-400">{r.cmd}</code>
                  <span className="text-xs text-[var(--qm-text-tertiary)]">{r.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* Auto-activation */}
        <SectionCard id="auto" icon="⚙️" title="Règles d'activation automatique" subtitle="Quand chaque outil se déclenche">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--qm-border-subtle)]">
                  <th className="text-left py-3 px-4 text-[var(--qm-text-tertiary)] font-medium">Situation</th>
                  <th className="text-left py-3 px-4 text-[var(--qm-text-tertiary)] font-medium">Outil</th>
                  <th className="text-left py-3 px-4 text-[var(--qm-text-tertiary)] font-medium">Comportement</th>
                </tr>
              </thead>
              <tbody>
                {autoRules.map((r) => (
                  <tr key={r.situation} className="border-b border-[var(--qm-border-subtle)]/50 hover:bg-[var(--qm-surface-light)] transition-colors">
                    <td className="py-3 px-4 text-[var(--qm-text-secondary)]">{r.situation}</td>
                    <td className="py-3 px-4"><Code>{r.tool}</Code></td>
                    <td className="py-3 px-4">
                      <Badge variant={r.behavior === "Auto-activé" ? "green" : r.behavior === "Suggestion" ? "orange" : "blue"}>
                        {r.behavior}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Config files */}
        <SectionCard id="files" icon="📁" title="Fichiers de configuration" subtitle="Fichiers clés de la configuration Claude Code">
          <div className="space-y-1">
            {configFiles.map((f) => (
              <div key={f.file} className="flex items-start gap-4 p-2.5 rounded-lg hover:bg-[var(--qm-surface-light)] transition-colors">
                <code className="text-xs font-mono text-blue-400 whitespace-nowrap flex-shrink-0 mt-0.5">{f.file}</code>
                <span className="text-xs text-[var(--qm-text-tertiary)]">{f.role}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Confidentialité */}
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-400 text-sm font-semibold">Confidentialité IA</span>
          </div>
          <p className="text-xs text-red-400/80 leading-relaxed">
            JAMAIS mentionner Claude, Claude Code, Anthropic dans : commits Git, GitHub (PR, issues, commentaires), ou toute communication externe.
            Si un texte public est nécessaire &rarr; le fournir pour publication manuelle.
          </p>
        </div>

        {/* Footer */}
        <footer className="text-center py-8 text-xs text-[var(--qm-text-tertiary)]">
          Internal Toolkit &mdash; Queen Mama &mdash; Dernière mise à jour : 30 mars 2026
        </footer>
      </main>
    </div>
  );
}
