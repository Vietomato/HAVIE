# Project Architectural Constraints
- Use Vanilla HTML5, modern CSS, and ES6+ JS exclusively.
- No jQuery, Bootstrap, Tailwind, or external script CDNs.
- Prioritize native semantic HTML over generic <div> containers.
- Declare variables using const by default, let only if reassigned.
- Never render unescaped user inputs with innerHTML (XSS risk).
- Mobile-first: Verify 375px viewport prior to desktop.
-
## Framework clarification
The requested React/Vite stack is an explicit exception to the "Vanilla HTML5 ... exclusively" rule: use React JSX components, native semantic HTML elements, modern plain CSS, and ES6+ JavaScript. No CSS frameworks, jQuery, or CDN scripts. React Router and lucide-react are npm dependencies. Never use dangerouslySetInnerHTML for user content.
