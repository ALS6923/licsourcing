# Aether Sourcing - Modèle de Scoring et Classification (V2)

Ce document définit les critères de décision utilisés par l'Orchestrateur pour qualifier les fournisseurs.

## 1. Calcul du Relevance Score (Fondamental)
Le score de pertinence (0-100) est attribué par l'agent de Consolidation (LLM) en fonction de :
- **Adéquation Produit (+40 pts)** : Le produit vendu est-il exactement celui recherché ?
- **Profil Industriel (+20 pts)** : Priorité aux fabricants directs par rapport aux intermédiaires.
- **Preuves de Fiabilité (+20 pts)** : Présence de certifications, historique visible, site structuré.
- **Localisation (+20 pts)** : Respect des zones géographiques demandées.

## 2. Seuils de Classification

### 🟢 Exploitable
*   **Conditions** : Score ≥ 70 **ET** Site Web officiel identifié **ET** Coordonnées directs (Email/Tel) trouvées.
*   **Usage** : Le fournisseur peut être contacté immédiatement par l'utilisateur.

### 🟡 À vérifier manuellement
*   **Cas A (Manque de contact)** : Score ≥ 50 **ET** Site Web identifié **MAIS** aucune coordonnée directe extraite automatiquement.
    *   *Nuance* : Si le score initial est ≥ 80, le score final est fixé à **75**. Sinon, il est fixé à **60**.
*   **Cas B (Faible adéquation)** : Site et contacts trouvés **MAIS** score de pertinence entre 40 et 70.
*   **Usage** : Nécessite une revue humaine rapide pour confirmer l'adéquation ou trouver un email via formulaire.

### 🔴 Rejeté
*   **Conditions** : Score < 40 **OU** Aucun site web officiel trouvé.
*   **Usage** : Fournisseur écarté pour manque de fiabilité ou de pertinence.

## 3. Audit Technique (Supplier Evidence)
Chaque décision est appuyée par un objet `technical_audit` stocké en JSONB, contenant :
- `initialExtraction` : Données brutes de recherche.
- `legalCheck` : Verdict de l'agent de vérification légale.
- `activityAndContact` : Détails de l'extraction Web.
- `finalScoring` : Raisonnement détaillé du LLM de consolidation.
