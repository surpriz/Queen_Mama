# Queen Mama

**Application macOS d'assistance IA en temps réel pour réunions, appels et entretiens**

Queen Mama est un assistant intelligent qui écoute vos conversations en temps réel et fournit des suggestions contextuelles instantanées via un widget discret. Idéal pour les entretiens d'embauche, les réunions professionnelles, les appels de vente et toute situation nécessitant une assistance intelligente.

---

## 🌟 Fonctionnalités principales

### Assistance en temps réel
- **Transcription audio en direct** : Capture et transcrit automatiquement vos conversations
- **Analyse contextuelle** : Comprend le contexte grâce à la capture d'écran
- **Suggestions IA intelligentes** : Génère des réponses adaptées à votre situation
- **Widget overlay** : Interface discrète toujours visible pour consulter les suggestions

### Modes spécialisés
Queen Mama s'adapte à votre contexte avec plusieurs modes prédéfinis :

- **Default** : Mode polyvalent pour toutes situations
- **Professional** : Langage formel adapté aux environnements corporate
- **Interview** : Assistance pour entretiens d'embauche avec format STAR
- **Sales** : Aide à la négociation et au closing de deals

Chaque mode peut être enrichi avec vos propres documents (CV, pitch deck, etc.).

### Modes de traitement IA

- **Mode Standard** : Réponses rapides et efficaces pour la plupart des situations
- **Mode Smart** : Utilise des modèles de raisonnement avancés pour les questions complexes

### Providers IA multiples

L'application supporte plusieurs fournisseurs d'IA avec basculement automatique :

**Mode Standard** :
1. Anthropic Claude Sonnet 4.5
2. Grok 4.1 Fast
3. OpenAI GPT-4o mini
4. Anthropic Claude Haiku 4.5
5. Google Gemini (backup)

**Mode Smart** :
1. Anthropic Claude Sonnet 4.5 Thinking
2. Grok 4.1 Fast Reasoning
3. OpenAI o3
4. OpenAI GPT-5.2
5. Google Gemini (backup)

### Gestion des sessions
- **Historique complet** : Toutes vos sessions sont sauvegardées avec SwiftData
- **Transcriptions archivées** : Relisez vos conversations passées
- **Résumés automatiques** : Génération de résumés et action items
- **Export des données** : Exportez vos sessions au besoin

### Intégration système
- **Menu Bar** : Accès rapide via l'icône dans la barre de menu
- **Raccourcis clavier globaux** :
  - `⌘⇧S` : Démarrer/Arrêter une session
  - `⌘\` : Afficher/Masquer le widget
  - `⌘⇧D` : Ouvrir le dashboard
- **Fonctionnement en arrière-plan** : Continue à fonctionner même avec les fenêtres fermées

---

## 💻 Compatibilité

### Architectures supportées

**✅ Universal Binary** - L'application est compatible avec tous les Mac modernes :

- **Apple Silicon (arm64)** : M1, M2, M3, M4 et versions futures
  - Exécution native avec performances optimales
  - Aucun besoin de Rosetta 2

- **Intel (x86_64)** : Tous les Mac Intel
  - Exécution native pour performances maximales

### Vérification de l'architecture

Pour vérifier les architectures supportées par votre build :

```bash
# Afficher les architectures
lipo -info /path/to/QueenMama.app/Contents/MacOS/QueenMama

# Résultat attendu :
# Architectures in the fat file: [...] are: x86_64 arm64
```

### Configuration système requise

- **macOS** : 14.2 (Sonoma) ou supérieur
- **RAM** : 8 Go minimum (16 Go recommandé pour les modèles Smart)
- **Connexion Internet** : Requise pour les API IA
- **Microphone** : Pour la capture audio
- **Permissions système** :
  - Microphone
  - Enregistrement d'écran
  - Automation (pour détecter l'app active)

---

## 🏗️ Architecture technique

### Technologies utilisées

- **Framework UI** : SwiftUI (moderne et déclaratif)
- **Persistance** : SwiftData (stockage local des sessions)
- **Concurrency** : Swift 6 avec strict concurrency
- **Networking** : URLSession pour les appels API
- **Audio** : AVFoundation pour la capture audio
- **Screen Capture** : ScreenCaptureKit pour la capture d'écran

### Structure du projet

```
QueenMama/
├── Models/               # Modèles de données SwiftData
│   ├── Session.swift    # Sessions et transcriptions
│   ├── Mode.swift       # Modes et configurations
│   └── AIResponse.swift # Réponses IA sauvegardées
│
├── Services/            # Logique métier
│   ├── AudioCaptureService.swift      # Capture audio
│   ├── ScreenCaptureService.swift     # Capture écran
│   ├── TranscriptionService.swift     # Transcription en temps réel
│   ├── AIService.swift                # Orchestration des providers IA
│   ├── SessionManager.swift           # Gestion des sessions
│   ├── KeychainManager.swift          # Stockage sécurisé des API keys
│   ├── ConfigurationManager.swift     # Configuration app
│   ├── ResponseCache.swift            # Cache des réponses (optimisation coûts)
│   ├── TokenUsageTracker.swift        # Suivi de l'utilisation tokens
│   └── Providers/                     # Implémentations providers IA
│       ├── AIProvider.swift           # Protocol de base
│       ├── AnthropicProvider.swift
│       ├── AnthropicHaikuProvider.swift
│       ├── OpenAIProvider.swift
│       ├── OpenAIGPT5Provider.swift
│       ├── GrokProvider.swift
│       └── GeminiProvider.swift
│
├── Views/               # Interface utilisateur
│   ├── Dashboard/       # Vue principale
│   │   ├── DashboardView.swift
│   │   ├── SessionListView.swift
│   │   ├── LiveSessionView.swift
│   │   ├── SettingsView.swift
│   │   └── ModesListView.swift
│   ├── Overlay/         # Widget overlay
│   │   ├── OverlayWindow.swift
│   │   ├── OverlayContentView.swift
│   │   └── OverlayPopupMenu.swift
│   └── Onboarding/      # Configuration initiale
│       └── OnboardingView.swift
│
└── Utilities/           # Helpers et extensions
    ├── DesignSystem.swift        # Thème et composants UI
    ├── KeyboardShortcuts.swift   # Raccourcis globaux
    └── Extensions/
        └── Extensions.swift
```

### Sécurité et sandboxing

L'application utilise l'App Sandbox macOS avec les permissions suivantes :

```xml
<!-- Permissions (QueenMama.entitlements) -->
✓ App Sandbox activé
✓ Microphone access (audio-input)
✓ Network client (API calls)
✓ User-selected files (read-only pour attachments)
✓ User-selected files (read-write pour exports)
```

Les clés API sont stockées de manière sécurisée dans le Keychain macOS.

---

## 🚀 Installation et configuration

### Compilation du projet

```bash
# Cloner le repository
cd /path/to/Queen_Mama-ui-fixes

# Ouvrir dans Xcode
open QueenMama.xcodeproj

# Ou compiler en ligne de commande (Universal Binary)
xcodebuild -project QueenMama.xcodeproj \
           -scheme QueenMama \
           -configuration Release \
           -arch arm64 -arch x86_64 \
           ONLY_ACTIVE_ARCH=NO
```

### Configuration des API Keys

Au premier lancement, l'application vous guidera à travers le processus d'onboarding :

1. **Choisir vos providers IA** : Sélectionnez un ou plusieurs fournisseurs
2. **Entrer les API keys** : Configurez vos clés d'accès
3. **Accorder les permissions** : Microphone, écran, automation
4. **Tester la configuration** : Vérifier que tout fonctionne

Les API keys disponibles :
- **Anthropic** : `ANTHROPIC_API_KEY`
- **OpenAI** : `OPENAI_API_KEY`
- **Grok (xAI)** : `GROK_API_KEY`
- **Google Gemini** : `GEMINI_API_KEY`

### Configuration avancée

Vous pouvez personnaliser les modes dans les paramètres :
- Modifier les prompts système
- Attacher des documents de référence (CV, pitch deck)
- Configurer les préférences de provider

---

## 📊 Optimisations et coûts

### Cache des réponses

Queen Mama implémente un cache intelligent pour réduire les coûts d'API :
- **Déduplication** : Évite de redemander la même chose
- **Cache temporel** : Réutilise les réponses récentes similaires
- **Économies** : Jusqu'à 30-50% de réduction des coûts API

### Suivi de l'utilisation

Le `TokenUsageTracker` vous permet de :
- Suivre la consommation de tokens par provider
- Estimer les coûts en temps réel
- Optimiser votre utilisation

### Limites de contexte

L'application optimise automatiquement la taille des transcriptions envoyées pour :
- Réduire les coûts
- Améliorer les temps de réponse
- Rester dans les limites de contexte des modèles

---

## 🔒 Confidentialité et données

### Traitement local
- Les transcriptions sont traitées localement
- Aucune donnée n'est envoyée aux serveurs Queen Mama
- Stockage local avec SwiftData (SQLite chiffré)

### API externes
- Les transcriptions sont envoyées aux providers IA que vous configurez
- Consultez les politiques de confidentialité de chaque provider
- Vous gardez le contrôle de vos données via vos propres API keys

### Permissions
Toutes les permissions sont expliquées clairement :
- **Microphone** : "Pour transcriber votre voix durant les réunions et appels"
- **Capture d'écran** : "Pour capturer le contexte visuel pour l'assistance IA"
- **Automation** : "Pour détecter les applications actives"

---

## 🛠️ Développement

### Prérequis
- Xcode 15.0+
- Swift 5.9+
- macOS 14.2+ SDK

### Build configurations

**Debug** :
- Optimisations désactivées
- Symboles de débogage inclus
- Logging verbeux activé

**Release** :
- Optimisations complètes
- Code signing avec hardened runtime
- Bundle optimisé

### Team et code signing

```swift
DEVELOPMENT_TEAM = WNNDDTBPGK
PRODUCT_BUNDLE_IDENTIFIER = com.queenmama.app
CODE_SIGN_IDENTITY = "Apple Development"
```

---

## 📝 Utilisation

### Workflow typique

1. **Lancer l'application** : L'icône apparaît dans la barre de menu
2. **Sélectionner un mode** : Choisir le contexte approprié
3. **Démarrer une session** : `⌘⇧S` ou via le menu
4. **Parler naturellement** : L'IA écoute et analyse en temps réel
5. **Consulter les suggestions** : Via le widget overlay
6. **Arrêter la session** : `⌘⇧S` à nouveau
7. **Revoir l'historique** : Dans le dashboard

### Astuces
- Le widget est redimensionnable et déplaçable
- Utilisez le mode Smart pour les questions complexes
- Attachez des documents pertinents à vos modes pour un contexte enrichi
- L'application détecte automatiquement la langue et répond dans la même

---

## 🐛 Résolution de problèmes

### L'audio ne fonctionne pas
- Vérifier les permissions système : Préférences Système > Confidentialité > Microphone
- Vérifier le périphérique audio sélectionné dans les paramètres
- Redémarrer l'application

### Pas de réponse de l'IA
- Vérifier que les API keys sont correctement configurées
- Vérifier la connexion Internet
- Consulter les logs pour les erreurs API
- Essayer un autre provider

### Le widget ne s'affiche pas
- Utiliser `⌘\` pour afficher/masquer
- Vérifier les permissions d'accessibilité
- Redémarrer l'application

### Erreurs de compilation
- Nettoyer le build folder : `⌘⇧K` dans Xcode
- Supprimer DerivedData
- Vérifier la version de Xcode (15.0+ requis)

---

## 📄 Licence et crédits

### Développement
Développé avec ❤️ pour améliorer les conversations professionnelles

### Technologies tierces
- SwiftUI & SwiftData (Apple)
- Fournisseurs IA : Anthropic, OpenAI, xAI, Google
- Services de transcription temps réel

---

## 🔄 Versions et historique

### Version 1.0.0
- Lancement initial
- Support Universal Binary (Intel + Apple Silicon)
- Multiple providers IA avec fallback automatique
- Modes spécialisés (Professional, Interview, Sales)
- Cache et optimisation des coûts
- Dashboard complet avec historique
- Widget overlay personnalisable

---

## 📞 Support

Pour toute question ou problème :
1. Consultez d'abord cette documentation
2. Vérifiez les logs de l'application
3. Testez avec différents providers
4. Vérifiez les permissions système

---

**Queen Mama** - Votre assistant IA en temps réel pour exceller dans toutes vos conversations professionnelles.
