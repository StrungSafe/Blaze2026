export type Badge = 'unchecked' | 'auto-checked' | 'reviewed';

export const BADGE_RANK: Record<Badge, number> = { unchecked: 0, 'auto-checked': 1, reviewed: 2 };

export interface BadgeInput {
    /** True when an audit report exists for the template. */
    hasReport: boolean;
    /** True when the latest report has no failing check. */
    reportHasNoFailures: boolean;
    reviewCount: number;
}

/**
 * Derives the badge. "auto-checked" means the automated checks found no failure; it never means safe.
 * "reviewed" requires a recorded human review of this exact identifier.
 */
export function deriveBadge(input: BadgeInput): Badge {
    if (input.reviewCount > 0) {
        return 'reviewed';
    }

    if (input.hasReport && input.reportHasNoFailures) {
        return 'auto-checked';
    }

    return 'unchecked';
}
