import { Fragment, type ReactNode } from "react";

/**
 * Pewarnaan sintaks RouterOS: komentar, path menu (/ip firewall),
 * kata kerja (add/set), nama parameter, dan nilainya.
 */
export function highlightScriptLine(line: string): ReactNode {
  const trimmed = line.trimStart();
  if (!trimmed) return <span>&nbsp;</span>;
  if (trimmed.startsWith("#")) return <span className="text-faint/80">{line}</span>;

  const tokens = line.match(/(\S+)(\s*)/g) ?? [];
  return (
    <>
      {tokens.map((token, i) => {
        const word = token.trimEnd();
        const space = token.slice(word.length);
        let node = <span className="text-ink">{word}</span>;

        if (word.startsWith("/")) {
          node = <span className="text-brand">{word}</span>;
        } else if (i === 0 && /^(add|set|print)$/.test(word)) {
          node = <span className="font-medium text-accent">{word}</span>;
        } else if (word.includes("=")) {
          const at = word.indexOf("=");
          const key = word.slice(0, at);
          const value = word.slice(at + 1);
          node = (
            <>
              <span className="text-muted">{key}</span>
              <span className="text-faint">=</span>
              <span className={value.startsWith('"') ? "text-warn/90" : "text-ink"}>{value}</span>
            </>
          );
        }

        return (
          <Fragment key={i}>
            {node}
            {space}
          </Fragment>
        );
      })}
    </>
  );
}
