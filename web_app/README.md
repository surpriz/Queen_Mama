# Queen Mama LITE

Application cross-platform (macOS, Windows, Linux) de coaching IA en temps réel, construite avec Tauri v2 + React.

## Description

Queen Mama LITE est une version allégée de l'application macOS native Queen Mama. Elle fournit un assistant IA contextuel pendant vos réunions, entretiens et appels, avec transcription en temps réel et suggestions intelligentes.

## Fonctionnalités

- **Transcription en temps réel** - Capture audio microphone avec transcription via Deepgram Nova-3
- **Assistant IA** - Suggestions contextuelles basées sur la conversation (GPT-4, Claude, Gemini)
- **Overlay flottant** - Widget discret toujours visible avec interface compacte/étendue
- **Multi-modes de réponse** :
  - **Assist** - Conseils et suggestions basés sur le contexte
  - **Say** - Propositions de ce que vous pourriez dire
  - **Ask** - Questions de suivi suggérées
  - **Recap** - Résumé de la conversation
- **Raccourcis clavier globaux** - Contrôle rapide sans quitter votre application
- **System tray** - Accès rapide depuis la barre de menus
- **Authentification sécurisée** - Device code flow OAuth

## Limitations vs App Native

| Fonctionnalité | Native macOS | LITE (Tauri) |
|----------------|--------------|--------------|
| Capture micro | ✅ | ✅ |
| Capture audio système | ✅ | ❌ |
| Overlay indétectable | ✅ | ❌ |
| Cross-platform | ❌ | ✅ |

> **Note importante** : Queen Mama LITE ne peut capturer que l'audio du **microphone**, pas l'audio système (YouTube, Zoom audio, etc.). Pour capturer l'audio système, utilisez un outil comme BlackHole ou Loopback pour router l'audio vers une entrée micro virtuelle.

## Prérequis

- Node.js 18+
- Rust (pour Tauri)
- Compte Queen Mama avec abonnement actif
- Backend `landing/` en cours d'exécution sur `localhost:3000`

## Installation

```bash
# Accéder au répertoire
cd web_app

# Installer les dépendances
npm install

# Lancer en mode développement
npm run tauri dev

# Ou construire pour production
npm run tauri build
```

## Configuration

Créez un fichier `.env` à la racine :

```env
VITE_API_URL=http://localhost:3000
```

Pour la production, pointez vers votre backend déployé.

## Utilisation

### Première connexion

1. Lancez l'application
2. Cliquez sur **"Sign In"**
3. Un code s'affiche (ex: `ABCD-1234`)
4. Cliquez sur **"Open Browser"** ou ouvrez manuellement le lien
5. Entrez le code et connectez-vous avec votre compte
6. L'application se connecte automatiquement

### Démarrer une session

1. Cliquez sur le bouton **Play** (▶) dans l'overlay
2. Autorisez l'accès au microphone si demandé
3. Parlez - la transcription apparaît en temps réel
4. Cliquez sur un onglet (Assist, Say, Ask, Recap) pour obtenir des suggestions IA
5. Cliquez sur **Stop** (■) pour terminer la session

### Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| `Cmd/Ctrl + \` | Afficher/masquer l'overlay |
| `Cmd/Ctrl + Enter` | Déclencher l'assistant IA |
| `Cmd/Ctrl + Shift + S` | Démarrer/arrêter la session |
| `Cmd/Ctrl + R` | Effacer le contexte |

### System Tray

Cliquez sur l'icône Queen Mama dans la barre de menus pour :
- Afficher/masquer l'overlay
- Démarrer/arrêter une session
- Ouvrir le dashboard
- Quitter l'application

## Architecture

```
web_app/
├── src/                          # Frontend React
│   ├── components/
│   │   ├── ui/                   # Composants de base (Button, Input, Card, etc.)
│   │   ├── overlay/              # Composants de l'overlay flottant
│   │   ├── dashboard/            # Vue dashboard et paramètres
│   │   └── auth/                 # Authentification (Device Code Flow)
│   ├── services/
│   │   └── audio/                # Capture audio Web Audio API
│   ├── stores/                   # État Zustand
│   │   ├── authStore.ts          # Authentification & tokens JWT
│   │   ├── sessionStore.ts       # Sessions & transcripts
│   │   ├── transcriptionStore.ts # WebSocket Deepgram
│   │   ├── aiStore.ts            # Réponses IA streaming
│   │   └── settingsStore.ts      # Paramètres utilisateur
│   └── windows/
│       ├── main.tsx              # Entry point dashboard
│       └── overlay.tsx           # Entry point overlay
│
├── src-tauri/                    # Backend Rust
│   ├── src/
│   │   ├── main.rs               # Point d'entrée
│   │   ├── lib.rs                # Configuration Tauri
│   │   ├── tray.rs               # System tray menu
│   │   ├── shortcuts.rs          # Raccourcis clavier globaux
│   │   └── window.rs             # Gestion multi-fenêtres
│   └── tauri.conf.json           # Configuration Tauri
│
├── index.html                    # HTML dashboard
├── overlay.html                  # HTML overlay
└── package.json
```

## Scripts npm

```bash
npm run dev          # Serveur Vite dev (frontend seulement)
npm run build        # Build production frontend
npm run tauri dev    # Lancer l'app Tauri en mode dev
npm run tauri build  # Build Tauri pour distribution
```

## Build multi-plateforme

```bash
# macOS (Universal - Intel + Apple Silicon)
npm run tauri build -- --target universal-apple-darwin

# macOS Intel uniquement
npm run tauri build -- --target x86_64-apple-darwin

# macOS Apple Silicon uniquement
npm run tauri build -- --target aarch64-apple-darwin

# Windows
npm run tauri build -- --target x86_64-pc-windows-msvc

# Linux
npm run tauri build -- --target x86_64-unknown-linux-gnu
```

## Dépannage

### "No transcript available"
- Vérifiez que le microphone est bien sélectionné dans **Préférences Système → Son → Entrée**
- Parlez directement dans le micro (l'audio système n'est pas capturé)
- Vérifiez la console développeur pour `[Transcription] WebSocket connected`

### Erreur 401 sur les requêtes API
- Déconnectez-vous et reconnectez-vous
- Vérifiez que le backend `landing/` est en cours d'exécution
- Vérifiez les logs pour les erreurs de token refresh

### L'overlay est trop petit sur écran Retina
- L'application utilise `LogicalSize` pour les écrans HiDPI
- Redémarrez l'application si le problème persiste

### Les raccourcis ne fonctionnent pas (macOS)
- Allez dans **Préférences Système → Sécurité → Confidentialité → Accessibilité**
- Ajoutez Queen Mama LITE à la liste des apps autorisées
- Redémarrez l'application

### Le navigateur ne s'ouvre pas pour l'authentification
- Cliquez manuellement sur le lien affiché
- Vérifiez que le plugin shell est bien configuré

## Technologies

- **Frontend** : React 18, TypeScript, Vite, Tailwind CSS, Zustand, Framer Motion
- **Backend natif** : Tauri v2, Rust
- **Audio** : Web Audio API (getUserMedia)
- **Transcription** : Deepgram Nova-3 via WebSocket
- **IA** : OpenAI GPT-4, Anthropic Claude, Google Gemini (cascade fallback automatique)
- **Authentification** : JWT avec refresh token rotation

## API Backend Utilisées

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/device/code` | Initier le device code flow |
| `POST /api/auth/device/poll` | Poll pour l'autorisation |
| `POST /api/auth/macos/refresh` | Rafraîchir le token d'accès |
| `POST /api/proxy/transcription/token` | Obtenir un token Deepgram |
| `POST /api/proxy/ai/stream` | Streaming des réponses IA (SSE) |

## Licence

Propriétaire - Queen Mama © 2026
