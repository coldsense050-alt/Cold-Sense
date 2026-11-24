export function getLoginDestination(from: unknown, origin: string): string {
  if (typeof from !== "string" || !from.startsWith("/") || from.startsWith("//")) {
    return "/";
  }

  try {
    const destination = new URL(from, origin);
    const pathname = decodeURIComponent(destination.pathname).replace(/\/+$/, "").toLowerCase();

    if (destination.origin !== origin || destination.pathname.startsWith("//") || pathname === "/login") {
      return "/";
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}
