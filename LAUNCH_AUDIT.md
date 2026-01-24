# Queen Mama - Audit Pré-Production

**Date**: 24 Janvier 2026
**Version auditée**: 1.0.7 (build 9)
**Branches**: staging → audit/pre-production

---

## Score de Préparation au Lancement

| Composant | Score | Status |
|-----------|-------|--------|
| Landing (Web) | 82% | ✅ Prêt |
| Mac App | 78% | ⚠️ Presque prêt (notarization requise) |
| Infrastructure | 70% | ⚠️ Config env vars requise |
| **Global** | **77%** | ⚠️ **Lancement possible après config** |

### Progression Audit
- ✅ Secrets hardcodés retirés
- ✅ Pages d'erreur 404/500 créées
- ✅ Cookie consent banner GDPR

---

## 🔴 BLOQUANTS - À Faire AVANT Demain

### 1. Mac App - Notarization Apple
**Priorité**: CRITIQUE
**Effort**: 2-4h
**Impact**: L'app ne s'ouvrira pas sur les Macs des utilisateurs sans notarization

- [ ] Configurer `notarytool` dans Xcode build phase
- [ ] Vérifier que le certificat Developer ID est valide
- [ ] Tester l'app signée sur un Mac vierge
- [ ] Vérifier que Gatekeeper accepte l'app

**Fichiers concernés**:
- `mac_app/QueenMama.entitlements`
- Xcode project settings

### 2. Secrets Hardcodés à Retirer
**Priorité**: CRITIQUE
**Effort**: 1h
**Impact**: Sécurité compromise
**Status**: ✅ COMPLÉTÉ

- [x] Retirer Sentry DSN de `Info.plist` → variable d'environnement `$(SENTRY_DSN)`
- [x] Migrer le secret de licence de `LicenseManager.swift` vers vérification serveur
- [ ] Configurer `SENTRY_DSN` dans Xcode build settings ou xcconfig
- [ ] Configurer `LICENSE_SECRET` dans l'environnement Xcode (optionnel, fail-safe si absent)

**Fichiers modifiés**:
- `mac_app/Info.plist` - DSN maintenant via `$(SENTRY_DSN)`
- `mac_app/Services/LicenseManager.swift` - Secret retiré, fail-safe vers validation serveur

### 3. Configuration Stripe Production
**Priorité**: CRITIQUE
**Effort**: 30min
**Impact**: Paiements ne fonctionneront pas

- [ ] Configurer `STRIPE_SECRET_KEY` (live)
- [ ] Configurer `STRIPE_PUBLISHABLE_KEY` (live)
- [ ] Configurer `STRIPE_WEBHOOK_SECRET` (live)
- [ ] Configurer `STRIPE_PRO_PRICE_ID` et `STRIPE_ENTERPRISE_PRICE_ID`
- [ ] Tester un paiement de bout en bout

### 4. Configuration AWS SES
**Priorité**: CRITIQUE
**Effort**: 30min
**Impact**: Emails de vérification/reset ne seront pas envoyés

- [ ] Configurer `EMAIL_FROM`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- [ ] Vérifier que le domaine est vérifié dans SES
- [ ] Tester l'envoi d'un email

### 5. Appcast Sparkle
**Priorité**: HAUTE
**Effort**: 1h
**Impact**: Mises à jour automatiques ne fonctionneront pas

- [ ] Déployer `appcast.xml` sur https://www.queenmama.co/appcast.xml
- [ ] Vérifier la signature EdDSA
- [ ] Tester la détection de mise à jour

---

## 🟠 HAUTE PRIORITÉ - Aujourd'hui/Demain

### 6. Pages d'Erreur Personnalisées
**Effort**: 1-2h
**Impact**: Mauvaise UX si erreur
**Status**: ✅ COMPLÉTÉ

- [x] Créer page 404 custom (`landing/app/not-found.tsx`)
- [x] Créer page 500 custom (`landing/app/error.tsx`)
- [ ] Créer page de maintenance 503 (optionnel)

### 7. Cookie Consent Banner (GDPR)
**Effort**: 2h
**Impact**: Non-conformité légale en EU
**Status**: ✅ COMPLÉTÉ

- [x] Ajouter bannière de consentement cookies (`landing/components/CookieConsent.tsx`)
- [x] Implémenter stockage du consentement (`landing/lib/cookies.ts`)
- [x] Intégré dans `landing/app/layout.tsx`
- [ ] Intégrer avec analytics (bloquer avant consentement) - quand analytics ajouté

### 8. Rate Limiting Production-Ready
**Effort**: 2h
**Impact**: Vulnérabilité aux attaques après redémarrage serveur

Le rate limiting actuel est en mémoire et se réinitialise au restart.

- [ ] Migrer vers Redis (ex: `@upstash/ratelimit`)
- [ ] OU accepter le risque pour le lancement initial

**Fichier**: `landing/lib/rate-limit.ts`

### 9. Error Tracking (Sentry)
**Effort**: 1h
**Impact**: Pas de visibilité sur les crashes en prod
**Status**: ⏳ Instructions prêtes

**Landing Site Setup:**
```bash
cd landing
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Ensuite configurer dans Vercel:
- `SENTRY_DSN` - DSN du projet Sentry
- `SENTRY_AUTH_TOKEN` - Token pour source maps

- [ ] Installer et configurer `@sentry/nextjs`
- [x] Mac app: Sentry configuré (utilise `$(SENTRY_DSN)`)
- [ ] Configurer les alertes email dans Sentry dashboard

### 10. Test Permissions macOS
**Effort**: 1h
**Impact**: Mauvaise UX au premier lancement

- [ ] Tester le flow de permissions sur un Mac vierge
- [ ] Vérifier: Microphone, Screen Recording, Accessibility
- [ ] S'assurer que les messages d'erreur sont clairs

---

## 🟡 MOYENNE PRIORITÉ - Cette Semaine

### 11. Vérification Email Enforced
**Effort**: 2h
**Actuellement**: Les utilisateurs peuvent utiliser l'app sans vérifier leur email

- [ ] Bloquer l'accès au dashboard si email non vérifié
- [ ] Ajouter page "Vérifiez votre email"
- [ ] Permettre le renvoi du lien

### 12. Authentification 2FA/MFA
**Effort**: 4-8h
**Impact**: Sécurité accrue (recommandé mais pas bloquant)

- [ ] Implémenter TOTP (Google Authenticator compatible)
- [ ] Ajouter dans les settings utilisateur
- [ ] Codes de récupération

### 13. Session Recovery (Mac App)
**Effort**: 4h
**Impact**: Perte de données si crash pendant enregistrement

- [ ] Sauvegarder la session périodiquement (toutes les 30s)
- [ ] Proposer de récupérer au redémarrage
- [ ] Nettoyer les sessions partielles

### 14. Offline Mode Gracieux
**Effort**: 4h
**Impact**: Mauvaise UX sans internet

- [ ] Détecter la perte de connexion
- [ ] Afficher un indicateur "Hors ligne"
- [ ] Queue les actions pour resync

### 15. Widget Position Persistence
**Effort**: 1h
**Impact**: Widget revient au centre à chaque lancement

- [ ] Sauvegarder position/taille dans UserDefaults
- [ ] Restaurer au lancement

**Fichier**: `mac_app/Views/Widget/WidgetOverlay.swift`

---

## 🟢 NICE TO HAVE - Après Lancement

### UX & Features
| Feature | Effort | Priorité |
|---------|--------|----------|
| Raccourcis clavier globaux fonctionnels | 4h | Moyenne |
| Touch ID/Face ID login | 4h | Moyenne |
| Password reset dans mac app | 2h | Moyenne |
| Export sessions (PDF/Markdown) | 4h | Basse |
| Recherche dans les sessions | 4h | Basse |
| Thème clair/sombre toggle | 2h | Basse |

### Marketing & SEO
| Feature | Effort | Priorité |
|---------|--------|----------|
| Témoignages/Social proof section | 2h | Haute |
| Open Graph/Twitter Cards | 1h | Moyenne |
| Blog/Knowledge base | 8h+ | Basse |
| Newsletter signup | 2h | Basse |
| Sitemap.xml | 30min | Moyenne |

### Documentation
| Feature | Effort | Priorité |
|---------|--------|----------|
| API documentation (OpenAPI) | 4h | Moyenne |
| Guide utilisateur | 4h | Moyenne |
| FAQ étendue | 2h | Basse |
| Runbook incidents | 4h | Haute |

### Tests
| Feature | Effort | Priorité |
|---------|--------|----------|
| Tests unitaires (20% coverage) | 8h | Haute |
| Tests E2E (auth, paiement) | 8h | Haute |
| Tests de charge | 4h | Moyenne |

### Accessibilité
| Feature | Effort | Priorité |
|---------|--------|----------|
| VoiceOver support | 8h | Moyenne |
| Navigation clavier | 4h | Moyenne |
| Contraste WCAG | 2h | Basse |

---

## Ce Qui Est Prêt ✅

### Landing (Web)
- ✅ Auth complète (email + OAuth GitHub/Google)
- ✅ Device authentication pour mac app
- ✅ Stripe checkout & subscriptions
- ✅ Pages légales (Privacy, Terms, DPA)
- ✅ Suppression compte GDPR
- ✅ Export données utilisateur
- ✅ Rate limiting (en mémoire)
- ✅ Validation Zod sur toutes les routes
- ✅ Headers de sécurité
- ✅ Encryption API keys (AES-256-GCM)
- ✅ Logging structuré

### Mac App
- ✅ Transcription Deepgram avec fallbacks
- ✅ AI conversation via proxy backend
- ✅ Multiple modes (coaching, etc.)
- ✅ Onboarding multi-étapes
- ✅ SwiftData persistence
- ✅ Keychain pour tokens
- ✅ Menu bar integration
- ✅ Widget overlay
- ✅ Sparkle auto-update (config prête)
- ✅ Sentry crash reporting (optionnel)
- ✅ License gating

### Infrastructure
- ✅ CI/CD GitHub Actions
- ✅ Vercel deployment
- ✅ Neon database (staging/prod)
- ✅ Environment separation
- ✅ OAuth apps (staging/prod séparés)

---

## Variables d'Environnement à Configurer

### Landing (Vercel)
| Variable | Description | Requis |
|----------|-------------|--------|
| `DATABASE_URL` | URL PostgreSQL Neon | ✅ Oui |
| `NEXTAUTH_SECRET` | Secret NextAuth | ✅ Oui |
| `NEXTAUTH_URL` | URL du site | ✅ Oui |
| `STRIPE_SECRET_KEY` | Clé Stripe live | ✅ Oui |
| `STRIPE_PUBLISHABLE_KEY` | Clé publique Stripe | ✅ Oui |
| `STRIPE_WEBHOOK_SECRET` | Secret webhook Stripe | ✅ Oui |
| `STRIPE_PRO_PRICE_ID` | ID prix plan Pro | ✅ Oui |
| `STRIPE_ENTERPRISE_PRICE_ID` | ID prix plan Enterprise | ✅ Oui |
| `EMAIL_FROM` | Adresse email expéditeur | ✅ Oui |
| `AWS_REGION` | Région AWS SES | ✅ Oui |
| `AWS_ACCESS_KEY_ID` | Clé accès AWS | ✅ Oui |
| `AWS_SECRET_ACCESS_KEY` | Secret AWS | ✅ Oui |
| `GITHUB_ID` | OAuth GitHub | ✅ Oui |
| `GITHUB_SECRET` | OAuth GitHub | ✅ Oui |
| `GOOGLE_ID` | OAuth Google | ✅ Oui |
| `GOOGLE_SECRET` | OAuth Google | ✅ Oui |
| `SENTRY_DSN` | DSN Sentry (web) | ⚠️ Recommandé |
| `LICENSE_SECRET` | Secret validation licence | ⚠️ Recommandé |

### Mac App (Xcode Build Settings)
| Variable | Description | Requis |
|----------|-------------|--------|
| `SENTRY_DSN` | DSN Sentry pour crash reporting | ⚠️ Recommandé |
| `LICENSE_SECRET` | Secret pour validation licence locale (optionnel, fail-safe vers serveur) | ❌ Optionnel |

---

## Fichiers Critiques à Vérifier

| Fichier | Pourquoi |
|---------|----------|
| `landing/.env.production` | Tous les secrets de prod |
| `landing/lib/auth.ts` | Config NextAuth |
| `landing/lib/stripe.ts` | Config Stripe |
| `mac_app/Info.plist` | Version, bundle ID, Sentry DSN |
| `mac_app/QueenMama.entitlements` | Sandbox & permissions |
| `mac_app/Services/UpdaterManager.swift` | URL appcast |

---

## Checklist Finale Avant Lancement

### J-1 (Aujourd'hui)
- [ ] Notarization mac app OK
- [x] Secrets retirés du code
- [ ] Configurer `SENTRY_DSN` dans Xcode
- [ ] Stripe production configuré (env vars Vercel)
- [ ] AWS SES configuré (env vars Vercel)
- [ ] Appcast.xml déployé
- [ ] Test paiement de bout en bout
- [ ] Test inscription + vérification email
- [ ] Test device auth mac app

### J0 (Demain - Lancement)
- [ ] Backup base de données
- [ ] Monitoring Sentry activé
- [ ] Support email prêt
- [x] Pages erreur en place
- [x] Cookie banner actif
- [ ] Version finale mac app uploadée

### J+1 (Post-Lancement)
- [ ] Vérifier logs d'erreurs
- [ ] Vérifier Stripe webhooks
- [ ] Vérifier emails envoyés
- [ ] Monitorer crashes Sentry

---

## Contacts & Support

- **Stripe Dashboard**: https://dashboard.stripe.com
- **Sentry Dashboard**: https://sentry.io
- **Vercel Dashboard**: https://vercel.com
- **Neon Console**: https://console.neon.tech

---

*Généré par audit automatisé - 24 Jan 2026*
*Dernière mise à jour: 24 Jan 2026 - Secrets retirés, pages erreur et cookie consent ajoutés*
