// The scaffold's one story subject (WP-0): the package name and its entry
// points, so the browser project has a story to run and axe to check.
// Developer-facing text, not a kit component; it is not translated.
export function Welcome(props: { entries: readonly string[] }) {
  return (
    <main>
      <h1>@rootxkit/uspace-ui</h1>
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
