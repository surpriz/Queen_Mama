# Fix Vercel Staging Configuration

## Problème Actuel

D'après vos screenshots:
- ✅ Vercel staging déploie correctement
- ❌ MAIS il déploie depuis la branche **main** au lieu de **staging**
- ❌ Le domaine staging.queenmama.co n'est pas configuré

## Solution

### Étape 1: Changer la Production Branch (5 min)

1. **Aller sur:** https://vercel.com/queen-mama-staging
2. **Cliquer sur:** Settings (en haut)
3. **Cliquer sur:** Git (menu gauche)
4. **Section "Production Branch":**
   - Actuellement: `main` ❌
   - Changer pour: `staging` ✅
5. **Cliquer sur:** Save
6. **Vercel va demander confirmation** → Confirmer

**Résultat attendu:** Les futurs déploiements viendront de la branche `staging`

### Étape 2: Redéployer Depuis staging (2 min)

1. **Aller dans:** Deployments
2. **Cliquer sur:** le dernier déploiement
3. **Cliquer sur:** ... (menu) → **Redeploy**
4. **Attendre** 2-3 minutes que le build se termine

**Vérification:**
- Dans le déploiement, vous devriez voir "Source: staging" au lieu de "main"

### Étape 3: Configurer le Domaine staging.queenmama.co (10 min)

#### 3.1 Ajouter le Domaine dans Vercel

1. **Sur le projet queen-mama-staging**
2. **Cliquer sur:** Settings → Domains
3. **Cliquer sur:** Add
4. **Entrer:** `staging.queenmama.co`
5. **Cliquer sur:** Add

**Vercel va vous donner une de ces options:**

**Option A: CNAME (Recommandé)**
- Type: CNAME
- Name: staging
- Value: cname.vercel-dns.com

**Option B: A Record**
- Type: A
- Name: staging
- Value: 76.76.21.21

#### 3.2 Configurer DNS chez OVH

1. **Aller sur:** https://www.ovh.com/manager/
2. **Sélectionner:** queenmama.co
3. **Aller dans:** Zone DNS
4. **Ajouter un enregistrement:**

**Si Vercel demande CNAME:**
```
Type: CNAME
Sous-domaine: staging
Cible: cname.vercel-dns.com
```

**Si Vercel demande A Record:**
```
Type: A
Sous-domaine: staging
Cible: 76.76.21.21
```

5. **Sauvegarder**
6. **Attendre 5-30 minutes** pour la propagation DNS

#### 3.3 Vérifier le Domaine

1. **Retourner sur Vercel** → Settings → Domains
2. **Attendre** que le statut passe de "Pending" à "Valid"
3. **Vercel va automatiquement** générer un certificat SSL
4. **Tester:** https://staging.queenmama.co

---

## Vérification Finale

### Checklist Staging

- [ ] Vercel staging déploie depuis branche `staging` (pas main)
- [ ] staging.queenmama.co est accessible
- [ ] HTTPS fonctionne (certificat SSL actif)
- [ ] La page affiche correctement
- [ ] Les variables d'environnement sont en Test Mode Stripe

### Test Complet

1. **Ouvrir:** https://staging.queenmama.co
2. **Créer un compte** (Sign Up)
3. **Se connecter**
4. **Aller dans Settings**
5. **Tester OAuth:** Se connecter avec GitHub ou Google
6. **Tester Stripe:** Essayer de souscrire avec carte `4242 4242 4242 4242`
7. **Vérifier:** Le paiement apparaît dans Stripe Dashboard (Test Mode)

---

## Troubleshooting

### "staging.queenmama.co" ne se résout pas

**Problème:** DNS pas encore propagé

**Solution:**
```bash
# Tester la propagation DNS
nslookup staging.queenmama.co

# Ou utiliser
dig staging.queenmama.co
```

**Si aucun résultat après 1 heure:**
- Vérifier que l'enregistrement DNS est bien créé chez OVH
- Vérifier qu'il n'y a pas de conflit avec un autre enregistrement
- Essayer de supprimer et recréer l'enregistrement

### "Invalid Configuration" dans Vercel

**Problème:** Le domaine est déjà utilisé ailleurs

**Solution:**
- Vérifier que `staging.queenmama.co` n'est pas configuré dans le projet production
- Si oui, le supprimer du projet production d'abord

### Certificat SSL "Pending" depuis longtemps

**Problème:** Vercel attend que le DNS se propage

**Solution:**
- Attendre 30 minutes minimum
- Vérifier que le DNS pointe bien vers Vercel
- Cliquer sur "Refresh" dans Vercel Domains

---

## Résultat Attendu

Après avoir suivi ces étapes:

### Staging Environment
- **URL:** https://staging.queenmama.co
- **Git Branch:** staging
- **Database:** Neon staging branch
- **Stripe:** Test Mode
- **SSL:** ✅ Actif
- **Status:** ✅ Opérationnel

### Production Environment
- **URL:** https://queenmama.co (ou www.queenmama.co)
- **Git Branch:** main
- **Database:** Neon production branch
- **Stripe:** Live Mode
- **SSL:** ✅ Actif
- **Status:** ✅ Opérationnel

---

## Workflow de Déploiement

Une fois tout configuré, voici le workflow:

### Pour tester une feature

```bash
# 1. Créer une branche feature
git checkout -b feature/nouvelle-fonctionnalite

# 2. Développer et commiter
git commit -m "Add nouvelle fonctionnalité"

# 3. Push vers GitHub
git push origin feature/nouvelle-fonctionnalite

# 4. Créer PR vers staging
# Sur GitHub → Create Pull Request → base: staging

# 5. Merger dans staging
# → Auto-deploy sur staging.queenmama.co

# 6. Tester sur staging
# Créer compte, tester features, vérifier Stripe test

# 7. Si OK, merger staging → main
# GitHub → Create Pull Request → base: main

# 8. Merger dans main
# → Auto-deploy sur queenmama.co (production)
```

---

## Notes Importantes

**Sécurité:**
- staging.queenmama.co utilise Stripe TEST MODE uniquement
- Aucun vrai paiement ne peut être fait sur staging
- Les données staging peuvent être supprimées à tout moment

**Données:**
- Les comptes créés sur staging sont séparés de production
- Staging = pour vos tests internes
- Production = pour les vrais utilisateurs

**Coûts:**
- Staging: 100% gratuit (Vercel + Neon + Stripe test mode)
- Production: ~5-20€/mois (Neon database + transaction fees Stripe)
