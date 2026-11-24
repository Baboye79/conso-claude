# conso-claude

Un mod pour Claude Code qui affiche, dans une barre au-dessus du prompt, tes limites d'utilisation
(fenêtre de 5 heures et limite hebdomadaire, avec une barre de progression et le temps restant avant
réinitialisation), le remplissage du contexte et le coût estimé de la session. À la fin de chaque
réponse, il ajoute aussi une ligne de résumé dans la conversation.

Les limites ne s'affichent qu'avec un abonnement Claude (pas avec une clé API), après la première
réponse de la session.

## Installation

Dans un terminal, à l'invite d'une session Claude Code :

```
/plugin install conso-claude --marketplace Baboye79/conso-claude
```

Réponds `y` pour ajouter la marketplace, puis valide la portée proposée avec Entrée.

Depuis un shell :

```bash
claude plugin install conso-claude --marketplace Baboye79/conso-claude
```

Dans l'application de bureau, où `/plugin` ne fonctionne pas : clique sur **+** à côté de la zone de
saisie, puis **Plugins**, **Add marketplace** avec `Baboye79/conso-claude`, puis **Add plugin**.

## Copie des limites pour un widget macOS

Le mod écrit aussi les dernières limites lues dans
`~/Library/Application Support/ClaudeUsageWidget/limits.json`. Ce petit fichier JSON sert à un widget
de bureau macOS ; si tu n'en utilises pas, tu peux l'ignorer.
