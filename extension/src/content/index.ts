import type { ExtensionMessage } from "../domain/messages";
for (const type of ["click", "input", "change"] as const) {
  document.addEventListener(
    type,
    (event) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element) return;
      const action: ExtensionMessage = {
        type: "content/action",
        action: {
          timestamp: Date.now(),
          type,
          url: redactPageUrl(location.href),
          target: describeElement(element),
          value: inputValue(element),
        },
      };
      void chrome.runtime.sendMessage(action).catch(() => undefined);
    },
    { capture: true },
  );
}
function inputValue(element: Element): string | undefined {
  if (element instanceof HTMLInputElement)
    return element.type === "password" ? "[REDACTED]" : element.value.slice(0, 2000);
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)
    return element.value.slice(0, 2000);
  return undefined;
}
function redactPageUrl(raw: string) {
  const url = new URL(raw);
  for (const name of [...url.searchParams.keys()])
    if (/token|secret|password|session|cookie|key/i.test(name))
      url.searchParams.set(name, "[REDACTED]");
  return url.toString();
}
function describeElement(element: Element): Record<string, unknown> {
  const html = element as HTMLElement;
  const input = element instanceof HTMLInputElement ? element : undefined;
  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || undefined,
    testId: element.getAttribute("data-testid") ?? undefined,
    name: element.getAttribute("name") ?? undefined,
    role: element.getAttribute("role") ?? undefined,
    ariaLabel: element.getAttribute("aria-label") ?? undefined,
    type: input?.type,
    placeholder: input?.placeholder || undefined,
    text: input
      ? undefined
      : html.innerText?.trim().replace(/\s+/g, " ").slice(0, 120) || undefined,
  };
}
