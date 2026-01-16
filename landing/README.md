# Queen Mama - Landing Page & Dashboard

Application Next.js fullstack (frontend + backend API) pour la landing page et le tableau de bord utilisateur de Queen Mama.

## Architecture

Cette application Next.js combine :

- **Frontend** : Pages React avec Tailwind CSS et Framer Motion
- **Backend** : API Routes Next.js pour l'authentification, la gestion des API keys, et Stripe
- **Database** : PostgreSQL via Prisma ORM
- **Authentication** : NextAuth.js v5 (credentials + OAuth providers)
- **Payments** : Stripe pour les abonnements

## Stack Technique

- **Framework** : Next.js 16.1.1 (App Router)
- **React** : 19.2.3
- **TypeScript** : 5.x
- **Database ORM** : Prisma 5.22
- **Authentication** : NextAuth.js 5.0 (beta)
- **Styling** : Tailwind CSS 4.x
- **Animations** : Framer Motion 12.x
- **Payments** : Stripe 20.x
- **Validation** : Zod 4.x

## Prerequisites

- Node.js 20+ (recommandé : 20.x LTS)
- PostgreSQL database (local ou cloud, ex: Neon, Supabase)
- Compte Stripe (pour les abonnements)
- Variables d'environnement configurées

## Installation

### 1. Installer les dépendances

```bash
cd landing
npm install
```

### 2. Configurer les variables d'environnement

Créer un fichier `.env` à la racine de `landing/` :

```env
# Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="votre-secret-genere-avec-openssl-rand-base64-32"

# Encryption (pour les API keys utilisateurs)
ENCRYPTION_KEY="votre-cle-32-caracteres-minimum"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# OAuth Providers (optionnel)
# Google
GOOGLE_CLIENT_ID="votre-google-client-id"
GOOGLE_CLIENT_SECRET="votre-google-client-secret"

# GitHub
GITHUB_CLIENT_ID="votre-github-client-id"
GITHUB_CLIENT_SECRET="votre-github-client-secret"
```

#### Générer les secrets :

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# ENCRYPTION_KEY (32 caractères minimum)
openssl rand -base64 32 | cut -c1-32
```

### 3. Configurer la base de données

```bash
# Créer les tables dans PostgreSQL
npx prisma migrate dev --name init

# Générer le client Prisma
npx prisma generate

# (Optionnel) Visualiser la base de données
npx prisma studio
```

### 4. Démarrer le serveur de développement

```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

## Scripts Disponibles

```bash
# Développement
npm run dev          # Démarre le serveur de développement

# Production
npm run build        # Compile l'application pour la production
npm start            # Démarre le serveur de production

# Linting
npm run lint         # Vérifie le code avec ESLint

# Database
npx prisma studio    # Interface graphique pour la base de données
npx prisma migrate dev --name <nom>  # Créer une nouvelle migration
npx prisma generate  # Régénérer le client Prisma après modification du schema
```

## Structure du Projet

```
landing/
├── app/                      # App Router Next.js
│   ├── page.tsx             # Page d'accueil (landing page)
│   ├── sign-in/             # Page de connexion
│   ├── sign-up/             # Page d'inscription
│   ├── dashboard/           # Pages du tableau de bord (protégées)
│   └── api/                 # API Routes
│       ├── auth/            # NextAuth.js endpoints
│       ├── api-keys/        # Gestion des API keys
│       ├── subscription/    # Gestion Stripe
│       └── webhooks/        # Webhooks Stripe
├── components/              # Composants React
│   ├── ui/                 # Composants UI réutilisables
│   ├── auth/               # Composants d'authentification
│   └── dashboard/          # Composants du dashboard
├── lib/                    # Utilitaires et configurations
│   ├── auth.ts            # Configuration NextAuth.js
│   ├── stripe.ts          # Configuration Stripe
│   ├── encryption.ts      # Chiffrement des API keys
│   └── validations.ts     # Schémas Zod de validation
├── prisma/
│   └── schema.prisma      # Schéma de base de données
├── types/                 # Types TypeScript
│   └── next-auth.d.ts     # Extensions NextAuth
├── middleware.ts          # Middleware d'authentification
└── public/               # Assets statiques
```

## Fonctionnalités

### ✅ Implémentées

- 🔐 **Authentification** : Credentials + OAuth (Google, GitHub)
- 👤 **Gestion des utilisateurs** : Inscription, connexion, profil
- 🔑 **API Keys** : Stockage chiffré des clés d'API (OpenAI, Anthropic, Deepgram, etc.)
- 💳 **Abonnements Stripe** : Plans FREE et PRO
- 📊 **Dashboard** : Interface utilisateur pour gérer son compte
- 🔒 **Sécurité** : Middleware de protection des routes, chiffrement AES-256-GCM

### 🚧 En développement

- 📈 **Analytics** : Tracking des usages et coûts
- 🔄 **Sync Sessions** : Synchronisation des sessions depuis l'app macOS
- 📧 **Email** : Notifications et confirmation d'email
- 🎨 **UI/UX** : Amélioration de l'interface

## Database Schema

Le schéma Prisma définit les modèles suivants :

- **User** : Utilisateurs du système
- **Account** : Comptes OAuth liés
- **Session** : Sessions NextAuth.js
- **ApiKey** : Clés d'API chiffrées (providers : OpenAI, Anthropic, Gemini, Deepgram, Grok)
- **Subscription** : Abonnements Stripe (FREE, PRO)
- **Invoice** : Factures Stripe
- **SyncedSession** : Sessions synchronisées depuis l'app macOS
- **UsageLog** : Logs d'utilisation et coûts

## Configuration OAuth

### Google OAuth

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un projet et activer l'API OAuth 2.0
3. Configurer l'écran de consentement
4. Créer des identifiants OAuth 2.0
5. Ajouter les URI de redirection :
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://votre-domaine.com/api/auth/callback/google` (prod)

### GitHub OAuth

1. Aller sur [GitHub Developer Settings](https://github.com/settings/developers)
2. Créer une nouvelle OAuth App
3. Configurer les URLs :
   - Homepage URL : `http://localhost:3000` (dev)
   - Authorization callback URL : `http://localhost:3000/api/auth/callback/github` (dev)

## Stripe Configuration

### Plans disponibles

- **FREE** : Plan gratuit avec limitations
- **PRO** : Plan payant avec accès complet

### Configurer les webhooks Stripe

1. Installer Stripe CLI : `brew install stripe/stripe-cli/stripe`
2. Se connecter : `stripe login`
3. Écouter les webhooks localement :
```bash
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```
4. Copier le webhook secret généré dans `.env` (`STRIPE_WEBHOOK_SECRET`)

## Troubleshooting

### Erreur : "No such file or directory, open package.json"

Vous devez être dans le répertoire `landing/` pour exécuter les commandes npm :

```bash
cd landing
npm run dev
```

### Erreur de connexion à la base de données

Vérifiez que :
1. PostgreSQL est démarré
2. Le `DATABASE_URL` dans `.env` est correct
3. Vous avez exécuté `npx prisma migrate dev`

### Erreur NextAuth : "Invalid session"

Vérifiez que :
1. `NEXTAUTH_SECRET` est défini dans `.env`
2. `NEXTAUTH_URL` correspond à votre URL locale/production

### Erreur Prisma : "Environment variable not found"

Assurez-vous que le fichier `.env` est à la racine de `landing/` et non à la racine du projet.

## Deployment

### Vercel (recommandé)

1. Connecter votre repository GitHub à Vercel
2. Configurer les variables d'environnement dans Vercel
3. Déployer automatiquement à chaque push

```bash
npm run build  # Test local du build de production
```

### Variables d'environnement de production

N'oubliez pas de configurer toutes les variables d'environnement sur votre plateforme de déploiement :
- `DATABASE_URL` (utiliser une base PostgreSQL en production)
- `NEXTAUTH_URL` (URL de production)
- `NEXTAUTH_SECRET`
- `ENCRYPTION_KEY`
- Toutes les clés OAuth et Stripe

## Support

Pour toute question ou problème, référez-vous à la documentation :
- [Next.js](https://nextjs.org/docs)
- [Prisma](https://www.prisma.io/docs)
- [NextAuth.js](https://next-auth.js.org/)
- [Stripe](https://stripe.com/docs)

---

**Note** : Ce projet est en développement actif. Consultez le README principal pour plus d'informations sur l'application macOS.
