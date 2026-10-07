---
name: frontend-architecture
description: "Use when building, redesigning, refactoring, reviewing, or debugging frontend interfaces across vanilla web, React, Next.js, Vue, Angular, Svelte, Solid, or utility CSS stacks. Guides accessible, responsive, performant implementation that follows the existing project architecture."
---

# Frontend Architecture

Use this workflow to deliver production-ready frontend changes that fit the repository's stack and design system.

## Procedure

1. **Understand the existing app.** Read the repository instructions and inspect the target page/component, nearby styles, data flow, package scripts, and relevant tests. Identify the framework, routing/rendering model, styling approach, and established visual patterns. Do not introduce a new framework or design system when the project already has one.

2. **Define the smallest testable change.** Trace the code that directly controls the requested behavior. State a concrete hypothesis and the cheapest check that could disprove it. For a visual request, identify the affected viewport, component states, and existing design constraints before editing.

3. **Choose stack-native patterns.**
   - For HTML/CSS/JavaScript, use semantic markup, CSS custom properties, responsive Flexbox/Grid, and clear asynchronous lifecycle cleanup.
   - For React, use functional components and the repository's state conventions. Add memoization only when justified by the codebase or measured need. In Next.js App Router, prefer Server Components and keep client boundaries limited to interactive behavior.
   - For Vue/Nuxt, use the Composition API and preserve reactive dependency tracking. For Angular, follow standalone-component and Signals conventions when used by the project. For Svelte/Solid, use their native reactive patterns.
   - For Tailwind, CSS Modules, Sass, or another styling system, follow its existing tokens and component-scoping conventions. Avoid arbitrary values when a shared token or utility exists.

4. **Design for real use.** Keep information hierarchy clear and controls predictable. Make layouts responsive without horizontal overflow; maintain WCAG 2.1 AA contrast, keyboard access, visible focus, semantic labels, and accessible feedback. Respect reduced-motion preferences and avoid layout shifts. Use existing assets and components where suitable.

5. **Implement robust state and performance.** Cover loading, success, empty, and error states where relevant. Keep state ownership clear, avoid unnecessary rerenders and duplicate work, clean up subscriptions/listeners, and validate cached or remote data before use. Do not add abstractions unless they remove real complexity.

6. **Validate the touched workflow.** Run the narrowest relevant test, typecheck, lint, or build immediately after editing. For user-facing changes, verify the affected interaction and, when browser tooling is available, inspect desktop and mobile layouts, keyboard focus, and important states. Fix regressions before widening validation; report any check that could not be run.

7. **Summarize the outcome.** Briefly state what changed, the checks run and their results, and any remaining limitation. Keep explanations proportional to the task; do not bury the working solution under generic introductions.

## Completion Criteria

- The implementation follows repository conventions and changes only the requested surface.
- The interaction works across relevant states and viewport sizes, with accessible semantics and focus behavior.
- No avoidable layout shift, overflow, console/runtime error, or unhandled asynchronous work is introduced.
- Focused validation passes, or any unavailable verification is stated clearly.