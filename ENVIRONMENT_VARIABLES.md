# Environment Variables - Master Reference

**IMPORTANT:** Ce document est la source de vérité pour la configuration des environnements.

---

## 📋 Quick Reference

| Variable | Staging | Production | Notes |
|----------|---------|------------|-------|
| Domain | staging.queenmama.co | queenmama.co | - |
| Git Branch | `staging` | `main` | - |
| Vercel Project | queen-mama-staging | queen-mama | - |
| Neon Branch | staging | production | - |
| Stripe Mode | **TEST MODE** | **LIVE MODE** | ⚠️ CRITICAL |
| OAuth Apps | Separate staging apps | Separate prod apps | Different callback URLs |

---

## 🔵 STAGING Environment

### Purpose
- Testing features
- QA validation
- Demo environment
- Safe experimentation

### Vercel Project Configuration
- **Project Name:** queen-mama-staging
- **Git Repository:** surpriz/Queen_Mama
- **Git Branch:** `staging` ⚠️ **À CONFIGURER**
- **Root Directory:** landing
- **Auto Deploy:** ON (on push to staging branch)

### Environment Variables for Vercel Staging

Copy these EXACT values into Vercel staging project:

#### Database
\`\`\`bash
DATABASE_URL="postgresql://neondb_owner:npg_q2vAHUQw5dle@ep-morning-hall-agre1cks-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
\`\`\`

#### NextAuth
\`\`\`bash
# Generate NEW secret specifically for staging
AUTH_SECRET="[À GÉNÉRER avec: openssl rand -base64 32]"
AUTH_TRUST_HOST="true"
NEXTAUTH_URL="https://staging.queenmama.co"
NEXT_PUBLIC_APP_URL="https://staging.queenmama.co"
\`\`\`

#### Stripe - TEST MODE ⚠️
**UTILISER LES CLÉS ACTUELLES (qui sont déjà en test mode)**

\`\`\`bash
# Ces clés viennent de votre .env actuel (déjà en test mode)
STRIPE_SECRET_KEY="sk_test_51QgfmL2LA3EbnLECw1..."
STRIPE_PUBLISHABLE_KEY="pk_test_51QgfmL2LA3EbnLECW..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_51QgfmL2LA3EbnLECW..."

# Webhook staging (à créer)
STRIPE_WEBHOOK_SECRET="whsec_[À CRÉER pour staging.queenmama.co]"

# Price IDs TEST MODE (vos IDs actuels)
STRIPE_PRO_PRICE_ID="price_1Qgfy22LA3EbnLECPa4lLBxG"
STRIPE_ENTERPRISE_PRICE_ID="price_1Qgfy32LA3EbnLECA7a2vPYa"
\`\`\`

#### OAuth - STAGING APPS (À CRÉER)
\`\`\`bash
# GitHub OAuth App Staging (à créer séparément)
# Callback: https://staging.queenmama.co/api/auth/callback/github
AUTH_GITHUB_ID="[À CRÉER nouveau GitHub OAuth App]"
AUTH_GITHUB_SECRET="[À CRÉER nouveau GitHub OAuth App]"

# Google OAuth App Staging (à créer séparément)
# Callback: https://staging.queenmama.co/api/auth/callback/google
AUTH_GOOGLE_ID="[À CRÉER nouveau Google OAuth App]"
AUTH_GOOGLE_SECRET="[À CRÉER nouveau Google OAuth App]"
\`\`\`

#### Encryption
\`\`\`bash
# Generate NEW key specifically for staging
ENCRYPTION_KEY="[À GÉNÉRER avec: openssl rand -hex 32]"
\`\`\`

---

## 🟢 PRODUCTION Environment

### Purpose
- Live users
- Real payments
- Real data
- Stable releases only

### Vercel Project Configuration
- **Project Name:** queen-mama
- **Git Repository:** surpriz/Queen_Mama
- **Git Branch:** `main` ✅ **DÉJÀ CONFIGURÉ**
- **Root Directory:** landing
- **Auto Deploy:** ON (on push to main branch)

### Environment Variables for Vercel Production

⚠️ **ATTENTION:** Production utilise Stripe LIVE MODE (nouvelles clés à créer)

#### Database
\`\`\`bash
# Neon branch "production" (déjà existante)
DATABASE_URL="[URL de la branche 'production' de Neon]"
\`\`\`

#### NextAuth
\`\`\`bash
# DOIT être différent de staging!
AUTH_SECRET="[À GÉNÉRER NOUVEAU avec: openssl rand -base64 32]"
AUTH_TRUST_HOST="true"
NEXTAUTH_URL="https://queenmama.co"
NEXT_PUBLIC_APP_URL="https://queenmama.co"
\`\`\`

#### Stripe - LIVE MODE ⚠️
**CRÉER DE NOUVELLES CLÉS EN LIVE MODE**

\`\`\`bash
# ⚠️ BASCULER STRIPE EN LIVE MODE POUR OBTENIR CES CLÉS
STRIPE_SECRET_KEY="sk_live_[À CRÉER en Live Mode]"
STRIPE_PUBLISHABLE_KEY="pk_live_[À CRÉER en Live Mode]"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_[À CRÉER en Live Mode]"

# Webhook production (à créer en Live Mode)
STRIPE_WEBHOOK_SECRET="whsec_[À CRÉER pour queenmama.co en Live Mode]"

# Price IDs LIVE MODE (à créer en Live Mode)
STRIPE_PRO_PRICE_ID="price_[À CRÉER en Live Mode]"
STRIPE_ENTERPRISE_PRICE_ID="price_[À CRÉER en Live Mode]"
\`\`\`

#### OAuth - PRODUCTION APPS (À CRÉER)
\`\`\`bash
# GitHub OAuth App Production (à créer séparément)
# Callback: https://queenmama.co/api/auth/callback/github
AUTH_GITHUB_ID="[À CRÉER nouveau GitHub OAuth App]"
AUTH_GITHUB_SECRET="[À CRÉER nouveau GitHub OAuth App]"

# Google OAuth App Production (à créer séparément)
# Callback: https://queenmama.co/api/auth/callback/google
AUTH_GOOGLE_ID="[À CRÉER nouveau Google OAuth App]"
AUTH_GOOGLE_SECRET="[À CRÉER nouveau Google OAuth App]"
\`\`\`

#### Encryption
\`\`\`bash
# DOIT être différent de staging!
ENCRYPTION_KEY="[À GÉNÉRER NOUVEAU avec: openssl rand -hex 32]"
\`\`\`

---

## 🔄 Migration Plan - Step by Step

### Phase 1: Cleanup (YOU ARE HERE)

#### 1.1 Reset Neon Databases
\`\`\`sql
-- Connect to Neon staging branch
-- Execute in Neon SQL Editor:

-- Drop all tables
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO neondb_owner;

-- Repeat for production branch
\`\`\`

#### 1.2 Run Prisma Migrations (locally first)
\`\`\`bash
cd landing

# Test on staging
DATABASE_URL="postgresql://neondb_owner:npg_q2vAHUQw5dle@ep-morning-hall-agre1cks-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" npx prisma migrate deploy

# Test on production
DATABASE_URL="[production-url]" npx prisma migrate deploy
\`\`\`

### Phase 2: Configure Stripe

#### 2.1 Staging (Test Mode - Already Done)
- ✅ Test keys already exist
- ✅ Test products already exist
- ⚠️ Need to create staging webhook endpoint

**Action:**
1. Stripe Dashboard → Test Mode → Webhooks
2. Add endpoint: `https://staging.queenmama.co/api/webhooks/stripe`
3. Events: `customer.subscription.*`, `invoice.*`
4. Copy webhook secret → Vercel staging

#### 2.2 Production (Live Mode - TO CREATE)
1. **Switch to Live Mode** (toggle in Stripe Dashboard)
2. **Get Live API Keys:**
   - Developers → API Keys
   - Copy `sk_live_...` and `pk_live_...`
3. **Create Live Products:**
   - Products → Create Product
   - Queen Mama PRO: 29€/month (live)
   - Queen Mama ENTERPRISE: 99€/month (live)
   - Copy Price IDs (`price_...` NOT `price_test_...`)
4. **Create Live Webhook:**
   - Webhooks → Add Endpoint
   - URL: `https://queenmama.co/api/webhooks/stripe`
   - Events: `customer.subscription.*`, `invoice.*`
   - Copy webhook secret

### Phase 3: Configure OAuth Apps

#### 3.1 GitHub OAuth - Staging
1. https://github.com/settings/developers
2. New OAuth App
   - Name: `Queen Mama Staging`
   - Homepage: `https://staging.queenmama.co`
   - Callback: `https://staging.queenmama.co/api/auth/callback/github`
3. Copy Client ID + Secret → Vercel staging

#### 3.2 GitHub OAuth - Production
1. New OAuth App
   - Name: `Queen Mama`
   - Homepage: `https://queenmama.co`
   - Callback: `https://queenmama.co/api/auth/callback/github`
2. Copy Client ID + Secret → Vercel production

#### 3.3 Google OAuth (same principle)
Create two separate apps with different callback URLs.

### Phase 4: Configure Vercel

#### 4.1 Staging Project
1. Go to https://vercel.com/queen-mama-staging
2. **Settings → Git:**
   - Production Branch: `staging` ⚠️ **CHANGE FROM main**
3. **Settings → Environment Variables:**
   - Delete all current variables
   - Add variables from "STAGING Environment" section above
4. **Redeploy**

#### 4.2 Production Project
1. Go to https://vercel.com/queen-mama
2. **Settings → Environment Variables:**
   - Update all variables from "PRODUCTION Environment" section above
   - Make sure Stripe keys are LIVE MODE
3. **Redeploy**

### Phase 5: Verification

#### Staging Checklist
- [ ] Visit https://staging.queenmama.co
- [ ] Create test account
- [ ] Test signin/signout
- [ ] Test Stripe checkout with card `4242 4242 4242 4242`
- [ ] Verify no real charge is made
- [ ] Check Vercel logs for errors

#### Production Checklist
- [ ] Visit https://queenmama.co
- [ ] Create test account
- [ ] Test signin/signout
- [ ] ⚠️ DON'T test real payments yet
- [ ] Verify Stripe is in Live Mode
- [ ] Check Vercel logs for errors

---

## 🎯 Current Status Tracking

### ✅ Done
- [x] Neon staging branch created
- [x] Vercel staging project created
- [x] Stripe test mode configured

### 🔄 In Progress
- [ ] Neon databases reset to clean state
- [ ] Stripe Live Mode configured
- [ ] OAuth apps created
- [ ] Vercel variables configured properly

### ⏳ Pending
- [ ] DNS staging subdomain
- [ ] End-to-end testing
- [ ] Documentation finalized

---

## 🆘 Troubleshooting

### "Can't connect to database"
- Verify DATABASE_URL is correct for each environment
- Check Neon branch is "Active"
- Ensure SSL mode is included in connection string

### "Stripe webhook not working"
- Verify webhook URL matches environment
- Check webhook secret matches Vercel env var
- Ensure events are selected: `customer.subscription.*`, `invoice.*`

### "OAuth redirect_uri_mismatch"
- Verify callback URL EXACTLY matches OAuth app config
- Ensure no trailing slash
- Check HTTP vs HTTPS

---

## 📝 Notes

**Security Best Practices:**
- NEVER mix test and live Stripe keys
- NEVER use production keys in staging
- NEVER commit .env files to Git
- ALWAYS use different AUTH_SECRET for each environment
- ALWAYS use different ENCRYPTION_KEY for each environment

**Cost Management:**
- Staging uses Neon dev branch: FREE
- Staging uses Stripe test mode: FREE
- Production Neon: Pay-as-you-go (~5-20€/month)
- Production Stripe: Transaction fees only

**Data Management:**
- Staging data is disposable
- Can reset staging database anytime
- Production data is sacred - backup before migrations
