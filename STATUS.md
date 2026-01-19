# État Actuel du Projet Queen Mama

Dernière mise à jour: 19 janvier 2026, 22:00

---

## ✅ Ce qui est FAIT

### Databases (Neon)
- [x] Branche `production` créée
- [x] Branche `staging` créée
- [x] Tables créées dans les deux branches
- [x] Migrations Prisma commitées dans Git

### Git & GitHub
- [x] Branche `main` (production)
- [x] Branche `staging` créée
- [x] Documentation complète (DEPLOYMENT.md, ENVIRONMENT_VARIABLES.md, CLEANUP_CHECKLIST.md)

### Vercel Production (queen-mama)
- [x] Projet créé et déployé
- [x] Variables d'environnement configurées
- [x] Domaine `queenmama.co` configuré
- [x] SSL actif
- [x] Accessible sur https://queenmama.co

### Vercel Staging (queen-mama-staging)
- [x] Projet créé
- [x] Variables d'environnement configurées (Stripe Test Mode)
- [x] Premier déploiement réussi

### Stripe
- [x] Test Mode configuré (pour staging)
- [x] Products Test créés (PRO + ENTERPRISE)
- [x] Live Mode configuré (pour production)
- [x] Products Live créés (PRO + ENTERPRISE)

---

## 🔄 Ce qui RESTE À FAIRE

### Vercel Staging Configuration (15 min)

**Problème actuel:**
- ❌ Déploie depuis branche `main` au lieu de `staging`
- ❌ Domaine `staging.queenmama.co` pas configuré

**Actions requises:**
1. Vercel → queen-mama-staging → Settings → Git
   - Changer Production Branch: `main` → `staging`
2. Vercel → queen-mama-staging → Settings → Domains
   - Ajouter: `staging.queenmama.co`
3. OVH DNS Zone
   - Ajouter CNAME: `staging` → `cname.vercel-dns.com`

**Guide détaillé:** Voir `FIX_VERCEL_STAGING.md`

### OAuth Apps (30 min)

**Staging:**
- [ ] Créer GitHub OAuth App pour staging
  - Callback: `https://staging.queenmama.co/api/auth/callback/github`
- [ ] Créer Google OAuth App pour staging
  - Callback: `https://staging.queenmama.co/api/auth/callback/google`
- [ ] Mettre à jour variables Vercel staging

**Production:**
- [ ] Créer GitHub OAuth App pour production
  - Callback: `https://queenmama.co/api/auth/callback/github`
- [ ] Créer Google OAuth App pour production
  - Callback: `https://queenmama.co/api/auth/callback/google`
- [ ] Mettre à jour variables Vercel production

### Stripe Webhooks (10 min)

**Staging:**
- [ ] Créer webhook endpoint (Test Mode)
  - URL: `https://staging.queenmama.co/api/webhooks/stripe`
  - Events: `customer.subscription.*`, `invoice.*`
- [ ] Mettre à jour `STRIPE_WEBHOOK_SECRET` dans Vercel staging

**Production:**
- [ ] Créer webhook endpoint (Live Mode)
  - URL: `https://queenmama.co/api/webhooks/stripe`
  - Events: `customer.subscription.*`, `invoice.*`
- [ ] Mettre à jour `STRIPE_WEBHOOK_SECRET` dans Vercel production

### Tests (20 min)

**Staging:**
- [ ] Ouvrir https://staging.queenmama.co
- [ ] Créer un compte
- [ ] Tester OAuth (GitHub + Google)
- [ ] Tester Stripe avec carte test `4242 4242 4242 4242`
- [ ] Vérifier aucun vrai paiement

**Production:**
- [ ] Ouvrir https://queenmama.co
- [ ] Créer un compte
- [ ] Tester OAuth (GitHub + Google)
- [ ] ⚠️ NE PAS tester Stripe en production (mode live)

---

## 🚧 Bloqué en Attente

### Apple Developer Program
**Statut:** En attente de résolution du DUNS avec D&B

**Bloque:**
- Distribution de l'app macOS signée
- Notarization
- Download page avec releases GitHub

**Timeline estimée:** 2-7 jours selon D&B

**Alternatives temporaires:**
- Distribuer sans signature (users devront clic droit → Ouvrir)
- Attendre résolution DUNS/Apple Developer

---

## 📊 Architecture Actuelle

```
┌─────────────────────────────────────────────────────────┐
│                  STAGING (Test)                          │
├─────────────────────────────────────────────────────────┤
│ URL:        staging.queenmama.co ⚠️ À CONFIGURER        │
│ Git:        staging branch                               │
│ Vercel:     queen-mama-staging ⚠️ Déploie depuis main   │
│ Database:   Neon staging branch ✅                       │
│ Stripe:     Test Mode ✅                                 │
│ OAuth:      ⚠️ À créer                                   │
│ Webhook:    ⚠️ À créer                                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                 PRODUCTION (Live)                        │
├─────────────────────────────────────────────────────────┤
│ URL:        queenmama.co ✅                              │
│ Git:        main branch ✅                               │
│ Vercel:     queen-mama ✅                                │
│ Database:   Neon production branch ✅                    │
│ Stripe:     Live Mode ✅                                 │
│ OAuth:      ⚠️ À créer                                   │
│ Webhook:    ⚠️ À créer                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 Prochaines Actions Prioritaires

### Action 1: Fixer Vercel Staging (15 min)
**Urgence:** Haute
**Fichier:** FIX_VERCEL_STAGING.md
**Résultat:** staging.queenmama.co accessible

### Action 2: OAuth Apps (30 min)
**Urgence:** Haute
**Résultat:** Connexion GitHub/Google fonctionnelle

### Action 3: Webhooks Stripe (10 min)
**Urgence:** Moyenne
**Résultat:** Subscriptions synchronisées avec Stripe

### Action 4: Tests Complets (20 min)
**Urgence:** Moyenne
**Résultat:** Validation des deux environnements

---

## 📝 Notes

**Temps total estimé pour finir:** ~1h15

**Après ces étapes:**
- ✅ Staging 100% opérationnel
- ✅ Production 100% opérationnelle
- ✅ Séparation claire test/live
- ✅ Workflow de déploiement fonctionnel
- ⏳ En attente: Distribution app macOS (Apple Developer)

**Recommandation:**
1. Commencer par fixer Vercel staging (plus urgent)
2. Créer OAuth apps
3. Configurer webhooks
4. Faire tests complets
5. Attendre résolution Apple Developer en parallèle
