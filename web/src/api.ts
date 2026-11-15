export type Badge = 'unchecked' | 'auto-checked' | 'reviewed';
export interface Counts { pass: number; warn: number; fail: number; skipped: number }
export interface Summary {
    identifier: string; name: string; description: string; publisher: string; createdAt: string;
    badge: Badge; openFlags: number; reviewCount: number; removed: boolean; removedReason: string | null;
    audit: { checkerVersion: string; counts: Counts } | null;
}
export interface CheckResult { id: string; title: string; status: 'pass' | 'warn' | 'fail' | 'skipped'; message: string; details?: string[] }
export interface Detail extends Summary {
    template: unknown;
    auditReport: { checkerVersion: string; results: CheckResult[] } | null;
    actions: { id: string; name: string; description: string; roles: string[] }[];
    roles: { id: string; name: string; description: string }[];
    flags: { id: number; reason: string; reporter: string; status: string; createdAt: string }[];
    reviews: { id: number; reviewerAddress: string; reviewerLabel?: string | null; note: string; createdAt: string }[];
}
export interface Decision { decision: 'allow' | 'block'; reasons: string[] }

export async function api<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
    const response = await fetch(path, {
        method: init.method ?? 'GET',
        headers: { ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error((data as { error?: string }).error ?? `Request failed (${response.status})`);
    }

    return data as T;
}
