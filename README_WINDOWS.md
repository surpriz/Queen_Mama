# Queen Mama - Windows App (Electron)

Guide complet pour l'installation, la configuration et l'exécution de l'application Queen Mama sur Windows.

---

## Table des matières

1. [Prérequis](#prérequis)
2. [Architecture du projet](#architecture-du-projet)
3. [Installation](#installation)
4. [Configuration des variables d'environnement](#configuration-des-variables-denvironnement)
5. [Lancement en développement](#lancement-en-développement)
6. [Raccourcis clavier](#raccourcis-clavier)
7. [Build & Packaging](#build--packaging)
8. [Base de données](#base-de-données)
9. [Fonctionnalités principales](#fonctionnalités-principales)
10. [Dépannage](#dépannage)

---

## Prérequis

| Outil | Version minimale | Lien |
|-------|------------------|------|
| **Node.js** | 18.x+ (LTS recommandé) | https://nodejs.org/ |
| **npm** | 9.x+ (livré avec Node.js) | - |
| **Git** | 2.x+ | https://git-scm.com/ |
| **PostgreSQL** | 15+ (pour le backend local) | https://www.postgresql.org/ |
| **Windows** | 10/11 (x64) | - |

> **Note** : Python et les Visual Studio Build Tools peuvent être nécessaires pour compiler `better-sqlite3` (dépendance native). Si `npm install` échoue sur cette étape :
> ```bash
> npm install -g windows-build-tools
> ```

---

## Architecture du projet

Le projet est composé de **2 services** qui doivent tourner simultanément :

```
Queen_Mama/
├── landing/          ← Backend Next.js (port 3000) + WebSocket Proxy (port 3001)
├── win_app_2/        ← Application Electron (Vite + React + TypeScript)
├── mac_app/          ← App macOS native Swift (référence, ne pas modifier)
└── README_WINDOWS.md ← Ce fichier
```

### Flux de données

```
┌─────────────────────────────────────────────────────────┐
│  Electron App (win_app_2)                               │
│  ┌──────────────┐     ┌──────────────────┐              │
│  │  Dashboard    │────▶│  Overlay Widget  │              │
│  │  (main window)│◀────│  (always on top) │              │
│  └──────┬───────┘     └───────┬──────────┘              │
│         │    IPC relay        │                          │
│         └─────────┬───────────┘                          │
│                   │                                      │
│         ┌─────────▼──────────┐                           │
│         │  SQLite (local DB) │                           │
│         └────────────────────┘                           │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP + WebSocket
          ┌──────────▼──────────┐
          │  Backend (landing)  │
          │  :3000 API REST     │
          │  :3001 WS Proxy     │──────▶ Deepgram (transcription)
          │                     │──────▶ OpenAI / Anthropic / Gemini / Grok (IA)
          └─────────────────────┘
```

---

## Installation

### 1. Cloner le repository

```bash
git clone https://github.com/surpriz/Queen_Mama.git
cd Queen_Mama
git checkout version_windows
```

### 2. Installer les dépendances du backend

```bash
cd landing
npm install
```

### 3. Configurer la base de données PostgreSQL (backend)

```bash
# Générer le client Prisma
npx prisma generate

# Pousser le schéma vers la base de données
npx prisma db push
```

### 4. Installer les dépendances de l'app Electron

```bash
cd ../win_app_2
npm install
```

---

## Configuration des variables d'environnement

### Backend (`landing/.env.local`)

Créer le fichier `landing/.env.local` à partir du template :

```bash
cd landing
cp .env.example .env.local
```

Renseigner les valeurs suivantes :

```env
# === OBLIGATOIRE ===

# Base de données PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/queenmama"

# Secret NextAuth (générer avec : openssl rand -base64 32)
AUTH_SECRET="votre-secret-ici"

# Chiffrement des clés API en base (générer avec : openssl rand -hex 32)
ENCRYPTION_KEY="votre-cle-hex-ici"

# JWT pour l'authentification device (générer avec : openssl rand -base64 32)
JWT_SECRET="votre-jwt-secret-ici"

# Licence (générer avec : openssl rand -hex 32)
LICENSE_SECRET="votre-license-secret-ici"

# URL de l'app
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# === CLÉS API IA (au moins une obligatoire) ===

DEEPGRAM_API_KEY="votre-clé-deepgram"          # Transcription (obligatoire)
OPENAI_API_KEY="votre-clé-openai"              # GPT-4o
ANTHROPIC_API_KEY="votre-clé-anthropic"        # Claude
GEMINI_API_KEY=""                               # Optionnel
XAI_API_KEY=""                                  # Optionnel (Grok)

# === OPTIONNEL ===

# OAuth Google (pour login web)
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

# Stripe (billing)
STRIPE_SECRET_KEY=""
STRIPE_PUBLISHABLE_KEY=""
STRIPE_WEBHOOK_SECRET=""

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=""
NEXT_PUBLIC_POSTHOG_HOST="https://eu.i.posthog.com"
```

> **Important** : Au minimum, il faut `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `JWT_SECRET`, `LICENSE_SECRET`, `DEEPGRAM_API_KEY` et au moins une clé IA (OpenAI ou Anthropic).

### Application Electron (`win_app_2/.env`)

Créer le fichier `win_app_2/.env` à partir du template :

```bash
cd win_app_2
cp .env.example .env
```

```env
# Environnement : development | staging | production
# development = http://localhost:3000 (backend local)
# staging     = https://staging.queenmama.ai
# production  = https://queenmama.ai
VITE_APP_ENV=development

# Google OAuth Client ID (type "Desktop" dans Google Cloud Console)
# Doit supporter les redirects loopback (http://127.0.0.1:PORT/callback)
VITE_GOOGLE_CLIENT_ID=votre-client-id.apps.googleusercontent.com
```

| Environnement | Backend utilisé | Cas d'usage |
|---------------|-----------------|-------------|
| `development` | `http://localhost:3000` | Dev local avec backend local |
| `staging` | `https://staging.queenmama.ai` | Tests avec backend staging |
| `production` | `https://queenmama.ai` | Production |

---

## Lancement en développement

**3 services doivent tourner simultanément** dans des terminaux séparés :

### Terminal 1 — Backend + WebSocket Proxy

```bash
cd landing
npm run dev
```

Cela lance :
- **Next.js** sur le port `3000` (API REST + pages web)
- **WebSocket Proxy** sur le port `3001` (proxy vers Deepgram pour la transcription)

### Terminal 2 — Application Electron

```bash
cd win_app_2
npm run dev
```

Cela lance :
- Le script `cleanup.js` (tue les processus stale sur les ports 5173-5175)
- **electron-vite** en mode dev (hot reload)
- Ouvre le **Dashboard** (fenêtre principale) et l'**Overlay** (widget flottant)

### Vérification

| Service | URL / Port | Vérification |
|---------|------------|-------------|
| Backend API | http://localhost:3000 | Page web s'affiche |
| WebSocket Proxy | ws://localhost:3001 | Logs dans le terminal |
| Electron Dev Server | http://localhost:5173 | Dashboard Electron s'ouvre |

---

## Raccourcis clavier

| Action | Raccourci | Description |
|--------|-----------|-------------|
| Toggle session | `Ctrl+Shift+S` | Démarrer / arrêter la session d'écoute |
| Toggle widget | `Ctrl+Shift+H` | Afficher / masquer l'overlay |
| Demander à l'IA | `Ctrl+Enter` | Envoyer le contexte actuel à l'IA |
| Effacer le contexte | `Ctrl+Shift+R` | Réinitialiser le transcript et le contexte |
| Déplacer le widget | `Ctrl+Flèches` | Repositionner l'overlay à l'écran |

> Les raccourcis utilisent `Ctrl+Shift` pour être compatibles avec les claviers AZERTY.

---

## Build & Packaging

### Build de production

```bash
cd win_app_2

# Build Vite (main + preload + renderer)
npm run build

# Packager l'installeur Windows (.exe NSIS)
npm run package:win
```

L'installeur sera généré dans `win_app_2/dist/`.

### Scripts disponibles

| Script | Commande | Description |
|--------|----------|-------------|
| `dev` | `npm run dev` | Mode développement avec hot reload |
| `build` | `npm run build` | Build de production (electron-vite) |
| `package` | `npm run package` | Build + packaging (toutes plateformes) |
| `package:win` | `npm run package:win` | Build + packaging Windows uniquement |
| `test` | `npm run test` | Lancer les tests unitaires (Vitest) |
| `test:watch` | `npm run test:watch` | Tests en mode watch |
| `typecheck` | `npm run typecheck` | Vérification TypeScript |
| `lint` | `npm run lint` | ESLint |

---

## Base de données

### Backend (PostgreSQL via Prisma)

Le backend utilise PostgreSQL avec Prisma ORM. Tables principales :

- `User` — Comptes utilisateurs (email, password hashé, rôle)
- `Device` — Appareils enregistrés (deviceId, platform, version)
- `AdminApiKey` — Clés API IA chiffrées (OpenAI, Anthropic, Deepgram, etc.)
- `Subscription` — Abonnements (FREE / PRO / ENTERPRISE)
- `SyncedSession` — Sessions synchronisées depuis les apps
- `KnowledgeAtom` — Base de connaissances extraite des sessions

```bash
# Commandes Prisma utiles
npx prisma studio          # Interface web pour explorer la DB
npx prisma db push         # Pousser le schéma vers la DB
npx prisma migrate dev     # Créer une migration
npx prisma generate        # Regénérer le client
```

### App Electron (SQLite local)

L'app Electron utilise SQLite (via `better-sqlite3` + Drizzle ORM) pour le stockage local :

- **Emplacement** : `%AppData%/queenmama-windows/queenmama.db`
- **Mode WAL** activé pour les performances
- Tables : `sessions`, `transcript_entries`, `ai_responses`, `modes`, `contacts`

---

## Fonctionnalités principales

### Modes IA

| Mode | Description |
|------|-------------|
| **Default** | Assistant général polyvalent |
| **Interview** | Coaching entretien (méthode STAR, réponses techniques) |
| **Sales** | Aide commerciale (objections, closing, proposition de valeur) |
| **Professional** | Réunions business (clarté, professionnalisme) |
| **Custom** | Mode personnalisé avec instructions utilisateur |

### Types de réponses

| Type | Description |
|------|-------------|
| `say` | Réponse directe à formuler |
| `ask` | Question à poser |
| `tip` | Conseil tactique |
| `warning` | Alerte (temps, ton, sujet sensible) |
| `recap` | Résumé de la conversation |

### Cascade IA (fallback automatique)

Si un provider IA échoue, le système bascule automatiquement :

```
OpenAI (GPT-4o) → Anthropic (Claude) → Gemini → Grok
```

### Overlay indétectable

L'overlay utilise `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` pour être **invisible** lors du partage d'écran sur Zoom, Teams, Meet, etc.

### Transcription temps réel

- **Provider** : Deepgram Nova-3
- **Mode** : `language=multi` (multilingue, code-switching)
- **Latence** : < 2 secondes
- **Audio** : Microphone + audio système (capturé via `desktopCapturer`)

---

## Dépannage

### Conflits de ports

Si les ports 3000, 3001, ou 5173 sont déjà occupés :

```bash
# Trouver le processus sur un port
netstat -ano | findstr :3000

# Tuer le processus
taskkill /F /PID <PID>
```

### Erreur `better-sqlite3` à l'installation

```bash
# Installer les build tools Windows
npm install -g windows-build-tools

# Ou manuellement
npm rebuild better-sqlite3
```

### Lock file Next.js

Si le backend refuse de démarrer :

```bash
# Supprimer le lock file
rm landing/.next/dev/lock
```

### Erreurs Sentry IPC en mode dev

Les erreurs Sentry liées à l'IPC en mode développement sont **normales** et peuvent être ignorées.

### L'overlay ne s'affiche pas

1. Vérifier que le widget n'est pas masqué : `Ctrl+Shift+H`
2. Vérifier les logs dans la console Electron (DevTools)

### La transcription ne fonctionne pas

1. Vérifier que le backend tourne (port 3000 + 3001)
2. Vérifier que `DEEPGRAM_API_KEY` est configuré dans `landing/.env.local`
3. Vérifier les permissions microphone de Windows

### Les réponses IA ne fonctionnent pas

1. Vérifier qu'au moins une clé API IA est configurée dans `landing/.env.local`
2. Tester la connexion : le dashboard affiche les providers disponibles dans Settings
3. Vérifier les logs du backend (terminal 1)

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Framework desktop | Electron 33 |
| Build system | electron-vite 5 + Vite 6 |
| Frontend | React 18, TypeScript 5.7 |
| State management | Zustand 4.5 |
| Styling | Tailwind CSS 3.4 |
| DB locale | better-sqlite3 + Drizzle ORM |
| Backend | Next.js 16, Prisma, PostgreSQL |
| Auth | NextAuth v5 (JWT) + Device Auth (JWT) |
| Transcription | Deepgram Nova-3 (WebSocket) |
| IA | OpenAI, Anthropic, Google Gemini, xAI Grok |
| Analytics | PostHog |
| Monitoring | Sentry |
| Auto-update | electron-updater |
| Packaging | electron-builder (NSIS) |
