## Code Style
- When creating components, use the following style: `const NewComponent: React.FC<NewComponentProps> = () => {...}`. Define the props type directly above the component.
- Default to `type` instead of `interface` unless there's an explicit reason not to.
- Use path aliases for imports (defined in `tsconfig.json` → `compilerOptions.paths`).
- Order imports as follows: global imports, blank line, alias imports, blank line, local imports (via `./` or `../`).
- Use styled-components for styling.
- Formatting: Prettier (config in `.prettierrc`) — run `npm run format` after making changes.
