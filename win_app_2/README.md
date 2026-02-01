# Queen Mama - Windows App

Application Electron pour Windows avec authentification Google OAuth et interface de coaching IA en temps réel.

## Prérequis

- Node.js 18+
- Backend `landing/` en cours d'exécution sur `localhost:3000`

## Démarrage rapide

### 1. Démarrer le backend (landing/)

```bash
cd ../landing
npm run dev
```

### 2. Démarrer l'app Windows

```bash
cd win_app_2

# Installation des dépendances (première fois uniquement)
npm install

# Mode développement (pointe vers localhost:3000)
VITE_APP_ENV=development npm run dev
```

**Important :** Sans `VITE_APP_ENV=development`, l'app pointe vers la production (`https://queenmama.ai`).

## Configuration du backend

Le backend (`landing/.env`) doit contenir les credentials Google OAuth Desktop :

```env
# Desktop OAuth (pour l'app Windows Electron - loopback redirect)
AUTH_GOOGLE_DESKTOP_CLIENT_ID="votre-client-id.apps.googleusercontent.com"
AUTH_GOOGLE_DESKTOP_CLIENT_SECRET="votre-client-secret"
```

Ces credentials doivent correspondre au Client ID dans `src/services/auth/googleAuthService.ts`.

## Architecture

```
win_app_2/
├── electron/           # Main process Electron
│   ├── main.ts         # Point d'entrée principal
│   ├── preload.ts      # Bridge sécurisé renderer ↔ main
│   ├── ipc/            # Handlers IPC
│   │   ├── channels.ts # Définition des canaux
│   │   └── handlers.ts # Implémentation des handlers
│   ├── services/
│   │   └── oauthServer.ts  # Serveur loopback pour OAuth
│   ├── db/             # SQLite avec better-sqlite3
│   └── windows/        # Gestion des fenêtres
├── src/                # Renderer process (React)
│   ├── components/     # Composants UI
│   ├── pages/          # Pages de l'application
│   ├── services/
│   │   ├── auth/       # Authentification
│   │   │   ├── authenticationManager.ts  # Orchestrateur auth
│   │   │   ├── authApiClient.ts          # Client API
│   │   │   └── googleAuthService.ts      # OAuth Google PKCE
│   │   └── config/
│   │       └── appEnvironment.ts  # Configuration env
│   └── stores/         # Zustand stores
└── package.json
```

## Flux d'authentification Google

1. L'app démarre un serveur HTTP local sur un port aléatoire (`oauthServer.ts`)
2. Ouvre le navigateur système vers Google OAuth avec redirect_uri = `http://127.0.0.1:PORT/callback`
3. L'utilisateur s'authentifie sur Google
4. Google redirige vers le serveur local avec le code d'autorisation
5. Le serveur envoie le code au renderer via IPC
6. Le renderer échange le code avec le backend (`/api/auth/macos/google-callback`)
7. Le backend échange le code avec Google et retourne les tokens

## Environnements

| Environnement | API Base URL | Variable |
|---------------|--------------|----------|
| development | `http://localhost:3000` | `VITE_APP_ENV=development` |
| staging | `https://staging.queenmama.ai` | `VITE_APP_ENV=staging` |
| production | `https://queenmama.ai` | `VITE_APP_ENV=production` (défaut) |

## Scripts disponibles

```bash
npm run dev          # Développement avec hot-reload
npm run build        # Build de production
npm run package:win  # Créer l'installateur Windows
npm run test         # Tests unitaires (Vitest)
npm run test:e2e     # Tests E2E (Playwright)
npm run lint         # Linter ESLint
npm run typecheck    # Vérification TypeScript
```

## Problèmes connus

### Erreurs Sentry (non-bloquantes)

```
[Renderer ERROR] Sentry SDK failed to establish connection with the Electron main process.
```

Ces erreurs apparaissent car Sentry n'est pas initialisé dans le main process. Elles n'affectent pas le fonctionnement de l'app. Pour les corriger, initialiser `@sentry/electron` dans `electron/main.ts`.

### "Failed to fetch" lors de l'auth

Vérifier que :
1. Le backend tourne sur `localhost:3000`
2. `VITE_APP_ENV=development` est défini
3. Les credentials Google Desktop sont dans `landing/.env`

## Base de données locale

L'app utilise SQLite (better-sqlite3) pour le stockage local :
- Sessions
- Transcriptions
- Modes personnalisés
- Préférences utilisateur

Les données sont stockées dans `%APPDATA%/queenmama-windows/`.

## Technologies

- **Electron 33** - Framework desktop
- **React 18** - UI
- **Vite** - Build tool
- **TypeScript** - Typage
- **Tailwind CSS** - Styles
- **Zustand** - State management
- **better-sqlite3** - Base de données locale
- **Drizzle ORM** - ORM pour SQLite
