# HAVIE — Project Rules

## 1. Technology Stack
- Use React, Vite, and JavaScript ES6+ for the frontend.
- Use Tailwind CSS v4 through the @tailwindcss/vite plugin.
- React Router and lucide-react are allowed as npm dependencies.
- Do not use jQuery, Bootstrap, or external script CDNs.
- Use const by default; use let only when reassignment is necessary.

## 2. Styling and Markup
- Prefer Tailwind utility classes directly in className.
- Allow @apply inside @layer components for reusable components
  or when migrating existing CSS.
- Allow plain CSS for resets, base styles, and cases that are
  difficult to express clearly with utility classes.
- Use standard Tailwind utilities when they match the original
  CSS values exactly.
- Preserve custom values using arbitrary values or theme tokens.
- Use complete, static class strings for conditional styling.
  Do not construct class names such as `bg-${color}-500`.
- Prefer semantic HTML elements such as header, nav, main,
  section, button, form, and footer.

## 3. CSS-to-Tailwind Migration
- Preserve the existing appearance, including colors, fonts,
  dimensions, spacing, layout, borders, shadows, and animations.
- Preserve the existing breakpoints: 600px, 900px, and 1200px.
- Do not replace them with default breakpoints if this changes
  responsive behavior.
- Do not round existing values: for example, keep 15px as 15px.
- Check the effects of Tailwind Preflight before enabling it.
- Migrate one component or interface section at a time.
- Remove old CSS only after migrating all its usages and
  confirming that no remaining elements depend on its selectors.
- Preserve React behavior, navigation, state, and API calls
  throughout the styling migration.

## 4. Responsive Design and Accessibility
- Follow a mobile-first approach.
- Verify the interface at a 375px viewport and on desktop.
- Check widths immediately below and above existing breakpoints.
- Prevent horizontal overflow except in intentionally scrollable areas.
- Preserve hover, focus-visible, active, and disabled states.
- Preserve support for prefers-reduced-motion.
- Associate inputs with labels.
- Provide accessible names for icon-only buttons.

## 5. API and Security
- Follow API_CONTRACT_HAVIE_v1.md.
- Do not modify the API contract or business logic solely
  for styling changes.
- The backend must enforce authentication, authorization,
  pricing, and inventory rules.
- Never render user-provided content with dangerouslySetInnerHTML.
- Do not commit .env files, secrets, node_modules, or dist.

## 6. Validation and Reporting
- Run npm run build after the migration.
- Compare before-and-after screenshots using identical
  viewport sizes, data, and interface states.
- Check relevant states, including open menus, modals,
  selected variants, and order status badges.
- Report the files changed and the checks actually performed.
- Do not claim visual equivalence without comparing the results.
- Update README to reflect the actual implementation.