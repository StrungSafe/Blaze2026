import { randomBytes } from 'node:crypto';
import { decodeCashAddress, decodeHdPublicKey } from '@bitauth/libauth';
import { publicKeyMatchesIdentity, verifyChallengeTransaction } from './auth/challenge-transaction.js';
import { recoverSigner } from './auth/signed-message.js';
import type { Db } from './db.js';

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const SESSION_TTL_MS = 60 * 60 * 1000;

/** The text a moderator signs when logging in with a wallet that can sign messages. */
export function loginMessage(nonce: string, expiresAt: Date): string {
    return `XOGrid admin login\nnonce: ${nonce}\nexpires: ${expiresAt.toISOString()}`;
}

export interface AdminSession {
    token: string;
    label: string;
    /** Compressed public key that signed the login, as hex. */
    publicKey: string;
    expiresAt: number;
}

export type LoginProof =
    | { type: 'transaction'; signedTransaction: string }
    | { type: 'message'; signature: string };

interface Challenge {
    expiresAt: number;
    message: string;
}

/**
 * In-memory login challenges and sessions. A restart logs everyone out, which is acceptable for a moderation tool
 * used by two or three people. The clock is injectable so tests can move time.
 */
export class AdminAuth {
    private readonly challenges = new Map<string, Challenge>();
    private readonly sessions = new Map<string, AdminSession>();

    constructor(
        private readonly db: Db,
        private readonly now: () => number = Date.now,
    ) {}

    issueChallenge(): { nonce: string; expiresAt: string; message: string } {
        this.sweep();

        const nonce = randomBytes(16).toString('hex');
        const expiresAt = this.now() + CHALLENGE_TTL_MS;
        const message = loginMessage(nonce, new Date(expiresAt));

        this.challenges.set(nonce, { expiresAt, message });

        return { nonce, expiresAt: new Date(expiresAt).toISOString(), message };
    }

    /**
     * Checks a proof against an issued challenge and the allowlist. A challenge is spent the moment it is looked up,
     * whether or not the proof is good, so a nonce can never be tried twice.
     * Returns the session, or a reason for the server log (never shown to the caller).
     */
    async login(nonce: string, proof: LoginProof): Promise<{ session: AdminSession } | { failure: string }> {
        this.sweep();

        const challenge = this.challenges.get(nonce);

        this.challenges.delete(nonce);

        if (!challenge || challenge.expiresAt <= this.now()) {
            return { failure: 'unknown or expired challenge' };
        }

        let publicKey: string | undefined;

        if (proof.type === 'transaction') {
            const result = verifyChallengeTransaction(nonce, proof.signedTransaction);

            if (!result.valid) {
                return { failure: `transaction proof rejected: ${result.reason}` };
            }

            publicKey = result.publicKey;
        } else {
            const result = recoverSigner(challenge.message, proof.signature);

            if (!result.valid) {
                return { failure: `message proof rejected: ${result.reason}` };
            }

            publicKey = result.recoveredPublicKey;
        }

        if (!publicKey) {
            return { failure: 'no public key recovered' };
        }

        const admins = await this.db.selectFrom('admins').selectAll().execute();
        const admin = admins.find((candidate) => publicKeyMatchesIdentity(publicKey!, candidate.address_or_pubkey));

        if (!admin) {
            return { failure: `key ${publicKey.slice(0, 12)}... is not on the admin allowlist` };
        }

        const session: AdminSession = {
            token: randomBytes(32).toString('hex'),
            label: admin.label,
            publicKey,
            expiresAt: this.now() + SESSION_TTL_MS,
        };

        this.sessions.set(session.token, session);

        return { session };
    }

    /** Returns the session for a token, or undefined if it is unknown or expired. */
    getSession(token: string | undefined): AdminSession | undefined {
        if (!token) {
            return undefined;
        }

        const session = this.sessions.get(token);

        if (!session || session.expiresAt <= this.now()) {
            this.sessions.delete(token);

            return undefined;
        }

        return session;
    }

    logout(token: string): void {
        this.sessions.delete(token);
    }

    private sweep(): void {
        const now = this.now();

        for (const [nonce, challenge] of this.challenges) {
            if (challenge.expiresAt <= now) {
                this.challenges.delete(nonce);
            }
        }

        for (const [token, session] of this.sessions) {
            if (session.expiresAt <= now) {
                this.sessions.delete(token);
            }
        }
    }
}

/** True when the text looks like a usable allowlist identity: public key, P2PKH CashAddress, or xpub/tpub. */
export function isValidAdminIdentity(identity: string): boolean {
    const entry = identity.trim();

    if (/^(02|03)[0-9a-fA-F]{64}$/.test(entry)) {
        return true;
    }

    if (/^[xt]pub/.test(entry)) {
        return typeof decodeHdPublicKey(entry) !== 'string';
    }

    return [entry, `bitcoincash:${entry}`, `bchtest:${entry}`].some((candidate) => typeof decodeCashAddress(candidate) !== 'string');
}

/**
 * Parses ADMIN_IDENTITIES, a comma-separated list of "label=identity" pairs, and upserts the valid ones into the
 * allowlist. Returns what was added and what was skipped so startup can log it.
 */
export async function seedAdmins(db: Db, spec: string | undefined): Promise<{ added: string[]; skipped: string[] }> {
    const added: string[] = [];
    const skipped: string[] = [];

    for (const part of (spec ?? '').split(',').map((item) => item.trim()).filter(Boolean)) {
        const separator = part.indexOf('=');
        const label = separator > 0 ? part.slice(0, separator).trim() : '';
        const identity = separator > 0 ? part.slice(separator + 1).trim() : '';

        if (!label || label.length > 64 || !isValidAdminIdentity(identity)) {
            skipped.push(label || part.slice(0, 20));
            continue;
        }

        await db.deleteFrom('admins').where('address_or_pubkey', '=', identity).execute();
        await db.insertInto('admins').values({ address_or_pubkey: identity, label, added_at: new Date().toISOString() }).execute();
        added.push(label);
    }

    return { added, skipped };
}
