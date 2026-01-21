# CI/CD Pipeline - Queen Mama

Ce document explique le fonctionnement complet du pipeline CI/CD pour Queen Mama.

## Architecture Globale

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ENVIRONNEMENTS                               │
├─────────────────────────────────────────────────────────────────────┤
│  STAGING                          │  PRODUCTION                     │
│  staging.queenmama.co             │  queenmama.co                   │
│  Pre-releases (beta, rc, alpha)   │  Releases stables               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         WORKFLOWS                                   │
├─────────────────────────────────────────────────────────────────────┤
│  build-macos.yml     │  Build, sign, notarize et publier l'app     │
│  deploy-web.yml      │  Valider le code web (lint, types, build)   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    DÉPLOIEMENT WEB                                  │
├─────────────────────────────────────────────────────────────────────┤
│   Push sur main ──────────► Vercel déploie queenmama.co            │
│   Push sur staging ───────► Vercel déploie staging.queenmama.co    │
│   GitHub Actions ─────────► Valide lint/types/build (ne déploie pas)│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Workflows

### 1. `build-macos.yml` - Build Application macOS

**Déclenchement :**
- Push d'un tag `v*` (ex: `v1.0.0`, `v1.1.0-beta.1`)
- Manuellement via Actions → "Run workflow"

**Processus :**
1. **Détermination du type de release** - Analyse le nom du tag
2. **Installation du certificat** - Import du Developer ID Application
3. **Build de l'archive** - `xcodebuild archive` avec signing
4. **Export de l'app** - Copie et re-signature avec `codesign`
5. **Notarisation** - Envoi à Apple pour validation (timeout: 15 min)
6. **Création du DMG** - Package pour distribution
7. **Publication** - GitHub Release (pre-release ou stable)

**Types de releases :**

| Pattern du tag | Type | Environnement | API Endpoint |
|----------------|------|---------------|--------------|
| `v1.0.0` | Production | queenmama.co | `/releases/latest` |
| `v1.0.0-beta.1` | Pre-release | staging.queenmama.co | `/releases` |
| `v1.0.0-rc.1` | Pre-release | staging.queenmama.co | `/releases` |
| `v1.0.0-alpha.1` | Pre-release | staging.queenmama.co | `/releases` |
| `v1.0.0-dev.1` | Pre-release | staging.queenmama.co | `/releases` |

### 2. `deploy-web.yml` - Validation Web App

**Déclenchement :**
- Push sur `main` ou `staging` (fichiers dans `landing/`)
- Pull request vers `main` ou `staging`
- Manuellement via Actions

**Processus :**
1. **Install dependencies** - `npm ci`
2. **Lint** - Vérification ESLint
3. **Prisma generate** - Génération du client
4. **Type check** - Vérification TypeScript
5. **Build check** - Test de compilation Next.js

> **Note :** Le déploiement web réel est géré par **Vercel** automatiquement.
> Ce workflow valide uniquement que le code compile correctement.

---

## Comment Déployer

### Déployer une version BETA (staging)

```bash
# 1. S'assurer d'être sur staging avec les derniers changements
git checkout staging
git pull origin staging

# 2. Committer les changements
git add -A
git commit -m "Description des changements"
git push origin staging

# 3. Créer un tag beta
git tag -a v1.0.7-beta.1 -m "Beta release for testing"
git push origin v1.0.7-beta.1
```

**Résultat :**
- ✅ L'app est buildée avec le certificat Developer ID
- ✅ Notarisée auprès d'Apple (ou continue sans si timeout)
- ✅ Publiée sur GitHub Releases en **pre-release**
- ✅ `staging.queenmama.co/download` affiche cette version

### Déployer une version PRODUCTION

```bash
# 1. S'assurer que staging est stable et testé
git checkout main
git pull origin main
git merge staging

# 2. Pusher vers main
git push origin main

# 3. Créer un tag de production (sans suffixe)
git tag -a v1.0.7 -m "Production release"
git push origin v1.0.7
```

**Résultat :**
- ✅ L'app est buildée avec le certificat Developer ID
- ✅ Notarisée auprès d'Apple
- ✅ Publiée sur GitHub Releases en **latest release**
- ✅ `queenmama.co/download` affiche cette version

### Déployer manuellement

1. Aller sur **Actions** → **Build macOS App**
2. Cliquer **Run workflow**
3. Entrer la version (ex: `1.0.7-beta.2`)
4. Cocher "Pre-release" si c'est pour staging
5. Cliquer **Run workflow**

---

## Secrets GitHub Requis

| Secret | Description |
|--------|-------------|
| `APPLE_CERTIFICATE` | Certificat Developer ID Application (.p12) encodé en base64 |
| `APPLE_CERTIFICATE_PASSWORD` | Mot de passe du fichier .p12 |
| `KEYCHAIN_PASSWORD` | Mot de passe aléatoire pour le keychain temporaire |
| `APPLE_ID` | Email du compte Apple Developer (jerome0laval@icloud.com) |
| `APPLE_TEAM_ID` | ID de l'équipe (WNNDDTBPGK) |
| `APPLE_APP_SPECIFIC_PASSWORD` | Mot de passe d'application Apple pour notarisation |

### Générer/Mettre à jour les secrets

```bash
# Encoder le certificat en base64
base64 -i developer_id_application.p12 | pbcopy

# Générer un mot de passe keychain aléatoire
openssl rand -base64 32

# Créer un mot de passe d'application Apple:
# 1. Aller sur https://appleid.apple.com/account/manage
# 2. Section "Mots de passe d'application"
# 3. Générer un nouveau mot de passe
```

---

## Page de Téléchargement

La page `/download` détecte automatiquement l'environnement via le header `host`:

- **Production** (`queenmama.co`) → Affiche la dernière release stable (`/releases/latest`)
- **Staging** (`staging.queenmama.co`) → Affiche les pre-releases beta

Le code de détection se trouve dans `landing/app/download/page.tsx`.

---

## Relation GitHub Actions ↔ Vercel

| Aspect | GitHub Actions | Vercel |
|--------|----------------|--------|
| **Rôle** | CI (Validation) + macOS builds | CD (Déploiement web) |
| **deploy-web.yml** | Vérifie lint, types, build | N/A |
| **build-macos.yml** | Build + notarise app macOS | N/A |
| **Web Deployment** | Ne déploie PAS le web | Déploie automatiquement |
| **Déclencheur** | Push tag `v*` / PR / Push | Push sur main/staging |

**En résumé :**
- **GitHub Actions** = Contrôleur qualité + Builder macOS
- **Vercel** = Déploiement automatique du site web

---

## Troubleshooting

### Le build échoue avec "Segmentation fault: 11"

C'est un bug connu de `xcodebuild -exportArchive` sur Xcode 15.4.
Le workflow utilise maintenant une approche manuelle avec `codesign` pour contourner ce problème.

### La notarisation timeout (> 15 minutes)

**Causes possibles :**
- `APPLE_APP_SPECIFIC_PASSWORD` incorrect ou expiré
- Compte Apple ID n'a pas accepté les dernières conditions Developer
- Serveurs Apple surchargés

**Solution :**
- Vérifier/régénérer le mot de passe d'application
- Le build continue sans notarisation pour permettre les tests
- L'app non-notarisée affichera un avertissement Gatekeeper

### ESLint échoue sur les apostrophes

Dans les fichiers JSX, utiliser `&apos;` au lieu de `'` :

```tsx
// ❌ Incorrect
<p>We'll contact you</p>

// ✅ Correct
<p>We&apos;ll contact you</p>
```

### Comment vérifier si une release est notarisée

```bash
# Monter le DMG et vérifier
spctl -a -vv /Volumes/Queen\ Mama/Queen\ Mama.app
# Doit afficher: "source=Notarized Developer ID"
```

### Le download page ne montre pas la bonne version

- **Production** : Utilise `/releases/latest` (ignore les pre-releases)
- **Staging** : Récupère toutes les releases et prend la plus récente

Vérifier que le tag est bien poussé et que la GitHub Release existe.

---

## Workflow de Développement Recommandé

```
┌─────────────────────────────────────────────────────────┐
│ 1. Développer en local (localhost:3000)                │
│    git commit                                            │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Push sur staging                                     │
│    git push origin staging                              │
│    → GitHub Actions ✅ Valide le code                   │
│    → Vercel 🚀 Deploy sur staging.queenmama.co         │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Pour tester l'app macOS, créer un tag beta          │
│    git tag -a v1.0.X-beta.Y -m "Test release"          │
│    git push origin v1.0.X-beta.Y                       │
│    → GitHub Actions 🔨 Build + Notarize                │
│    → GitHub Release (pre-release)                      │
└──────────────────┬──────────────────────────────────────┘
                   ↓ Si OK
┌─────────────────────────────────────────────────────────┐
│ 4. Merge vers main et tag production                   │
│    git checkout main && git merge staging              │
│    git push origin main                                 │
│    git tag -a v1.0.X -m "Production release"           │
│    git push origin v1.0.X                              │
│    → Vercel 🚀 Deploy sur queenmama.co                 │
│    → GitHub Actions 🔨 Build app production            │
└─────────────────────────────────────────────────────────┘
```

---

## Checklist de Santé CI/CD

- [x] GitHub Actions deploy-web.yml configuré (main + staging)
- [x] GitHub Actions build-macos.yml configuré (tags v*)
- [x] Secrets GitHub configurés (6 secrets)
- [x] Certificat Developer ID Application installé
- [x] Vercel production auto-deploy activé
- [x] Vercel staging auto-deploy activé
- [x] Page download avec détection environnement
- [ ] Notarisation Apple fonctionnelle (en cours de debug)
