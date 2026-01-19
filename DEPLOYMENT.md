# Deployment Guide - Staging & Production

## Architecture Overview

Queen Mama uses a **two-environment architecture**:

### Staging Environment
- **Purpose:** Testing, QA, validation before production
- **Domain:** staging.queenmama.co
- **Git Branch:** `staging`
- **Database:** Neon branch "staging"
- **Stripe:** Test Mode
- **Vercel Project:** queen-mama-staging

### Production Environment
- **Purpose:** Live users, real payments
- **Domain:** queenmama.co
- **Git Branch:** `main`
- **Database:** Neon branch "main"
- **Stripe:** Live Mode
- **Vercel Project:** queen-mama

---

## Environment Variables

### Staging (.env.staging)

```bash
# Database - Neon Staging Branch
DATABASE_URL="postgresql://user:pass@ep-xxx-staging.region.aws.neon.tech/neondb"

# NextAuth
AUTH_SECRET="<staging-specific-secret>"
AUTH_TRUST_HOST=true
NEXTAUTH_URL="https://staging.queenmama.co"
NEXT_PUBLIC_APP_URL="https://staging.queenmama.co"

# GitHub OAuth (Test App)
AUTH_GITHUB_ID="<staging-github-oauth-id>"
AUTH_GITHUB_SECRET="<staging-github-oauth-secret>"

# Google OAuth (Test App)
AUTH_GOOGLE_ID="<staging-google-oauth-id>"
AUTH_GOOGLE_SECRET="<staging-google-oauth-secret>"

# Stripe - TEST MODE
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Stripe Price IDs (Test Mode)
STRIPE_PRO_PRICE_ID="price_test_pro_..."
STRIPE_ENTERPRISE_PRICE_ID="price_test_enterprise_..."

# Encryption
ENCRYPTION_KEY="<staging-encryption-key>"
```

### Production (.env.production)

```bash
# Database - Neon Main Branch
DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb"

# NextAuth
AUTH_SECRET="<production-secret>"
AUTH_TRUST_HOST=true
NEXTAUTH_URL="https://queenmama.co"
NEXT_PUBLIC_APP_URL="https://queenmama.co"

# GitHub OAuth (Production App)
AUTH_GITHUB_ID="<prod-github-oauth-id>"
AUTH_GITHUB_SECRET="<prod-github-oauth-secret>"

# Google OAuth (Production App)
AUTH_GOOGLE_ID="<prod-google-oauth-id>"
AUTH_GOOGLE_SECRET="<prod-google-oauth-secret>"

# Stripe - LIVE MODE
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_live_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."

# Stripe Price IDs (Live Mode)
STRIPE_PRO_PRICE_ID="price_live_pro_..."
STRIPE_ENTERPRISE_PRICE_ID="price_live_enterprise_..."

# Encryption
ENCRYPTION_KEY="<production-encryption-key>"
```

---

## Service Configuration

### 1. Neon Database

#### Create Staging Branch

1. Go to https://console.neon.tech
2. Select Queen Mama project
3. Navigate to **Branches** → **Create Branch**
   - **Name:** staging
   - **Parent:** main
   - **Type:** Development branch
4. Copy the connection string for staging branch
5. Use in Vercel staging environment variables

#### Benefits of Neon Branching

- ✅ Instant copy of production data (for testing with real-like data)
- ✅ Isolated: changes in staging don't affect production
- ✅ Free for development branches
- ✅ Can reset staging from production anytime

### 2. Stripe

#### Staging (Test Mode)

1. Go to https://dashboard.stripe.com
2. Toggle **Test Mode** (top right)
3. Get test API keys: **Developers** → **API Keys**
   - Publishable key: `pk_test_...`
   - Secret key: `sk_test_...`
4. Create test products and prices:
   - **Products** → **Create Product**
   - PRO: 29€/month (test)
   - ENTERPRISE: 99€/month (test)
5. Create test webhook endpoint:
   - **Developers** → **Webhooks** → **Add Endpoint**
   - URL: `https://staging.queenmama.co/api/webhooks/stripe`
   - Events: `customer.subscription.*`, `invoice.*`
   - Copy webhook secret: `whsec_test_...`

#### Production (Live Mode)

1. Toggle to **Live Mode**
2. Get live API keys
3. Create live products (same structure as test)
4. Create live webhook endpoint:
   - URL: `https://queenmama.co/api/webhooks/stripe`

**Test Cards for Staging:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0027 6000 3184`

### 3. Vercel

#### Create Staging Project

1. Go to https://vercel.com
2. Click **Add New...** → **Project**
3. Import GitHub repo: `surpriz/Queen_Mama`
4. Configure:
   - **Project Name:** queen-mama-staging
   - **Root Directory:** landing
   - **Framework:** Next.js
   - **Branch:** staging
5. Add all staging environment variables (see .env.staging above)
6. Deploy

#### Production Project (Already Exists)

- Project Name: queen-mama
- Branch: main
- Environment Variables: Already configured

#### Auto-Deploy Configuration

**Staging Project:**
- Git Branch: `staging`
- Auto-deploy: ON (deploys on every push to staging)

**Production Project:**
- Git Branch: `main`
- Auto-deploy: ON (deploys on every push to main)

### 4. OAuth Apps

#### GitHub OAuth

Create **two separate GitHub OAuth Apps**:

**Staging App:**
1. GitHub Settings → Developer settings → OAuth Apps → New
2. **Name:** Queen Mama Staging
3. **Homepage:** https://staging.queenmama.co
4. **Callback URL:** https://staging.queenmama.co/api/auth/callback/github
5. Copy Client ID and Secret to staging env vars

**Production App:**
1. Same steps but:
   - **Name:** Queen Mama
   - **Homepage:** https://queenmama.co
   - **Callback URL:** https://queenmama.co/api/auth/callback/github

#### Google OAuth

Same principle: create two OAuth apps in Google Cloud Console.

### 5. DNS Configuration (OVH)

Add staging subdomain:

| Type | Nom | Valeur |
|------|-----|--------|
| CNAME | staging | cname.vercel-dns.com |

**Note:** Vercel will provide the exact CNAME target when you add the custom domain.

---

## Deployment Workflow

### Daily Development

```bash
# Work on feature branch
git checkout -b feature/new-feature
git commit -m "Add new feature"
git push origin feature/new-feature

# Create PR to staging
# GitHub: Create Pull Request → base: staging

# Review, test, merge to staging
# → Vercel auto-deploys to staging.queenmama.co

# Test on staging:
# - Create account
# - Test Stripe checkout (test cards)
# - Verify features work
# - Check logs on Vercel

# If all tests pass, merge to main
# GitHub: Create Pull Request → base: main

# Review, merge to main
# → Vercel auto-deploys to queenmama.co
```

### Hotfix Workflow

For urgent production fixes:

```bash
# Create hotfix from main
git checkout main
git checkout -b hotfix/critical-bug
git commit -m "Fix critical bug"

# Deploy directly to main (skip staging if critical)
git push origin hotfix/critical-bug
# Create PR to main → merge → auto-deploy
```

### Database Migration Workflow

```bash
# 1. Test migration on staging
cd landing
DATABASE_URL="<staging-database-url>" npx prisma migrate dev

# 2. Verify staging works
# Test on staging.queenmama.co

# 3. Apply to production
DATABASE_URL="<production-database-url>" npx prisma migrate deploy

# 4. Verify production
# Check queenmama.co
```

---

## Checklist: Setting Up Staging

### Database
- [ ] Create Neon staging branch
- [ ] Copy staging DATABASE_URL
- [ ] Test connection

### Stripe
- [ ] Switch to Test Mode
- [ ] Get test API keys
- [ ] Create test products (PRO, ENTERPRISE)
- [ ] Create staging webhook endpoint
- [ ] Copy webhook secret

### OAuth Apps
- [ ] Create GitHub OAuth app for staging
- [ ] Create Google OAuth app for staging
- [ ] Configure callback URLs

### Vercel
- [ ] Create queen-mama-staging project
- [ ] Set Root Directory to "landing"
- [ ] Set Git Branch to "staging"
- [ ] Add all environment variables
- [ ] Deploy

### DNS
- [ ] Add staging.queenmama.co CNAME record
- [ ] Wait for DNS propagation (5-30 min)
- [ ] Add custom domain in Vercel staging project
- [ ] Verify SSL certificate issued

### Testing
- [ ] Visit staging.queenmama.co
- [ ] Create test account
- [ ] Test Stripe checkout with test card
- [ ] Test macOS device authentication
- [ ] Verify logs on Vercel

---

## Best Practices

### DO ✅
- Always test on staging before production
- Use Stripe Test Mode for staging
- Keep staging data separate from production
- Test database migrations on staging first
- Use staging for demos and user testing
- Reset staging database from production periodically (to keep realistic data)

### DON'T ❌
- Never use production Stripe keys in staging
- Never test with real credit cards in staging
- Never mix staging and production API keys
- Don't deploy untested code directly to main
- Don't use production database for testing

---

## Troubleshooting

### Staging deployment fails

1. Check Vercel logs
2. Verify all environment variables are set
3. Check DATABASE_URL is for staging branch
4. Ensure Stripe keys are test mode (`sk_test_...`)

### OAuth not working on staging

- Verify callback URLs match exactly: `https://staging.queenmama.co/api/auth/callback/<provider>`
- Check AUTH_GITHUB_ID/SECRET are from staging OAuth app
- Ensure NEXTAUTH_URL points to staging domain

### Stripe webhook not receiving events

- Verify webhook URL is correct
- Check webhook secret matches Vercel env var
- Test webhook with Stripe CLI: `stripe listen --forward-to https://staging.queenmama.co/api/webhooks/stripe`

---

## Monitoring

### Staging
- Vercel Logs: https://vercel.com/queen-mama-staging/logs
- Neon Monitoring: https://console.neon.tech (staging branch)
- Stripe Test Mode Dashboard: https://dashboard.stripe.com/test

### Production
- Vercel Logs: https://vercel.com/queen-mama/logs
- Neon Monitoring: https://console.neon.tech (main branch)
- Stripe Live Mode Dashboard: https://dashboard.stripe.com

---

## Rollback Procedure

If production deployment breaks:

1. **Instant Rollback via Vercel:**
   - Vercel Dashboard → queen-mama → Deployments
   - Find last working deployment
   - Click "..." → "Redeploy"

2. **Database Rollback:**
   - Neon doesn't support automatic rollback
   - Restore from backup or revert migrations manually
   - Consider Neon's Time Travel feature (point-in-time restore)

3. **Emergency Hotfix:**
   - Revert commit on main branch
   - Push → auto-deploy

---

## Cost Considerations

### Staging Costs (Minimal)
- Neon: Free for development branches
- Vercel: Free (within limits)
- Stripe: Free (test mode)

### Production Costs
- Neon: Pay-as-you-go (~5-20€/month for small traffic)
- Vercel: Free tier should be sufficient initially
- Stripe: Transaction fees only (1.5% + 0.25€ per successful charge)
