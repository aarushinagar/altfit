"use client";

/**
 * ThemeRegistry — client-side wrapper for MUI theme providers.
 *
 * Uses @emotion/cache + useServerInsertedHTML to properly hydrate MUI emotion
 * styles in Next.js App Router, avoiding the SSR/client style-tag mismatch.
 */

import createCache from "@emotion/cache";
import { useServerInsertedHTML } from "next/navigation";
import { CacheProvider } from "@emotion/react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useState } from "react";
import theme from "./muiTheme";
import CssVariables from "./CssVariables";

function createEmotionCache() {
  const cache = createCache({ key: "mui" });
  cache.compat = true;
  const prevInsert = cache.insert.bind(cache);
  let inserted: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (cache as any).insert = (...args: any[]) => {
    const serialized = args[1] as { name: string };
    if (cache.inserted[serialized.name] === undefined) {
      inserted.push(serialized.name);
    }
    return prevInsert(...(args as Parameters<typeof prevInsert>));
  };
  const flush = () => {
    const prev = inserted;
    inserted = [];
    return prev;
  };
  return { cache, flush };
}

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ cache, flush }] = useState(createEmotionCache);

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) return null;
    let styles = "";
    for (const name of names) {
      styles += cache.inserted[name];
    }
    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <CssVariables />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
