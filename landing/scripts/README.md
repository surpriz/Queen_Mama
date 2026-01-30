# Scripts de Test et Benchmark

Ce dossier contient des scripts utilitaires pour tester et benchmarker les modèles d'IA.

## 📋 Scripts disponibles

### 1. Test des IDs de modèles

**Fichier:** `test-model-ids.ts`
**Commande:** `npm run test:models`

Vérifie que tous les modèles d'IA configurés (OpenAI, Anthropic, Gemini, Grok) sont accessibles avec les clés API en base de données.

**Utilisation:**
```bash
cd landing
npm run test:models
```

**Ce qu'il teste:**
- Connexion à chaque provider
- Validité des IDs de modèles
- Latence basique de réponse

**Sortie exemple:**
```
📡 Testing OPENAI...
   gpt-5-mini... ✅ OK (1234ms)
   gpt-4.1-mini... ✅ OK (987ms)
   o4-mini... ✅ OK (1567ms)
   gpt-5... ✅ OK (2345ms)

📊 SUMMARY
✅ OPENAI: 4/4 models working
```

---

### 2. Benchmark OpenAI (nouveau)

**Fichier:** `benchmark-openai.ts`
**Commande:** `npm run benchmark:openai`

Benchmark complet des modèles OpenAI avec métriques détaillées de performance.

**Utilisation:**
```bash
cd landing
npm run benchmark:openai
```

**Métriques mesurées:**

| Métrique | Description |
|----------|-------------|
| **TTFB** | Time to First Byte - Latence avant le premier token (ms) |
| **Total Time** | Temps total de génération (ms) |
| **Tokens/sec** | Vitesse de génération en tokens par seconde |
| **Vision Support** | Test avec et sans screenshot |

**Tests effectués:**
- ✅ Mode Standard (4 modèles): gpt-5-mini, gpt-4.1-mini, gpt-4o, gpt-4o-mini
- ✅ Mode Smart (3 modèles): o4-mini, gpt-5, o1-mini
- ✅ Avec texte seul
- ✅ Avec vision (screenshot)

**Sortie exemple:**
```
🔬 OpenAI Model Benchmark
================================================================================

🔑 Loading API key from database...
✅ API key loaded

📊 Testing STANDARD MODE models...

   Testing gpt-5-mini...
      • Text only:  ✅ TTFB: 234ms | Total: 1.23s | 45.2 tok/s
      • With vision: ✅ TTFB: 456ms | Total: 2.34s | 38.7 tok/s

   Testing gpt-4.1-mini...
      • Text only:  ✅ TTFB: 189ms | Total: 1.01s | 52.3 tok/s
      • With vision: ✅ TTFB: 401ms | Total: 2.11s | 42.1 tok/s

🧠 Testing SMART MODE models...

   Testing o4-mini...
      • Text only:  ✅ TTFB: 567ms | Total: 3.45s | 28.4 tok/s
      • With vision: ✅ TTFB: 789ms | Total: 4.56s | 24.1 tok/s

================================================================================
📈 BENCHMARK SUMMARY

📊 STANDARD MODE:
   4/4 models working

   Fastest (by TTFB):
      gpt-4.1-mini          189ms | 52.3 tok/s
      gpt-5-mini            234ms | 45.2 tok/s
      gpt-4o                298ms | 41.8 tok/s

🧠 SMART MODE:
   3/3 models working

   Fastest (by TTFB):
      o4-mini               567ms | 28.4 tok/s
      gpt-5                 612ms | 25.7 tok/s
      o1-mini               701ms | 22.3 tok/s

👁️  VISION SUPPORT:
   ✅ 7 models support vision
      • gpt-5-mini
      • gpt-4.1-mini
      • gpt-4o
      • gpt-4o-mini
      • o4-mini
      • gpt-5
      • o1-mini

================================================================================
🎯 Total: 14/14 tests passed
```

---

## 🔧 Prérequis

### Base de données configurée
Les scripts utilisent les clés API stockées dans la base de données Postgres via Prisma.

**Vérifier la configuration:**
```bash
# 1. Vérifier que .env contient DATABASE_URL et ENCRYPTION_KEY
cat .env | grep -E "DATABASE_URL|ENCRYPTION_KEY"

# 2. Vérifier que la base est migrée
npx prisma migrate status

# 3. Vérifier les clés API en base
npx prisma studio
# → Ouvrir la table AdminApiKey
```

### Ajouter une clé API via Prisma Studio
```bash
npx prisma studio
```

1. Aller dans la table `AdminApiKey`
2. Créer un nouvel enregistrement:
   - `provider`: "OPENAI"
   - `encryptedKey`: Votre clé OpenAI (sera automatiquement encryptée)
   - `isActive`: true

---

## 📊 Interpréter les résultats

### TTFB (Time to First Byte)
- **< 200ms**: Excellent - Réponse quasi-instantanée
- **200-500ms**: Bon - Acceptable pour mode standard
- **500-1000ms**: Moyen - Acceptable pour mode smart (raisonnement)
- **> 1000ms**: Lent - Peut nécessiter optimisation

### Tokens/sec
- **> 50 tok/s**: Très rapide - Idéal pour mode standard
- **30-50 tok/s**: Rapide - Bon pour usage en temps réel
- **20-30 tok/s**: Moyen - Acceptable pour mode smart
- **< 20 tok/s**: Lent - Peut frustrer l'utilisateur

### Vision Support
Les modèles marqués ✅ peuvent traiter des screenshots. Essentiel pour:
- Analyse d'écran en temps réel
- Questions sur du contenu visuel
- Assistance sur des diagrammes/tableaux

---

## 🐛 Debugging

### Erreur "No API key in database"
```bash
# Vérifier que la clé existe et est active
npx prisma studio
# → Table AdminApiKey → Vérifier provider et isActive
```

### Erreur "Invalid or expired token"
```bash
# Re-générer une nouvelle clé OpenAI
# → https://platform.openai.com/api-keys
# → Remplacer dans Prisma Studio
```

### Erreur "Model not found"
Le modèle n'est pas disponible dans votre compte OpenAI. Vérifier:
- Votre plan OpenAI (certains modèles nécessitent un plan payant)
- L'orthographe exacte de l'ID du modèle
- La disponibilité du modèle (certains sont en beta limitée)

### Tests très lents
- Vérifier votre connexion internet
- Vérifier les limites de taux (rate limits) OpenAI
- Essayer à un moment différent de la journée

---

## 🚀 Développement

### Ajouter un nouveau modèle à tester

**1. Modifier `benchmark-openai.ts`:**
```typescript
const OPENAI_MODELS = {
  standard: [
    "gpt-5-mini",
    "nouveau-modele",  // Ajouter ici
  ],
  // ...
}
```

**2. Exécuter le benchmark:**
```bash
npm run benchmark:openai
```

### Créer un benchmark pour un autre provider

Copier `benchmark-openai.ts` et adapter:
- URL de l'API
- Format des requêtes
- Parsing des réponses streaming

---

## 📝 Notes

- Les tests utilisent le streaming pour mesurer le TTFB avec précision
- Chaque test génère ~100 tokens pour des résultats cohérents
- Les images de test sont des pixels 1x1 minimaux pour réduire la latence
- Les résultats peuvent varier selon:
  - Charge du serveur OpenAI
  - Votre localisation géographique
  - Votre connexion internet
  - L'heure de la journée

---

## 🔗 Liens utiles

- [OpenAI Models](https://platform.openai.com/docs/models)
- [OpenAI Rate Limits](https://platform.openai.com/docs/guides/rate-limits)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
