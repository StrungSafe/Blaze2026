import { binToHex, secp256k1 } from '@bitauth/libauth';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedAdmins } from '../src/admin.js';
import { buildApp } from '../src/app.js';
import { signChallengeTransaction } from '../src/auth/challenge-transaction.js';
import { signMessage } from '../src/auth/signed-message.js';
import type { Db } from '../src/db.js';
import { freshDb } from './helpers.js';
import { describeTemplate } from '../src/describe.js';
import { seed } from '../src/seed.js';
import { addressOfPublicKey, statsFromRatings, validateReview } from '../src/user-reviews.js';

const alice = new Uint8Array(32).fill(31);
const bob = new Uint8Array(32).fill(32);
const mod = new Uint8Array(32).fill(33);
const pub = (key: Uint8Array): string => binToHex(secp256k1.derivePublicKeyCompressed(key) as Uint8Array);

let db: Db;
let app: FastifyInstance;
let clock = 1_000_000;

beforeEach(async () => {
    clock = 1_000_000;
    db = await freshDb();
    await seed(db);
    await seedAdmins(db, `mod=${pub(mod)}`);
    app = await buildApp(db, { rateLimit: false, clock: () => clock });
});

afterEach(async () => {
    await app.close();
    await db.destroy();
});

const call = (method: 'GET' | 'POST', url: string, payload?: unknown, token?: string) =>
    app.inject({ method, url, payload: payload as object, headers: token ? { authorization: `Bearer ${token}` } : {} });

const firstId = async (): Promise<string> => (await call('GET', '/api/templates')).json().items[0].identifier;

async function review(identifier: string, key: Uint8Array, rating = 5, body = 'Works exactly as described.', kind: 'transaction' | 'message' = 'transaction') {
    const started = await call('POST', `/api/templates/${identifier}/reviews/challenge`, { rating, body });

    expect(started.statusCode).toBe(200);

    const { nonce, message } = started.json() as { nonce: string; message: string };
    const proof = kind === 'transaction' ? { type: 'transaction', signedTransaction: signChallengeTransaction(nonce, key) } : { type: 'message', signature: signMessage(message, key) };

    return call('POST', `/api/templates/${identifier}/reviews`, { nonce, proof });
}

describe('validateReview', () => {
    it('accepts a normal review and tidies the text', () => {
        expect(validateReview(4, '  Nice\u0000 one  ')).toEqual({ rating: 4, body: 'Nice one' });
    });

    it.each([0, 6, 3.5, '5', null])('rejects rating %s', (rating) => {
        expect(() => validateReview(rating, 'fine text')).toThrow();
    });

    it('rejects text that is too short or too long', () => {
        expect(() => validateReview(5, 'hi')).toThrow();
        expect(() => validateReview(5, 'x'.repeat(1001))).toThrow();
        expect(() => validateReview(5, 42)).toThrow();
    });
});

describe('statsFromRatings', () => {
    it('averages to one decimal and counts the distribution', () => {
        expect(statsFromRatings([5, 4, 4])).toEqual({ count: 3, average: 4.3, distribution: { '1': 0, '2': 0, '3': 0, '4': 2, '5': 1 } });
        expect(statsFromRatings([]).average).toBeNull();
    });
});

describe('wallet-signed reviews', () => {
    it('publishes a review proven by a transaction signature and shows the rating on the template', async () => {
        const id = await firstId();
        const res = await review(id, alice, 5, 'Works exactly as described.');

        expect(res.statusCode).toBe(201);
        expect(res.json().reviewerAddress).toMatch(/^bitcoincash:q/);

        const list = (await call('GET', `/api/templates/${id}/reviews`)).json();

        expect(list.total).toBe(1);
        expect(list.items[0]).toMatchObject({ rating: 5, body: 'Works exactly as described.' });
        expect(list.stats).toMatchObject({ count: 1, average: 5 });

        const detail = (await call('GET', `/api/templates/${id}`)).json();

        expect(detail.userReviewCount).toBe(1);
        expect(detail.averageRating).toBe(5);
    });

    it('accepts a message signature too', async () => {
        const id = await firstId();

        expect((await review(id, bob, 4, 'Solid template.', 'message')).statusCode).toBe(201);
    });

    it('allows one review per wallet per template', async () => {
        const id = await firstId();

        expect((await review(id, alice)).statusCode).toBe(201);
        expect((await review(id, alice, 1, 'Changed my mind.')).statusCode).toBe(409);
        expect((await review(id, bob)).statusCode).toBe(201);
    });

    it('rejects a proof for another challenge, a reused nonce, an expired nonce and a re-signed message', async () => {
        const id = await firstId();
        const first = (await call('POST', `/api/templates/${id}/reviews/challenge`, { rating: 5, body: 'First review.' })).json();
        const second = (await call('POST', `/api/templates/${id}/reviews/challenge`, { rating: 1, body: 'Second review.' })).json();

        // A signature made for the second challenge cannot publish the first review.
        const crossed = await call('POST', `/api/templates/${id}/reviews`, { nonce: first.nonce, proof: { type: 'transaction', signedTransaction: signChallengeTransaction(second.nonce, alice) } });

        expect(crossed.statusCode).toBe(401);

        // The nonce is spent even though that attempt failed.
        const retry = await call('POST', `/api/templates/${id}/reviews`, { nonce: first.nonce, proof: { type: 'transaction', signedTransaction: signChallengeTransaction(first.nonce, alice) } });

        expect(retry.statusCode).toBe(401);

        // A message signature over different text cannot be attributed to the signer: recovery yields an unrelated key.
        const tampered = await call('POST', `/api/templates/${id}/reviews`, { nonce: second.nonce, proof: { type: 'message', signature: signMessage(second.message.replace('rating: 1', 'rating: 5'), alice) } });
        const aliceAddress = addressOfPublicKey(pub(alice));

        expect(tampered.statusCode).toBe(201);
        expect(tampered.json().reviewerAddress).not.toBe(aliceAddress);

        // An expired challenge is refused.
        const late = (await call('POST', `/api/templates/${id}/reviews/challenge`, { rating: 3, body: 'Late review.' })).json();

        clock += 6 * 60 * 1000;

        const expired = await call('POST', `/api/templates/${id}/reviews`, { nonce: late.nonce, proof: { type: 'transaction', signedTransaction: signChallengeTransaction(late.nonce, alice) } });

        expect(expired.statusCode).toBe(401);
        expect((await call('GET', `/api/templates/${id}/reviews`)).json().total).toBe(1);
    });

    it('will not take a challenge from one template to another', async () => {
        const ids = ((await call('GET', '/api/templates')).json().items as { identifier: string }[]).map((item) => item.identifier);

        expect(ids.length).toBeGreaterThan(1);

        const started = (await call('POST', `/api/templates/${ids[0]}/reviews/challenge`, { rating: 5, body: 'For the first one.' })).json();
        const res = await call('POST', `/api/templates/${ids[1]}/reviews`, { nonce: started.nonce, proof: { type: 'transaction', signedTransaction: signChallengeTransaction(started.nonce, alice) } });

        expect(res.statusCode).toBe(401);
    });

    it('validates input and unknown templates before issuing a challenge', async () => {
        const id = await firstId();

        expect((await call('POST', `/api/templates/${id}/reviews/challenge`, { rating: 9, body: 'Too high a rating.' })).statusCode).toBe(400);
        expect((await call('POST', `/api/templates/${id}/reviews/challenge`, { rating: 5, body: '' })).statusCode).toBe(400);
        expect((await call('POST', `/api/templates/${'0'.repeat(64)}/reviews/challenge`, { rating: 5, body: 'Nothing here.' })).statusCode).toBe(404);
        expect((await call('POST', `/api/templates/${id}/reviews`, { nonce: 'x' })).statusCode).toBe(400);
    });

    it('returns a wallet sign request when a public key is supplied', async () => {
        const id = await firstId();
        const res = (await call('POST', `/api/templates/${id}/reviews/challenge`, { rating: 5, body: 'With a wallet.', publicKey: pub(alice) })).json();

        expect(res.walletSignRequest.broadcast).toBe(false);
        expect(res.walletSignRequest.userPrompt).toContain('5-star');
    });

    it('sorts by rating and lets a moderator hide and restore a review', async () => {
        const ids = ((await call('GET', '/api/templates')).json().items as { identifier: string }[]).map((item) => item.identifier);

        await review(ids[1], alice, 5, 'Best of the lot.');
        await review(ids[0], bob, 2, 'Not for me really.');

        const sorted = (await call('GET', '/api/templates?sort=rating')).json().items as { identifier: string; averageRating: number | null }[];

        expect(sorted[0].identifier).toBe(ids[1]);
        expect(sorted[1].identifier).toBe(ids[0]);

        const { nonce } = (await call('POST', '/api/admin/challenge')).json();
        const token = (await call('POST', '/api/admin/login', { nonce, proof: { type: 'transaction', signedTransaction: signChallengeTransaction(nonce, mod) } })).json().token as string;
        const listed = (await call('GET', '/api/admin/user-reviews', undefined, token)).json().items as { id: number; identifier: string }[];

        expect(listed).toHaveLength(2);
        expect((await call('POST', `/api/admin/user-reviews/${listed[0].id}/hide`, { reason: 'x' }, token)).statusCode).toBe(400);
        expect((await call('POST', `/api/admin/user-reviews/${listed[0].id}/hide`, { reason: 'Abusive text' }, token)).statusCode).toBe(200);
        expect((await call('POST', `/api/admin/user-reviews/${listed[0].id}/hide`, { reason: 'Abusive text' })).statusCode).toBe(401);

        const hidden = (await call('GET', `/api/templates/${listed[0].identifier}/reviews`)).json();

        expect(hidden.total).toBe(0);
        expect((await call('GET', `/api/templates/${listed[0].identifier}`)).json().userReviewCount).toBe(0);
        expect((await call('POST', `/api/admin/user-reviews/${listed[0].id}/unhide`, {}, token)).statusCode).toBe(200);
        expect((await call('GET', `/api/templates/${listed[0].identifier}/reviews`)).json().total).toBe(1);
        expect((await call('POST', '/api/admin/user-reviews/9999/hide', { reason: 'Nothing there' }, token)).statusCode).toBe(404);
    });
});

describe('plain English', () => {
    it('describes every seeded template and exposes it on the detail', async () => {
        const items = (await call('GET', '/api/templates?pageSize=50')).json().items as { identifier: string }[];

        for (const item of items) {
            const detail = (await call('GET', `/api/templates/${item.identifier}`)).json();

            expect(detail.plainEnglish.summary.length).toBeGreaterThan(10);
            expect(detail.plainEnglish.steps.length).toBeGreaterThan(0);
        }
    });

    it('orders steps from the start action and lists what each party must provide', () => {
        const text = describeTemplate({
            name: 'Demo',
            roles: { a: { name: 'Payer', description: 'Sends money' }, b: { name: 'Payee' } },
            start: [{ action: 'two', role: 'a' }],
            actions: {
                one: { name: 'One', roles: { b: { requirements: { variables: ['v'] } } } },
                two: { name: 'Two', description: 'Do it', roles: { a: {} } },
            },
            variables: { v: { name: 'Amount', description: 'How much' } },
        });

        expect(text?.steps[0]).toBe('1. Two (Payer): Do it.');
        expect(text?.steps[1]).toBe('2. One (Payee)');
        expect(text?.youWillNeed).toEqual(['amount - How much.']);
        expect(text?.whoDoesWhat[0]).toContain('Payer: Sends money.');
        expect(describeTemplate(null)).toBeNull();
    });
});
