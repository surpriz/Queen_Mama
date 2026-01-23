#!/bin/bash
# Script pour créer et pousser un tag automatiquement
# Usage: ./scripts/release.sh [beta|rc|prod]

set -e

TYPE=${1:-beta}

# Récupérer le dernier tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
echo "Dernier tag: $LAST_TAG"

# Extraire la version de base (ex: v1.0.7 de v1.0.7-beta.2)
BASE_VERSION=$(echo "$LAST_TAG" | sed -E 's/(-beta|-rc|-alpha)\.[0-9]+$//' | sed 's/^v//')

# Extraire le numéro beta/rc actuel
CURRENT_NUM=$(echo "$LAST_TAG" | grep -oE '\.[0-9]+$' | tr -d '.' || echo "0")

case $TYPE in
  beta)
    if [[ "$LAST_TAG" == *"-beta"* ]]; then
      # Incrémenter le numéro beta
      NEW_NUM=$((CURRENT_NUM + 1))
      NEW_TAG="v${BASE_VERSION}-beta.${NEW_NUM}"
    else
      # Nouveau cycle beta
      NEW_TAG="v${BASE_VERSION}-beta.1"
    fi
    ;;
  rc)
    if [[ "$LAST_TAG" == *"-rc"* ]]; then
      NEW_NUM=$((CURRENT_NUM + 1))
      NEW_TAG="v${BASE_VERSION}-rc.${NEW_NUM}"
    else
      NEW_TAG="v${BASE_VERSION}-rc.1"
    fi
    ;;
  prod)
    # Pour production, incrémenter le patch version
    IFS='.' read -r MAJOR MINOR PATCH <<< "$BASE_VERSION"
    PATCH=$((PATCH + 1))
    NEW_TAG="v${MAJOR}.${MINOR}.${PATCH}"
    ;;
  *)
    echo "Usage: $0 [beta|rc|prod]"
    exit 1
    ;;
esac

echo ""
echo "========================================"
echo "Nouveau tag: $NEW_TAG"
echo "========================================"
echo ""

read -p "Créer et pousser ce tag? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git tag -a "$NEW_TAG" -m "Release $NEW_TAG"
  git push origin "$NEW_TAG"
  echo ""
  echo "✅ Tag $NEW_TAG créé et poussé!"
  echo "👉 Vérifiez le build sur: https://github.com/surpriz/Queen_Mama/actions"
else
  echo "❌ Annulé"
fi
