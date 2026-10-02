// The scaffold's first browser subject (WP-0): the package name and its
// entry points, so the browser project has a component to render and axe
// to check.
// Developer-facing text, not a kit component; it is not translated, except
// the language line, which shows a Georgian run from the kit's catalogue
// set in the kit's font stack (WP-2).
import { en, ka } from "../src/i18n/index.js";

export function Welcome(props: { entries: readonly string[] }) {
  return (
    <main>
      <h1>@rootxkit/uspace-ui</h1>
      <p data-testid="languages">
        <span lang="ka">{ka["lang.name.ka"]}</span> ·{" "}
        <span lang="en">{en["lang.name.en"]}</span>
      </p>
      <p>Entry points:</p>
      <ul>
        {props.entries.map((e) => (
          <li key={e}>
            <code>{e}</code>
          </li>
        ))}
      </ul>
    </main>
  );
}
