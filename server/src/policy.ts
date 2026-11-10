import { BADGE_RANK, type Badge } from './badges.js';

/** A wallet-style trust policy, evaluated against what the hub knows about a template. */
export interface Policy {
    /** Minimum badge required. Default: unchecked (anything goes). */
    minBadge?: Badge;
    /** Block templates that have open flags. Default: false. */
    blockFlagged?: boolean;
    /** Identifiers that are always allowed (overrides every other rule except a block-list entry). */
    allowIdentifiers?: string[];
    /** Identifiers that are always blocked. */
    blockIdentifiers?: string[];
}

export interface PolicySubject {
    identifier: string;
    badge: Badge;
    openFlags: number;
    removed: boolean;
}

export interface PolicyDecision {
    decision: 'allow' | 'block';
    reasons: string[];
}

const BADGES = new Set<string>(Object.keys(BADGE_RANK));

/** Returns a list of problems with a policy object; an empty list means it is usable. */
export function validatePolicy(policy: unknown): string[] {
    if (policy === null || typeof policy !== 'object' || Array.isArray(policy)) {
        return ['policy must be an object'];
    }

    const p = policy as Record<string, unknown>;
    const problems: string[] = [];

    if (p.minBadge !== undefined && !(typeof p.minBadge === 'string' && BADGES.has(p.minBadge))) {
        problems.push('minBadge must be one of: unchecked, auto-checked, reviewed');
    }

    if (p.blockFlagged !== undefined && typeof p.blockFlagged !== 'boolean') {
        problems.push('blockFlagged must be true or false');
    }

    for (const key of ['allowIdentifiers', 'blockIdentifiers'] as const) {
        const value = p[key];

        if (value !== undefined && !(Array.isArray(value) && value.every((v) => typeof v === 'string'))) {
            problems.push(`${key} must be a list of identifier strings`);
        }
    }

    return problems;
}

/** Evaluates a policy for one template. The block-list always wins; removed templates are always blocked. */
export function evaluatePolicy(policy: Policy, subject: PolicySubject): PolicyDecision {
    if (subject.removed) {
        return { decision: 'block', reasons: ['Template was removed by a moderator.'] };
    }

    if (policy.blockIdentifiers?.includes(subject.identifier)) {
        return { decision: 'block', reasons: ['Identifier is on the policy block list.'] };
    }

    if (policy.allowIdentifiers?.includes(subject.identifier)) {
        return { decision: 'allow', reasons: ['Identifier is on the policy allow list.'] };
    }

    const reasons: string[] = [];
    const minBadge = policy.minBadge ?? 'unchecked';

    if (BADGE_RANK[subject.badge] < BADGE_RANK[minBadge]) {
        reasons.push(`Badge "${subject.badge}" is below the required "${minBadge}".`);
    }

    if (policy.blockFlagged && subject.openFlags > 0) {
        reasons.push(`Template has ${subject.openFlags} open flag${subject.openFlags === 1 ? '' : 's'}.`);
    }

    if (reasons.length > 0) {
        return { decision: 'block', reasons };
    }

    return { decision: 'allow', reasons: ['Meets every rule in the policy.'] };
}
