import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cold Emailing Strategy — Internal",
  robots: { index: false, follow: false },
};

/* ─── UI Components ─── */

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "purple" | "blue" | "green" | "orange" | "red" }) {
  const colors = {
    default: "bg-[var(--qm-surface-medium)] text-[var(--qm-text-secondary)]",
    purple: "bg-purple-500/15 text-purple-400",
    blue: "bg-blue-500/15 text-blue-400",
    green: "bg-emerald-500/15 text-emerald-400",
    orange: "bg-orange-500/15 text-orange-400",
    red: "bg-red-500/15 text-red-400",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[variant]}`}>
      {children}
    </span>
  );
}

function Section({ id, icon, title, subtitle, children }: { id: string; icon: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="glass-card p-6 md:p-8 scroll-mt-28 animate-[fade-in_0.5s_ease-out_forwards]">
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-lg">{icon}</div>
        <div>
          <h2 className="text-xl font-semibold text-[var(--qm-text-primary)]">{title}</h2>
          {subtitle && <p className="text-sm text-[var(--qm-text-tertiary)] mt-1">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--qm-border-subtle)]">
            {headers.map((h) => (
              <th key={h} className="text-left py-3 px-4 text-[var(--qm-text-tertiary)] font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Tr({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <tr className={`border-b border-[var(--qm-border-subtle)]/50 hover:bg-[var(--qm-surface-light)] transition-colors ${highlight ? "bg-emerald-500/5" : ""}`}>
      {children}
    </tr>
  );
}

function Td({ children, mono, muted }: { children: React.ReactNode; mono?: boolean; muted?: boolean }) {
  return (
    <td className={`py-3 px-4 ${mono ? "font-mono text-purple-400 text-xs" : ""} ${muted ? "text-[var(--qm-text-tertiary)]" : "text-[var(--qm-text-secondary)]"}`}>
      {children}
    </td>
  );
}

function EmailBlock({ variant, label, subject, body }: { variant: "A" | "B"; label: string; subject: string; body: string }) {
  return (
    <div className="rounded-lg border border-[var(--qm-border-subtle)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--qm-surface-light)] border-b border-[var(--qm-border-subtle)]">
        <div className="flex items-center gap-2">
          <Badge variant={variant === "A" ? "blue" : "purple"}>Variante {variant}</Badge>
          <span className="text-sm text-[var(--qm-text-secondary)]">{label}</span>
        </div>
      </div>
      <div className="p-4 space-y-2">
        <div className="text-xs text-[var(--qm-text-tertiary)]">
          Objet : <span className="text-[var(--qm-text-secondary)]">{subject}</span>
        </div>
        <pre className="text-sm text-[var(--qm-text-secondary)] whitespace-pre-wrap font-sans leading-relaxed">{body}</pre>
      </div>
    </div>
  );
}

function Callout({ type, children }: { type: "info" | "warning" | "success"; children: React.ReactNode }) {
  const styles = {
    info: "bg-blue-500/10 border-blue-500/20 text-blue-400",
    warning: "bg-orange-500/10 border-orange-500/20 text-orange-400",
    success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  };
  return <div className={`p-4 rounded-lg border text-sm leading-relaxed ${styles[type]}`}>{children}</div>;
}

/* ─── Nav ─── */

const navItems = [
  { id: "stack", label: "Stack", icon: "🔧" },
  { id: "infra", label: "Infra", icon: "📧" },
  { id: "cibles", label: "Cibles", icon: "🎯" },
  { id: "apollo", label: "Apollo", icon: "🔍" },
  { id: "debounce", label: "Debounce", icon: "✅" },
  { id: "quotas", label: "Quotas", icon: "📊" },
  { id: "cta", label: "CTA", icon: "💡" },
  { id: "sequences", label: "Séquences", icon: "📨" },
  { id: "ab-testing", label: "A/B Testing", icon: "🧪" },
  { id: "bonnes-pratiques", label: "Do & Don't", icon: "📋" },
  { id: "kpis", label: "KPIs", icon: "📈" },
  { id: "plan", label: "Plan", icon: "🚀" },
  { id: "outils", label: "Outils", icon: "🛠" },
];

/* ─── Page ─── */

export default function ColdEmailingPage() {
  return (
    <div className="min-h-screen bg-[var(--qm-bg-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--qm-border-subtle)] bg-[var(--qm-bg-primary)]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center text-sm font-bold">Q</div>
            <div>
              <h1 className="text-lg font-semibold gradient-text">Cold Emailing Strategy</h1>
              <p className="text-xs text-[var(--qm-text-tertiary)]">QueenMama — Stratégie d&apos;acquisition</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="orange">24 boîtes en chauffe</Badge>
            <Badge variant="green">50% prêtes</Badge>
          </div>
        </div>
      </header>

      {/* Nav */}
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

        {/* 1. Stack */}
        <Section id="stack" icon="🔧" title="Stack technique" subtitle="Les 4 outils du pipeline cold emailing">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { name: "Apollo.io", role: "Prospection", desc: "Extraction d'adresses qualifiées + enrichissement", color: "purple" as const },
              { name: "Debounce.com", role: "Vérification", desc: "Nettoyage de liste, suppression invalides", color: "blue" as const },
              { name: "ManyReach.com", role: "Envoi", desc: "Séquences multi-boîtes, warm-up intégré", color: "green" as const },
              { name: "Apollo / ManyReach", role: "Tracking", desc: "Ouvertures, clics, réponses", color: "orange" as const },
            ].map((t) => (
              <div key={t.name} className="p-4 rounded-lg bg-[var(--qm-surface-light)] hover:bg-[var(--qm-surface-hover)] transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm text-[var(--qm-text-primary)]">{t.name}</span>
                  <Badge variant={t.color}>{t.role}</Badge>
                </div>
                <p className="text-xs text-[var(--qm-text-tertiary)]">{t.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 2. Infra */}
        <Section id="infra" icon="📧" title="Infrastructure email" subtitle="24 boîtes en chauffe — 12 prêtes, 12 en cours">
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
              <div className="text-2xl font-bold text-emerald-400">12</div>
              <div className="text-xs text-emerald-400/70 mt-1">Boîtes prêtes</div>
            </div>
            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20 text-center">
              <div className="text-2xl font-bold text-orange-400">12</div>
              <div className="text-xs text-orange-400/70 mt-1">En chauffe (2 sem.)</div>
            </div>
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
              <div className="text-2xl font-bold text-purple-400">6-8</div>
              <div className="text-xs text-purple-400/70 mt-1">Semaines de chauffe min.</div>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-[var(--qm-text-secondary)] mb-3">Règles de chauffe</h3>
          <div className="space-y-2 mb-6">
            {[
              "Volume : croissance progressive 5 → 50 emails/jour",
              "Ratio reply/envoi pendant chauffe : viser > 20%",
              "SPF, DKIM, DMARC : obligatoires sur chaque domaine",
            ].map((r) => (
              <div key={r} className="flex items-center gap-2 text-sm text-[var(--qm-text-secondary)]">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                {r}
              </div>
            ))}
          </div>

          <h3 className="text-sm font-semibold text-[var(--qm-text-secondary)] mb-3">Architecture de domaines</h3>
          <div className="p-4 rounded-lg bg-[var(--qm-bg-primary)] border border-[var(--qm-border-subtle)] font-mono text-xs space-y-1">
            <div><span className="text-red-400">Principal :</span> <span className="text-[var(--qm-text-secondary)]">queen-mama.io</span> <span className="text-[var(--qm-text-tertiary)]">(jamais en cold)</span></div>
            <div><span className="text-emerald-400">Cold :</span> <span className="text-[var(--qm-text-secondary)]">queenmama-pro.fr / getqueenmama.fr / tryqueenmama.com</span></div>
            <div className="text-[var(--qm-text-secondary)] pl-12">queenmama-app.com / meetqueenmama.com</div>
          </div>
          <p className="text-xs text-[var(--qm-text-tertiary)] mt-2">2-3 boîtes par domaine. Rotation automatique dans ManyReach.</p>
        </Section>

        {/* 3. Cibles */}
        <Section id="cibles" icon="🎯" title="Cibles prioritaires" subtitle="Marché France (P1) + Europe (P2)">
          <h3 className="text-sm font-semibold text-[var(--qm-text-secondary)] uppercase tracking-wider mb-3">ICP France — Profils primaires</h3>
          <Table headers={["Persona", "Titre LinkedIn", "Taille", "Douleur"]}>
            {[
              { persona: "Business Developer", titre: "BDev, Sales Manager, AE", taille: "10-200", douleur: "Mauvaise perf en rdv, closing difficile" },
              { persona: "Fondateur / CEO", titre: "CEO, Co-founder", taille: "1-50", douleur: "Doit pitcher, pas le temps de préparer" },
              { persona: "Recruteur", titre: "Talent Acquisition, RH", taille: "20-500", douleur: "Entretiens mal structurés" },
              { persona: "Consultant indépendant", titre: "Consultant, Freelance", taille: "1", douleur: "Doit performer à chaque rdv" },
              { persona: "Manager commercial", titre: "Dir. Commercial, VP Sales", taille: "50-500", douleur: "Équipe en sous-performance" },
            ].map((p) => (
              <Tr key={p.persona}>
                <Td><span className="font-medium text-[var(--qm-text-primary)]">{p.persona}</span></Td>
                <Td mono>{p.titre}</Td>
                <Td muted>{p.taille} sal.</Td>
                <Td>{p.douleur}</Td>
              </Tr>
            ))}
          </Table>

          <h3 className="text-sm font-semibold text-[var(--qm-text-secondary)] uppercase tracking-wider mb-3 mt-6">Secteurs à fort potentiel</h3>
          <div className="flex flex-wrap gap-2 mb-6">
            {["SaaS B2B", "Cabinets de conseil", "Scale-ups tech", "Recrutement & RH", "Immobilier commercial", "Assurance & finance", "Formation & coaching"].map((s) => (
              <Badge key={s} variant="purple">{s}</Badge>
            ))}
          </div>

          <h3 className="text-sm font-semibold text-[var(--qm-text-secondary)] uppercase tracking-wider mb-3">Géographie France</h3>
          <div className="grid gap-2 md:grid-cols-3">
            {[
              { vague: "Vague 1", villes: "Paris & IDF", variant: "green" as const },
              { vague: "Vague 2", villes: "Lyon, Bordeaux, Nantes, Toulouse", variant: "orange" as const },
              { vague: "Vague 3", villes: "Lille, Strasbourg, Marseille", variant: "default" as const },
            ].map((v) => (
              <div key={v.vague} className="p-3 rounded-lg bg-[var(--qm-surface-light)]">
                <Badge variant={v.variant}>{v.vague}</Badge>
                <p className="text-sm text-[var(--qm-text-secondary)] mt-2">{v.villes}</p>
              </div>
            ))}
          </div>

          <h3 className="text-sm font-semibold text-[var(--qm-text-secondary)] uppercase tracking-wider mb-3 mt-6">Marchés Européens (P2)</h3>
          <Table headers={["Pays", "Langue", "Persona", "Spécificité"]}>
            {[
              { pays: "🇬🇧 UK", langue: "Anglais", persona: "Sales Exec, BDev", spec: "Culture hustle, très réceptifs" },
              { pays: "🇩🇪 Allemagne", langue: "EN + DE", persona: "Vertrieb, AM", spec: "Formaliste, approche pro" },
              { pays: "🇨🇭 Suisse", langue: "FR + DE + EN", persona: "Banker, Consultant", spec: "Premium, très sélectifs" },
              { pays: "🇧🇪 Belgique", langue: "FR + NL", persona: "Manager, Consultant", spec: "Proche FR, sous-exploité" },
              { pays: "🇳🇱 Pays-Bas", langue: "Anglais", persona: "Startup founder", spec: "Tech-friendly, anglophile" },
              { pays: "🇪🇸 Espagne", langue: "ES + EN", persona: "Emprendedor, Sales", spec: "En croissance, moins saturé" },
            ].map((m) => (
              <Tr key={m.pays}>
                <Td><span className="text-base">{m.pays}</span></Td>
                <Td muted>{m.langue}</Td>
                <Td mono>{m.persona}</Td>
                <Td>{m.spec}</Td>
              </Tr>
            ))}
          </Table>

          <div className="mt-4 p-3 rounded-lg bg-[var(--qm-surface-light)]">
            <p className="text-xs text-[var(--qm-text-tertiary)]">
              <span className="font-semibold text-[var(--qm-text-secondary)]">Ordre d&apos;attaque :</span> UK → Belgique → Suisse → Pays-Bas → Allemagne
            </p>
          </div>
        </Section>

        {/* 4. Apollo */}
        <Section id="apollo" icon="🔍" title="Apollo.io — Extraction" subtitle="Filtres recommandés et process">
          <div className="p-4 rounded-lg bg-[var(--qm-bg-primary)] border border-[var(--qm-border-subtle)] font-mono text-xs space-y-1 mb-6">
            <div><span className="text-purple-400">Industry:</span> <span className="text-[var(--qm-text-secondary)]">SaaS, Management Consulting, Staffing, Financial Services</span></div>
            <div><span className="text-purple-400">Job Title:</span> <span className="text-[var(--qm-text-secondary)]">Sales Manager OR BDev OR AE OR Dir. Commercial OR CEO OR TA</span></div>
            <div><span className="text-purple-400">Headcount:</span> <span className="text-[var(--qm-text-secondary)]">10 - 500 employees</span></div>
            <div><span className="text-purple-400">Location:</span> <span className="text-[var(--qm-text-secondary)]">France &gt; Île-de-France (vague 1)</span></div>
            <div><span className="text-purple-400">Email Status:</span> <span className="text-emerald-400">Verified</span> <span className="text-[var(--qm-text-tertiary)]">← obligatoire</span></div>
            <div><span className="text-purple-400">Seniority:</span> <span className="text-[var(--qm-text-secondary)]">Manager, Director, C-Level, Owner</span></div>
            <div><span className="text-purple-400">LinkedIn:</span> <span className="text-[var(--qm-text-secondary)]">Has profile</span></div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="p-3 rounded-lg bg-[var(--qm-surface-light)] text-center">
              <div className="text-lg font-bold text-[var(--qm-text-primary)]">200-500</div>
              <div className="text-xs text-[var(--qm-text-tertiary)]">leads / extraction</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--qm-surface-light)] text-center">
              <div className="text-lg font-bold text-[var(--qm-text-primary)]">500-800</div>
              <div className="text-xs text-[var(--qm-text-tertiary)]">leads / semaine au pipeline</div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--qm-surface-light)] text-center">
              <div className="text-lg font-bold text-emerald-400">&lt; 3%</div>
              <div className="text-xs text-[var(--qm-text-tertiary)]">taux bounce après Debounce</div>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-[var(--qm-text-secondary)] mb-3">Process d&apos;extraction</h3>
          <div className="space-y-3">
            {[
              { step: "1", text: "Apollo → Export CSV avec tous les champs" },
              { step: "2", text: "Debounce → Upload → Garder : Valid + Accept-all score > 70" },
              { step: "3", text: "Supprimer : Invalid, Catch-all faible, Disposable, Role-based" },
              { step: "4", text: "ManyReach → Import liste nettoyée → Assignation boîtes + séquence" },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full gradient-bg flex items-center justify-center text-xs font-bold">{s.step}</div>
                <span className="text-sm text-[var(--qm-text-secondary)] pt-0.5">{s.text}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* 5. Debounce */}
        <Section id="debounce" icon="✅" title="Vérification Debounce" subtitle="Objectif : > 97% de taux de délivrabilité estimé">
          <Table headers={["Statut", "Action", ""]}>
            {[
              { statut: "Valid", action: "Envoyer", icon: "✅", variant: "green" as const },
              { statut: "Accept-all (score > 75)", action: "Envoyer (risque minimal)", icon: "✅", variant: "green" as const },
              { statut: "Accept-all (50-75)", action: "Volume réduit, boîte dédiée", icon: "⚠️", variant: "orange" as const },
              { statut: "Accept-all (< 50)", action: "Supprimer", icon: "❌", variant: "red" as const },
              { statut: "Invalid", action: "Supprimer", icon: "❌", variant: "red" as const },
              { statut: "Catch-all", action: "Supprimer", icon: "❌", variant: "red" as const },
              { statut: "Disposable", action: "Supprimer", icon: "❌", variant: "red" as const },
              { statut: "Role-based (info@, support@)", action: "Supprimer", icon: "❌", variant: "red" as const },
            ].map((d) => (
              <Tr key={d.statut}>
                <Td mono>{d.statut}</Td>
                <Td><Badge variant={d.variant}>{d.action}</Badge></Td>
                <Td>{d.icon}</Td>
              </Tr>
            ))}
          </Table>
        </Section>

        {/* 6. Quotas */}
        <Section id="quotas" icon="📊" title="Quotas d'envoi" subtitle="Démarrer doucement, scaler progressivement">
          <Table headers={["Période", "Emails/jour/boîte", "Emails/semaine"]}>
            {[
              { periode: "Semaines 1-2", jour: "10-15", sem: "70-100" },
              { periode: "Semaines 3-4", jour: "20-30", sem: "140-210" },
              { periode: "Mois 2", jour: "30-40", sem: "210-280" },
              { periode: "Mois 3+ (croisière)", jour: "40-50", sem: "280-350" },
            ].map((q) => (
              <Tr key={q.periode}>
                <Td>{q.periode}</Td>
                <Td mono>{q.jour}</Td>
                <Td mono>{q.sem}</Td>
              </Tr>
            ))}
          </Table>

          <div className="grid gap-4 md:grid-cols-2 mt-6">
            <div className="p-4 rounded-lg bg-[var(--qm-surface-light)] border border-[var(--qm-border-subtle)]">
              <div className="text-xs text-[var(--qm-text-tertiary)] mb-1">12 boîtes actives (croisière)</div>
              <div className="text-lg font-bold text-[var(--qm-text-primary)]">~480-600 <span className="text-sm font-normal text-[var(--qm-text-tertiary)]">emails/jour</span></div>
              <div className="text-sm text-[var(--qm-text-secondary)]">~12 000-16 000 / mois</div>
            </div>
            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <div className="text-xs text-purple-400/70 mb-1">24 boîtes (objectif)</div>
              <div className="text-lg font-bold text-purple-400">~900-1 200 <span className="text-sm font-normal text-purple-400/70">emails/jour</span></div>
              <div className="text-sm text-purple-300">~24 000-32 000 / mois</div>
            </div>
          </div>
        </Section>

        {/* 7. CTA Philosophy */}
        <Section id="cta" icon="💡" title="Philosophie CTA" subtitle="Self-serve plutôt que rdv 1:1">
          <Callout type="info">
            <strong>Choix stratégique :</strong> pas de demande de rdv. Le CTA unique est le téléchargement direct sur queenmama.co.
            L&apos;outil se vend en le testant — friction zéro.
          </Callout>

          <div className="grid gap-3 md:grid-cols-2 mt-4 mb-6">
            {[
              "Volume 10x supérieur (pas de contrainte agenda)",
              "Le produit fait la démo à la place du fondateur",
              "Filtre naturel : seuls les intéressés téléchargent",
              "Pas de no-show, pas de call de découverte basique",
            ].map((a) => (
              <div key={a} className="flex items-start gap-2 p-3 rounded-lg bg-[var(--qm-surface-light)]">
                <span className="text-emerald-400 flex-shrink-0">✓</span>
                <span className="text-sm text-[var(--qm-text-secondary)]">{a}</span>
              </div>
            ))}
          </div>

          <h3 className="text-sm font-semibold text-[var(--qm-text-secondary)] mb-3">Règle de liens par email</h3>
          <div className="space-y-2">
            {[
              { email: "Email 1", rule: "Pas de lien (ou très discret en PS)", why: "Maximiser délivrabilité" },
              { email: "Email 2", rule: "1 lien clair vers queenmama.co", why: "Conversion" },
              { email: "Email 3", rule: "1 lien + permission de sortie", why: "Breakup" },
            ].map((r) => (
              <div key={r.email} className="flex items-center gap-4 p-3 rounded-lg bg-[var(--qm-surface-light)]">
                <Badge variant="purple">{r.email}</Badge>
                <span className="text-sm text-[var(--qm-text-primary)]">{r.rule}</span>
                <span className="text-xs text-[var(--qm-text-tertiary)] ml-auto">{r.why}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* 8. Séquences */}
        <Section id="sequences" icon="📨" title="Séquences d'emails" subtitle="3 séquences × 3 emails × 2 variantes A/B">
          <Callout type="warning">
            <strong>Règles transversales :</strong> Pas de lien en Email 1 — Pas de nom produit en Email 1 — RGPD obligatoire —
            Pas de [Prénom] dans les sujets (-12% réponses) — Pas de chiffres dans les sujets (-46% ouvertures) —
            Liens UTM : <code className="text-orange-300">queenmama.co/get?utm_source=cold&amp;utm_medium=email&amp;utm_campaign=&#123;persona&#125;&amp;utm_content=&#123;variante&#125;</code>
          </Callout>

          {/* Séquence 1 */}
          <div className="mt-6 mb-4">
            <h3 className="text-base font-semibold text-[var(--qm-text-primary)] flex items-center gap-2">
              <Badge variant="blue">SEQ 1</Badge> France / Business Developer / Sales Manager
            </h3>
          </div>

          <div className="space-y-4 mb-8">
            <h4 className="text-sm font-medium text-[var(--qm-text-secondary)]">Email 1 — J0 <span className="text-[var(--qm-text-tertiary)]">(premier contact, pas de lien)</span></h4>
            <div className="grid gap-4 md:grid-cols-2">
              <EmailBlock variant="A" label="Douleur directe" subject="votre prochain rdv / l'argument raté / une question sur vos appels"
                body={`Bonjour [Prénom],\n\nCombien de fois vous êtes-vous dit après un rdv : "j'aurais dû mentionner ça" — trop tard ?\n\nJ'ai créé un outil qui tourne en fond pendant vos appels et vous souffle ce qu'il faut dire, quand le dire. Invisible pour l'autre.\n\nÇa vous parle ?\n\n[Prénom]\n\nP.S. Pour ne plus recevoir mes messages : répondez simplement "stop".`} />
              <EmailBlock variant="B" label="Curiosité / intrigue" subject="ce qui se passe pendant l'appel / l'écart qui fait closer"
                body={`Bonjour [Prénom],\n\nL'écart entre vos meilleurs commerciaux et les autres, ce n'est pas le script. Ce n'est pas la formation.\n\nC'est ce qui se passe pendant l'appel — la capacité à rebondir dans l'instant.\n\nJ'ai créé un outil qui donne cette capacité à n'importe qui. Invisible pour l'interlocuteur.\n\nÇa vous intrigue ?\n\n[Prénom]\n\nP.S. Pour ne plus recevoir mes messages : répondez simplement "stop".`} />
            </div>

            <h4 className="text-sm font-medium text-[var(--qm-text-secondary)] mt-4">Email 2 — J+3 <span className="text-[var(--qm-text-tertiary)]">(relance + lien download)</span></h4>
            <div className="grid gap-4 md:grid-cols-2">
              <EmailBlock variant="A" label="Friction zéro ← principale" subject="Re: [objet email 1]"
                body={`Bonjour [Prénom],\n\nPas de démo à attendre, pas de rdv à planifier.\n\nQueenMama se télécharge en 2 minutes sur Mac ou Windows. Vous le testez sur votre prochain appel. Vous voyez par vous-même.\n\n→ queenmama.co/get\n\n[Prénom]\n\nP.S. Pour ne plus recevoir mes messages : répondez simplement "stop".`} />
              <EmailBlock variant="B" label="Cas concret" subject="Re: [objet email 1]"
                body={`Bonjour [Prénom],\n\nVotre prospect évoque un problème de budget. Avant même que vous répondiez, QueenMama affiche sur votre écran comment reformuler en investissement.\n\nVous ne cherchez plus — vous savez.\n\n→ queenmama.co/get\n\n[Prénom]\n\nP.S. Pour ne plus recevoir mes messages : répondez simplement "stop".`} />
            </div>

            <h4 className="text-sm font-medium text-[var(--qm-text-secondary)] mt-4">Email 3 — J+7 <span className="text-[var(--qm-text-tertiary)]">(breakup)</span></h4>
            <div className="grid gap-4 md:grid-cols-2">
              <EmailBlock variant="A" label="Breakup direct" subject="je referme ce dossier"
                body={`[Prénom],\n\nDernier message de ma part.\n\nSi un jour vous voulez tester l'IA qui tourne pendant vos appels : queenmama.co/get — gratuit pour commencer.\n\nBonne suite,\n[Prénom]\n\nP.S. Le timing est mauvais ? Répondez "plus tard" et je reviens dans 90 jours. Vous ne voulez plus mes messages ? Répondez "stop".`} />
              <EmailBlock variant="B" label="Curiosité finale" subject="avant que je parte"
                body={`[Prénom],\n\nJe ne reviens pas après ce message.\n\nMais si vous avez 3 minutes : queenmama.co/get montre exactement ce que l'IA affiche en temps réel pendant un appel. Sans jargon.\n\nBelle suite.\n[Prénom]\n\nP.S. Un "stop" suffit si vous ne voulez plus recevoir mes emails.`} />
            </div>
          </div>

          {/* Séquence 2 */}
          <div className="mb-4">
            <h3 className="text-base font-semibold text-[var(--qm-text-primary)] flex items-center gap-2">
              <Badge variant="purple">SEQ 2</Badge> France / CEO / Fondateur
            </h3>
          </div>

          <div className="space-y-4 mb-8">
            <h4 className="text-sm font-medium text-[var(--qm-text-secondary)]">Email 1 — J0</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <EmailBlock variant="A" label="Le rdv sous pression" subject="votre prochain rdv décisif / quand les mots ne sortent pas"
                body={`Bonjour [Prénom],\n\nVous êtes face à un investisseur. Il pose une question sur votre go-to-market. Vous connaissez la réponse — mais sous pression, elle ne sort pas dans le bon ordre.\n\nJ'ai créé un outil qui affiche discrètement sur votre écran ce qu'il faut dire à ce moment précis. Invisible pour l'autre.\n\nÇa vous parle ?\n\n[Prénom]\n\nP.S. Pour ne plus recevoir mes messages : répondez simplement "stop".`} />
              <EmailBlock variant="B" label="Le temps qui manque" subject="se préparer sans le temps / entre deux rdv"
                body={`Bonjour [Prénom],\n\nQuand vous enchaînez rdv investisseurs, clients et recrutements dans la même semaine, il y en a toujours un que vous n'avez pas eu le temps de préparer comme il faut.\n\nJ'ai créé un outil qui compense : il tourne en fond pendant le rdv et affiche les bons arguments sur votre écran. L'autre ne voit rien.\n\nÇa vous intéresse ?\n\n[Prénom]\n\nP.S. Pour ne plus recevoir mes messages : répondez simplement "stop".`} />
            </div>

            <h4 className="text-sm font-medium text-[var(--qm-text-secondary)] mt-4">Email 2 — J+4</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <EmailBlock variant="A" label="Friction zéro ← principale" subject="Re: [objet email 1]"
                body={`Bonjour [Prénom],\n\nPas de démo à planifier, pas de call de 30 minutes.\n\nQueenMama se télécharge en 2 minutes. Vous le testez sur votre prochain rdv. Vous voyez par vous-même si ça change la donne.\n\n→ queenmama.co/get\n\n[Prénom]\n\nP.S. Pour ne plus recevoir mes messages : répondez simplement "stop".`} />
              <EmailBlock variant="B" label="Scénario concret" subject="Re: [objet email 1]"
                body={`Bonjour [Prénom],\n\nUn investisseur vous demande comment vous comptez attaquer le marché UK. Vous l'aviez préparé — mais le chiffre clé s'échappe.\n\nQueenMama l'aurait affiché sur votre écran à ce moment précis. Pas de préparation supplémentaire. Juste le bon argument, au bon moment.\n\n→ queenmama.co/get\n\n[Prénom]\n\nP.S. Pour ne plus recevoir mes messages : répondez simplement "stop".`} />
            </div>

            <h4 className="text-sm font-medium text-[var(--qm-text-secondary)] mt-4">Email 3 — J+8 <span className="text-[var(--qm-text-tertiary)]">(breakup)</span></h4>
            <div className="grid gap-4 md:grid-cols-2">
              <EmailBlock variant="A" label="Promesse de silence" subject="je ne reviens plus"
                body={`[Prénom],\n\nPromesse : c'est mon dernier email.\n\nSi un jour vous cherchez à être plus convaincant dans vos rdv décisifs sans y passer plus de temps : queenmama.co/get\n\nBelle croissance pour [Entreprise].\n[Prénom]\n\nP.S. Un "stop" suffit si vous ne voulez plus recevoir mes emails.`} />
              <EmailBlock variant="B" label="Laisser la porte ouverte" subject="dernière chose"
                body={`[Prénom],\n\nJe ne vous recontacte plus après ça.\n\nSi vous cherchez un jour un copilote pour vos rdv stratégiques : queenmama.co/get — 3 minutes pour comprendre ce que ça fait.\n\nBelle suite.\n[Prénom]\n\nP.S. Un "stop" suffit si vous ne voulez plus recevoir mes emails.`} />
            </div>
          </div>

          {/* Séquence 3 */}
          <div className="mb-4">
            <h3 className="text-base font-semibold text-[var(--qm-text-primary)] flex items-center gap-2">
              <Badge variant="green">SEQ 3</Badge> UK / International (Anglais)
            </h3>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium text-[var(--qm-text-secondary)]">Email 1 — J0</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <EmailBlock variant="A" label="Direct pain" subject="your next sales call / the point you almost made"
                body={`Hi [First name],\n\nHow often do you leave a call thinking "I should have said that"?\n\nI built a tool that runs in the background during your calls and tells you exactly what to say, right when you need it. The other side can't see it.\n\nSound familiar?\n\n[Name]\n\nP.S. To stop receiving these emails, just reply "stop".`} />
              <EmailBlock variant="B" label="Curiosity" subject="what happens during the call / the gap on every sales team"
                body={`Hi [First name],\n\nThe best reps don't wing it. They have something running in the background that tells them exactly what to say when the call goes sideways.\n\nI built that tool. It's invisible to the person on the other end.\n\nCurious?\n\n[Name]\n\nP.S. To stop receiving these emails, just reply "stop".`} />
            </div>

            <h4 className="text-sm font-medium text-[var(--qm-text-secondary)] mt-4">Email 2 — J+3</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <EmailBlock variant="A" label="Zero friction ← primary" subject="Re: [original subject]"
                body={`Hi [First name],\n\nNo demo to book. No 30-minute call.\n\nQueenMama downloads in 2 minutes on Mac or Windows. Try it on your next call. See for yourself.\n\n→ queenmama.co/get\n\n[Name]\n\nP.S. To stop receiving these emails, just reply "stop".`} />
              <EmailBlock variant="B" label="Concrete scenario" subject="Re: [original subject]"
                body={`Hi [First name],\n\nYour prospect just brought up budget concerns. Before you even respond, QueenMama shows you how to reframe it as an investment — right there on your screen.\n\nYou don't scramble. You just say it.\n\n→ queenmama.co/get\n\n[Name]\n\nP.S. To stop receiving these emails, just reply "stop".`} />
            </div>

            <h4 className="text-sm font-medium text-[var(--qm-text-secondary)] mt-4">Email 3 — J+7 <span className="text-[var(--qm-text-tertiary)]">(breakup)</span></h4>
            <div className="grid gap-4 md:grid-cols-2">
              <EmailBlock variant="A" label="Close the loop" subject="closing the loop"
                body={`[First name],\n\nLast one from me.\n\nIf you ever want an AI running in the background during your calls: queenmama.co/get — free to start.\n\nGood luck with the pipeline.\n[Name]\n\nP.S. Bad timing? Reply "later" and I'll check back in 90 days. Otherwise, "stop" works too.`} />
              <EmailBlock variant="B" label="Before I go" subject="before I go"
                body={`[First name],\n\nNot emailing you again after this.\n\nIf you're curious what it actually looks like: queenmama.co/get shows exactly what the AI displays during a live call. Takes 3 minutes.\n\nAll the best.\n[Name]\n\nP.S. Reply "stop" if you'd like me to stop emailing you.`} />
            </div>
          </div>
        </Section>

        {/* 9. A/B Testing */}
        <Section id="ab-testing" icon="🧪" title="Framework A/B Testing" subtitle="1 variable à la fois — min. 100 envois par variante">
          <h3 className="text-sm font-semibold text-[var(--qm-text-secondary)] mb-3">Matrice des tests prioritaires</h3>
          <Table headers={["Priorité", "Variable", "Variantes", "Métrique"]}>
            {[
              { p: "🔴 P1", v: "Objet Email 1", var: "A1 vs B1 vs C1", m: "Taux d'ouverture" },
              { p: "🔴 P1", v: "Hook Email 1", var: "Douleur vs Curiosité vs Social proof", m: "Taux de réponse" },
              { p: "🟠 P2", v: "CTA Email 2", var: "Lien texte vs Lien + contexte vs Sans lien", m: "Clic / réponse" },
              { p: "🟠 P2", v: "Longueur email", var: "Court (< 80 mots) vs Moyen (100-120)", m: "Taux de réponse" },
              { p: "🟡 P3", v: "Timing Email 2", var: "J+3 vs J+5", m: "Taux d'ouverture" },
              { p: "🟡 P3", v: "Sujet Email 3", var: '"je referme" vs "avant que je parte"', m: "Ouverture + réponse" },
              { p: "🟢 P4", v: "Sender name", var: 'Prénom vs Prénom + Nom vs + "QM"', m: "Délivrabilité" },
              { p: "🟢 P4", v: "Heure d'envoi", var: "8h-9h vs 11h-12h vs 17h-18h", m: "Taux d'ouverture" },
            ].map((t) => (
              <Tr key={t.v}>
                <Td>{t.p}</Td>
                <Td><span className="font-medium text-[var(--qm-text-primary)]">{t.v}</span></Td>
                <Td muted>{t.var}</Td>
                <Td mono>{t.m}</Td>
              </Tr>
            ))}
          </Table>

          <h3 className="text-sm font-semibold text-[var(--qm-text-secondary)] mb-3 mt-6">Planning des 8 premières semaines</h3>
          <div className="space-y-2">
            {[
              { week: "S1-S2", test: "Objet Email 1", detail: "200 leads, 50/50 → winner à J+5" },
              { week: "S3-S4", test: "Hook Email 1 (corps)", detail: "Douleur vs Curiosité, objet = winner S1-S2" },
              { week: "S5", test: "Objet Email 3 (Breakup)", detail: '"je referme" vs "avant que je parte"' },
              { week: "S6", test: "CTA Email 2", detail: "Lien classique vs lien avec contexte" },
              { week: "S7-S8", test: "Heure d'envoi", detail: "8h-9h vs 11h-12h, même volume" },
            ].map((w) => (
              <div key={w.week} className="flex items-start gap-3 p-3 rounded-lg bg-[var(--qm-surface-light)]">
                <Badge variant="purple">{w.week}</Badge>
                <div>
                  <span className="text-sm font-medium text-[var(--qm-text-primary)]">{w.test}</span>
                  <p className="text-xs text-[var(--qm-text-tertiary)] mt-0.5">{w.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <Callout type="info">
            <strong>Décision statistique :</strong> écart &gt; 20% relatif ET &gt; 100 envois → winner déclaré.
            Ne jamais modifier une séquence en cours de test.
          </Callout>
        </Section>

        {/* 10. Bonnes pratiques & Don'ts */}
        <Section id="bonnes-pratiques" icon="📋" title="Bonnes pratiques & Pièges" subtitle="Do & Don't pour la délivrabilité, le copy et les séquences">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Do */}
            <div>
              <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs">✓</span>
                À faire
              </h3>
              <div className="space-y-2">
                {[
                  "SPF, DKIM, DMARC sur chaque domaine",
                  "Domaines cold > 30 jours avant utilisation",
                  "Chauffe active pendant toute la campagne",
                  "Plain text (pas de HTML lourd)",
                  "0 liens en Email 1, 1 max en Email 2-3",
                  "mail-tester.com score > 9/10",
                  "Objet < 50 caractères, pas de caps",
                  "Email < 150 mots (meilleurs < 100)",
                  "1 CTA par email",
                  "3 emails max par séquence",
                  "Délais : J0 → J+3 → J+7",
                  "Reply to thread pour relances",
                  "Stop dès réponse (+ ou -)",
                  "B2B only, adresses pro nominatives",
                  "Phrase de désinscription dans chaque email",
                ].map((d) => (
                  <div key={d} className="flex items-start gap-2 text-sm">
                    <span className="text-emerald-400 flex-shrink-0">✓</span>
                    <span className="text-[var(--qm-text-secondary)]">{d}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Don't */}
            <div>
              <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center text-xs">✕</span>
                À éviter
              </h3>
              <div className="space-y-2">
                {[
                  "Utiliser queen-mama.io en cold",
                  "Gmail / Outlook gratuit pour le cold",
                  "> 50 emails/jour sur boîte < 6 semaines",
                  "Images, logos, multiples liens",
                  "Envoyer les weekends",
                  "Blast toute la liste d'un coup",
                  "Ignorer les bounces (seuil > 3% = danger)",
                  "Cibler des particuliers (B2C interdit FR)",
                  "[Prénom] dans les sujets (-12% réponses)",
                  "Chiffres dans les sujets (-46% ouvertures)",
                  '"Je suis ravi de...", "Découvrez notre solution"',
                  "Majuscules et points d'exclamation",
                  "Emojis dans les sujets (sauf A/B ciblé)",
                ].map((d) => (
                  <div key={d} className="flex items-start gap-2 text-sm">
                    <span className="text-red-400 flex-shrink-0">✕</span>
                    <span className="text-[var(--qm-text-secondary)]">{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* 11. KPIs */}
        <Section id="kpis" icon="📈" title="KPIs & Benchmarks" subtitle="Métriques cibles et estimation pipeline">
          <Table headers={["Métrique", "Mauvais", "Correct", "Bon", "Excellent"]}>
            {[
              { m: "Taux d'ouverture", bad: "< 20%", ok: "25-35%", good: "40-50%", great: "> 55%" },
              { m: "Taux de clic", bad: "< 1%", ok: "2-3%", good: "4-6%", great: "> 8%" },
              { m: "Taux de réponse (toutes)", bad: "< 2%", ok: "3-5%", good: "6-10%", great: "> 12%" },
              { m: "Réponse positive", bad: "< 0.5%", ok: "1-2%", good: "2-4%", great: "> 5%" },
              { m: "Taux de bounce", bad: "> 5%", ok: "3-5%", good: "1-3%", great: "< 1%" },
              { m: "Taux de spam", bad: "> 0.5%", ok: "0.1-0.3%", good: "< 0.1%", great: "< 0.05%" },
              { m: "Email → téléchargement", bad: "< 0.3%", ok: "0.5-1%", good: "1-2%", great: "> 3%" },
            ].map((k) => (
              <Tr key={k.m}>
                <Td><span className="font-medium text-[var(--qm-text-primary)]">{k.m}</span></Td>
                <Td><span className="text-red-400">{k.bad}</span></Td>
                <Td><span className="text-orange-400">{k.ok}</span></Td>
                <Td><span className="text-emerald-400">{k.good}</span></Td>
                <Td><span className="text-purple-400 font-medium">{k.great}</span></Td>
              </Tr>
            ))}
          </Table>

          <h3 className="text-sm font-semibold text-[var(--qm-text-secondary)] mb-3 mt-6">Estimation pipeline (24 boîtes, croisière)</h3>
          <div className="space-y-2">
            {[
              { step: "Emails envoyés", rate: "100%", vol: "~25 000 / mois" },
              { step: "Ouvertures", rate: "35%", vol: "~8 750" },
              { step: "Clics queenmama.co", rate: "3%", vol: "~750" },
              { step: "Téléchargements", rate: "40% des clics", vol: "~300" },
              { step: "Activation (1er test)", rate: "60% des DL", vol: "~180" },
              { step: "Conversion payant", rate: "15%", vol: "~27 clients/mois" },
            ].map((s, i) => (
              <div key={s.step} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-full max-w-[180px] text-sm text-[var(--qm-text-secondary)]">{s.step}</div>
                <div className="flex-1 h-2 rounded-full bg-[var(--qm-surface-light)] overflow-hidden">
                  <div className="h-full rounded-full gradient-bg" style={{ width: `${100 - i * 16}%` }} />
                </div>
                <div className="flex-shrink-0 w-24 text-right">
                  <span className="text-xs font-mono text-purple-400">{s.rate}</span>
                </div>
                <div className="flex-shrink-0 w-32 text-right text-sm text-[var(--qm-text-secondary)]">{s.vol}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* 12. Plan d'attaque */}
        <Section id="plan" icon="🚀" title="Plan d'attaque" subtitle="4 phases de lancement progressif">
          {[
            {
              phase: "Phase 1", period: "Semaines 1-2", label: "Préparation", variant: "blue" as const,
              tasks: [
                "Vérifier SPF/DKIM/DMARC sur tous les domaines",
                "Confirmer statut chauffe des 12 boîtes dans ManyReach",
                "Créer les 3 listes Apollo (BDev FR, CEO FR, UK Sales)",
                "Exporter 300 leads France (BDev) → Debounce",
                "Créer 2 séquences FR (A + B) pour A/B test #1",
                "Configurer UTM tracking queenmama.co",
              ],
            },
            {
              phase: "Phase 2", period: "Semaines 3-4", label: "Lancement France", variant: "green" as const,
              tasks: [
                "Activer séquence BDev France × 12 boîtes",
                "Volume : 10 emails/boîte/jour → 120/jour",
                "Analyser ouvertures & réponses à J+7",
                "Ajuster copy selon performances",
                "Extraire 200 leads CEO France → séquence CEO",
              ],
            },
            {
              phase: "Phase 3", period: "Mois 2", label: "Scale FR + Test UK", variant: "purple" as const,
              tasks: [
                "Activer les 12 boîtes supplémentaires",
                "Augmenter à 20-30/boîte/jour",
                "Lancer séquence UK avec 5 boîtes dédiées",
                "Extraction 500 leads UK via Apollo",
                "ROI check : coût/lead vs LTV QueenMama",
              ],
            },
            {
              phase: "Phase 4", period: "Mois 3", label: "Expansion Europe", variant: "orange" as const,
              tasks: [
                "Belgique (séquences FR adaptées)",
                "Suisse (premium, volume réduit)",
                "Pays-Bas (anglais, startup scene)",
                "Dashboard tracking par pays dans ManyReach",
              ],
            },
          ].map((p) => (
            <div key={p.phase} className="mb-6 last:mb-0">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant={p.variant}>{p.phase}</Badge>
                <span className="text-sm font-medium text-[var(--qm-text-primary)]">{p.label}</span>
                <span className="text-xs text-[var(--qm-text-tertiary)]">— {p.period}</span>
              </div>
              <div className="pl-4 border-l-2 border-[var(--qm-border-subtle)] space-y-2">
                {p.tasks.map((t) => (
                  <div key={t} className="flex items-center gap-2 text-sm">
                    <span className="w-4 h-4 rounded border border-[var(--qm-border-medium)] flex-shrink-0" />
                    <span className="text-[var(--qm-text-secondary)]">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Section>

        {/* 13. Outils */}
        <Section id="outils" icon="🛠" title="Outils complémentaires" subtitle="Stack recommandée pour optimiser">
          <Table headers={["Besoin", "Outil", "Budget"]}>
            {[
              { besoin: "Vérification délivrabilité", outil: "mail-tester.com", budget: "Gratuit" },
              { besoin: "Inbox placement", outil: "GlockApps", budget: "~$15/mois" },
              { besoin: "Enrichissement", outil: "Hunter.io", budget: "~$49/mois" },
              { besoin: "LinkedIn automation (phase 3)", outil: "Waalaxy / Lemlist", budget: "~$39/mois" },
              { besoin: "DNS / domaines", outil: "Cloudflare", budget: "Gratuit" },
              { besoin: "Réputation IP", outil: "Google Postmaster Tools", budget: "Gratuit" },
              { besoin: "CRM léger", outil: "Notion / HubSpot Free", budget: "Gratuit" },
            ].map((o) => (
              <Tr key={o.outil}>
                <Td>{o.besoin}</Td>
                <Td><span className="font-medium text-[var(--qm-text-primary)]">{o.outil}</span></Td>
                <Td><Badge variant={o.budget === "Gratuit" ? "green" : "orange"}>{o.budget}</Badge></Td>
              </Tr>
            ))}
          </Table>
        </Section>

        {/* Footer */}
        <footer className="text-center py-8 text-xs text-[var(--qm-text-tertiary)]">
          Cold Emailing Strategy &mdash; QueenMama &mdash; Mars 2026
        </footer>
      </main>
    </div>
  );
}
