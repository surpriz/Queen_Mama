# 🧹 Cleanup Checklist - Actions Concrètes

**Objectif:** Repartir sur des bases propres avec staging/production bien séparés.

---

## ✅ Checklist d'Actions

### 📦 Étape 1: Générer les Secrets (5 min)

Exécutez ces commandes dans votre terminal:

\`\`\`bash
# AUTH_SECRET pour staging
echo "STAGING AUTH_SECRET:"
openssl rand -base64 32

# AUTH_SECRET pour production (différent!)
echo "PRODUCTION AUTH_SECRET:"
openssl rand -base64 32

# ENCRYPTION_KEY pour staging
echo "STAGING ENCRYPTION_KEY:"
openssl rand -hex 32

# ENCRYPTION_KEY pour production (différent!)
echo "PRODUCTION ENCRYPTION_KEY:"
openssl rand -hex 32
\`\`\`

**✏️ Copiez ces 4 valeurs dans un fichier temporaire** (vous en aurez besoin pour Vercel).

---

### 🗄️ Étape 2: Reset Neon Databases (5 min)

#### 2.1 Reset Staging Database

1. Aller sur https://console.neon.tech
2. Sélectionner votre projet
3. Cliquer sur la branche **"staging"**
4. Aller dans **SQL Editor**
5. Exécuter ce SQL:

\`\`\`sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO neondb_owner;
\`\`\`

6. ✅ Base staging maintenant vide

#### 2.2 Reset Production Database

1. Retourner aux branches
2. Cliquer sur la branche **"production"**
3. Aller dans **SQL Editor**
4. Exécuter le MÊME SQL:

\`\`\`sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO neondb_owner;
\`\`\`

5. ✅ Base production maintenant vide

#### 2.3 Récupérer les URLs de Connection

**Staging:**
- Branch: staging
- Connection string: `postgresql://neondb_owner:npg_q2vAHUQw5dle@ep-morning-hall-agre1cks-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`

**Production:**
- Branch: production
- Aller dans la branche → Connection Details → copier l'URL

---

### 💳 Étape 3: Configurer Stripe (15 min)

#### 3.1 Vérifier Test Mode (Staging)

1. Aller sur https://dashboard.stripe.com
2. **Basculer en Test Mode** (toggle en haut à droite)
3. Vérifier que vous avez:
   - ✅ API Keys (sk_test_... et pk_test_...)
   - ✅ Products (PRO et ENTERPRISE)
   - ✅ Price IDs

#### 3.2 Créer Webhook Staging

1. Toujours en **Test Mode**
2. **Developers** → **Webhooks** → **Add Endpoint**
3. **Endpoint URL:** `https://staging.queenmama.co/api/webhooks/stripe`
4. **Events to send:**
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. **Add endpoint**
6. **Copier le Signing Secret** (commence par `whsec_`)

#### 3.3 Activer Live Mode (Production)

1. **Basculer en Live Mode** (toggle)
2. **Developers** → **API Keys**
3. **Copier:**
   - Secret key: `sk_live_...`
   - Publishable key: `pk_live_...`

#### 3.4 Créer Products Live Mode

1. **Products** → **Create Product**

**Product 1: Queen Mama PRO**
- Name: Queen Mama PRO
- Description: Professional AI coaching assistant
- Pricing: Recurring
  - Price: 29.00 EUR
  - Billing period: Monthly
- Save → **Copier le Price ID** (`price_...`)

**Product 2: Queen Mama ENTERPRISE**
- Name: Queen Mama ENTERPRISE
- Description: Premium AI coaching with priority support
- Pricing: Recurring
  - Price: 99.00 EUR
  - Billing period: Monthly
- Save → **Copier le Price ID** (`price_...`)

#### 3.5 Créer Webhook Production

1. Toujours en **Live Mode**
2. **Developers** → **Webhooks** → **Add Endpoint**
3. **Endpoint URL:** `https://queenmama.co/api/webhooks/stripe`
4. **Events to send:** (mêmes que staging)
5. **Add endpoint**
6. **Copier le Signing Secret** (commence par `whsec_`)

---

### 🔐 Étape 4: OAuth Apps (15 min)

#### 4.1 GitHub OAuth - Staging

1. https://github.com/settings/developers
2. **OAuth Apps** → **New OAuth App**
3. Remplir:
   - **Application name:** Queen Mama Staging
   - **Homepage URL:** `https://staging.queenmama.co`
   - **Authorization callback URL:** `https://staging.queenmama.co/api/auth/callback/github`
4. **Register application**
5. **Copier:**
   - Client ID
   - Client secrets → **Generate a new client secret** → Copier

#### 4.2 GitHub OAuth - Production

1. **New OAuth App**
2. Remplir:
   - **Application name:** Queen Mama
   - **Homepage URL:** `https://queenmama.co`
   - **Authorization callback URL:** `https://queenmama.co/api/auth/callback/github`
3. **Register application**
4. **Copier:**
   - Client ID
   - Client secrets → **Generate a new client secret** → Copier

#### 4.3 Google OAuth - Staging

1. https://console.cloud.google.com/apis/credentials
2. **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: **Queen Mama Staging**
5. **Authorized redirect URIs:**
   - `https://staging.queenmama.co/api/auth/callback/google`
6. **Create**
7. **Copier:** Client ID et Client Secret

#### 4.4 Google OAuth - Production

1. **Create Credentials** → **OAuth client ID**
2. Application type: **Web application**
3. Name: **Queen Mama**
4. **Authorized redirect URIs:**
   - `https://queenmama.co/api/auth/callback/google`
5. **Create**
6. **Copier:** Client ID et Client Secret

---

### ⚙️ Étape 5: Configurer Vercel Staging (10 min)

1. Aller sur https://vercel.com/queen-mama-staging

#### 5.1 Changer la Git Branch

1. **Settings** → **Git**
2. **Production Branch:** Changer de `main` à `staging`
3. **Save**

#### 5.2 Configurer les Variables d'Environnement

1. **Settings** → **Environment Variables**
2. **Supprimer toutes les variables existantes** (pour repartir propre)
3. **Ajouter ces variables UNE PAR UNE:**

\`\`\`
DATABASE_URL = postgresql://neondb_owner:npg_q2vAHUQw5dle@ep-morning-hall-agre1cks-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

AUTH_SECRET = [Valeur générée à l'étape 1 - STAGING]
AUTH_TRUST_HOST = true
NEXTAUTH_URL = https://staging.queenmama.co
NEXT_PUBLIC_APP_URL = https://staging.queenmama.co

AUTH_GITHUB_ID = [GitHub OAuth Staging Client ID]
AUTH_GITHUB_SECRET = [GitHub OAuth Staging Client Secret]

AUTH_GOOGLE_ID = [Google OAuth Staging Client ID]
AUTH_GOOGLE_SECRET = [Google OAuth Staging Client Secret]

STRIPE_SECRET_KEY = sk_test_51QgfmL2LA3EbnLECw1...
STRIPE_PUBLISHABLE_KEY = pk_test_51QgfmL2LA3EbnLECW...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_test_51QgfmL2LA3EbnLECW...
STRIPE_WEBHOOK_SECRET = [Webhook secret staging de l'étape 3.2]
STRIPE_PRO_PRICE_ID = price_1Qgfy22LA3EbnLECPa4lLBxG
STRIPE_ENTERPRISE_PRICE_ID = price_1Qgfy32LA3EbnLECA7a2vPYa

ENCRYPTION_KEY = [Valeur générée à l'étape 1 - STAGING]
\`\`\`

4. **Cliquer "Save" pour chaque variable**

#### 5.3 Redéployer

1. **Deployments**
2. Dernier déploiement → **...** → **Redeploy**

---

### ⚙️ Étape 6: Configurer Vercel Production (10 min)

1. Aller sur https://vercel.com/queen-mama

#### 6.1 Configurer les Variables d'Environnement

1. **Settings** → **Environment Variables**
2. **Mettre à jour TOUTES les variables:**

\`\`\`
DATABASE_URL = [URL de la branche production Neon - à copier depuis Neon]

AUTH_SECRET = [Valeur générée à l'étape 1 - PRODUCTION - DIFFÉRENTE DE STAGING]
AUTH_TRUST_HOST = true
NEXTAUTH_URL = https://queenmama.co
NEXT_PUBLIC_APP_URL = https://queenmama.co

AUTH_GITHUB_ID = [GitHub OAuth Production Client ID]
AUTH_GITHUB_SECRET = [GitHub OAuth Production Client Secret]

AUTH_GOOGLE_ID = [Google OAuth Production Client ID]
AUTH_GOOGLE_SECRET = [Google OAuth Production Client Secret]

STRIPE_SECRET_KEY = sk_live_[de l'étape 3.3]
STRIPE_PUBLISHABLE_KEY = pk_live_[de l'étape 3.3]
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_[de l'étape 3.3]
STRIPE_WEBHOOK_SECRET = [Webhook secret production de l'étape 3.5]
STRIPE_PRO_PRICE_ID = price_[Live Mode de l'étape 3.4]
STRIPE_ENTERPRISE_PRICE_ID = price_[Live Mode de l'étape 3.4]

ENCRYPTION_KEY = [Valeur générée à l'étape 1 - PRODUCTION - DIFFÉRENTE DE STAGING]
\`\`\`

3. **Sauvegarder chaque variable**

#### 6.2 Redéployer

1. **Deployments**
2. Dernier déploiement → **...** → **Redeploy**

---

### 🗄️ Étape 7: Appliquer les Migrations Prisma (5 min)

Dans votre terminal:

\`\`\`bash
cd /Users/jeromelaval-externe/Desktop/Queen_Mama/landing

# Appliquer sur staging
DATABASE_URL="postgresql://neondb_owner:npg_q2vAHUQw5dle@ep-morning-hall-agre1cks-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" npx prisma migrate deploy

# Appliquer sur production (remplacer par votre URL production)
DATABASE_URL="[URL-production]" npx prisma migrate deploy
\`\`\`

---

### ✅ Étape 8: Tests (10 min)

#### Test Staging

1. **Ouvrir:** https://staging.queenmama.co
2. **Créer un compte** (email/password)
3. **Se connecter**
4. **Aller dans Settings** → Tester une souscription
5. **Utiliser la carte de test:** `4242 4242 4242 4242`
   - CVC: n'importe quoi (123)
   - Date: future (12/34)
6. **Vérifier:** Aucun vrai paiement n'est fait
7. **Vérifier Stripe Dashboard (Test Mode):** Le paiement apparaît

#### Test Production (NE PAS TESTER LES PAIEMENTS)

1. **Ouvrir:** https://queenmama.co
2. **Créer un compte**
3. **Se connecter**
4. **Vérifier:** Le site charge correctement
5. ⚠️ **NE PAS tester les paiements** (mode live!)

---

## 📝 Résumé de ce qui sera fait

Après avoir suivi ce checklist:

### ✅ Staging (Test)
- Database: Neon staging branch (vide, prête)
- Stripe: Test Mode avec vos clés actuelles
- OAuth: Apps staging séparées
- Domaine: staging.queenmama.co
- Sécurisé: Aucun vrai paiement possible

### ✅ Production (Live)
- Database: Neon production branch (vide, prête)
- Stripe: Live Mode avec nouvelles clés
- OAuth: Apps production séparées
- Domaine: queenmama.co
- Prêt pour vrais utilisateurs

### ✅ Séparation Claire
- Environnements totalement isolés
- Aucune confusion possible
- Safe pour tester
- Prêt pour la vraie prod

---

## ⏱️ Temps Estimé Total

- Générer secrets: 5 min
- Reset databases: 5 min
- Stripe config: 15 min
- OAuth apps: 15 min
- Vercel staging: 10 min
- Vercel production: 10 min
- Prisma migrations: 5 min
- Tests: 10 min

**TOTAL: ~1h15**

---

## 🆘 Si Problème

**Je suis bloqué à l'étape X:**
→ Me montrer un screenshot de l'erreur

**Une variable ne fonctionne pas:**
→ Vérifier qu'elle est dans le bon environnement (staging vs production)

**Stripe ne marche pas:**
→ Vérifier que Test Mode = Staging, Live Mode = Production

**OAuth redirect error:**
→ Vérifier que l'URL callback est EXACTEMENT la même
