// ── Position key helpers ──────────────────────────────────────────────────────
// JS objects / Maps need string keys; we encode [c, r] as "c,r" everywhere.

/** Encode a [col, row] pair to a string key. */
export function posKey(c, r) { return `${c},${r}`; }

/** Decode a string key back to a [col, row] array. */
export function keyToPos(key) { return key.split(',').map(Number); }

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────
// Python's random.seed() gives reproducible mazes; we replicate that here.

/**
 * Returns a seeded random-number function (range [0, 1)).
 * Usage:  const rng = seededRng(42);  rng();  // 0.something
 */
export function seededRng(seed) {
    let s = seed >>> 0;
    return function () {
        s = (Math.imul(s ^ (s >>> 15), s | 1) & 0xffffffff) >>> 0;
        s = (s ^ (s + Math.imul(s ^ (s >>> 7), s | 61))) >>> 0;
        return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
    };
}

/** Pick a random element from arr using the provided rng function. */
export function choice(arr, rng) {
    return arr[Math.floor(rng() * arr.length)];
}

// ── MinHeap ───────────────────────────────────────────────────────────────────
// JS has no built-in priority queue.  This binary min-heap mimics Python's
// heapq, which compares tuples lexicographically element-by-element.

export class MinHeap {
    constructor() { this._h = []; }

    get size() { return this._h.length; }

    push(item) {
        this._h.push(item);
        this._up(this._h.length - 1);
    }

    pop() {
        if (this._h.length === 0) return undefined;
        const top  = this._h[0];
        const last = this._h.pop();
        if (this._h.length > 0) { this._h[0] = last; this._down(0); }
        return top;
    }

    // Lexicographic comparison — matches Python tuple ordering
    _cmp(a, b) {
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            if (a[i] < b[i]) return -1;
            if (a[i] > b[i]) return  1;
        }
        return a.length - b.length;
    }

    _up(i) {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this._cmp(this._h[i], this._h[p]) < 0) {
                [this._h[i], this._h[p]] = [this._h[p], this._h[i]];
                i = p;
            } else break;
        }
    }

    _down(i) {
        const n = this._h.length;
        while (true) {
            let s = i;
            const l = 2 * i + 1, r = 2 * i + 2;
            if (l < n && this._cmp(this._h[l], this._h[s]) < 0) s = l;
            if (r < n && this._cmp(this._h[r], this._h[s]) < 0) s = r;
            if (s === i) break;
            [this._h[i], this._h[s]] = [this._h[s], this._h[i]];
            i = s;
        }
    }
}
