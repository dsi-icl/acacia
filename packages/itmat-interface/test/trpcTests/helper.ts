export function encodeQueryParams(s: unknown): string {
    return encodeURIComponent(JSON.stringify(s));
}
