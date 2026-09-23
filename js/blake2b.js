/**
 * BLAKE2b hard-fork monitor.
 * Network data: mempool.guide (this chain). SHA256d comparison: mempool.space.
 */
(function () {
    const GUIDE = 'https://mempool.guide';
    const SPACE = 'https://mempool.space';
    const FORK_HEIGHT = 961640;
    const FORK_TIME = 1788070477;
    const RDTS_END_MS = Date.UTC(2027, 8, 1, 0, 0, 0);
    const BLAKE2B_J_PER_TH = 256;
    const SC5_PRO_TH = 11;
    const TARGET_INTERVAL_S = 600;
    const HARD_DIFFICULTY_THRESHOLD = 130;
    const REFRESH_MS = 30000;

    const imageMap = {
        'Fall.png': 'images/Fall.png',
        'Fall-0.5.png': 'images/Fall.png',
        'WinterStorm.png': 'images/WinterStorm.png',
        'NeutralMarket.jpg': 'images/NeutralMarket.jpg',
        'DoomsDay.png': 'images/DoomsDay.png',
        'DrySummer.png': 'images/DrySummer.png',
        'SpringBloom.png': 'images/SpringBloom.png',
        'SpringBloom-0.5.png': 'images/SpringBloom-0.5.png',
        'SpringBloom-0.6.png': 'images/SpringBloom-0.6.png',
        'SpringBloom-0.7.png': 'images/SpringBloom-0.7.png',
        'SpringBloom-0.8.png': 'images/SpringBloom-0.8.png',
        'SpringBloom-0.9.png': 'images/SpringBloom-0.9.png',
        'SpringBloom-1.0.png': 'images/SpringBloom-1.0.png'
    };

    const el = (id) => document.getElementById(id);

    const formatNumber = (num, digits = 2) => {
        if (num === null || num === undefined || Number.isNaN(num)) return 'N/A';
        const abs = Math.abs(num);
        // Short scale past trillion so a large difficulty does not spill the stat cell.
        if (abs >= 1e21) return (num / 1e21).toFixed(digits) + 'Sx';
        if (abs >= 1e18) return (num / 1e18).toFixed(digits) + 'Qi';
        if (abs >= 1e15) return (num / 1e15).toFixed(digits) + 'Q';
        if (abs >= 1e12) return (num / 1e12).toFixed(digits) + 'T';
        if (abs >= 1e9) return (num / 1e9).toFixed(digits) + 'B';
        if (abs >= 1e6) return (num / 1e6).toFixed(digits) + 'M';
        if (abs >= 1e3) return (num / 1e3).toFixed(digits) + 'K';
        return Number(num).toFixed(digits);
    };

    const formatInt = (num) => {
        if (num === null || num === undefined || Number.isNaN(num)) return 'N/A';
        return Math.round(num).toLocaleString('en-US');
    };

    const formatHashrate = (hashesPerSecond) => {
        if (!hashesPerSecond) return 'N/A';
        const units = [
            { v: 1e24, s: 'YH/s' },
            { v: 1e21, s: 'ZH/s' },
            { v: 1e18, s: 'EH/s' },
            { v: 1e15, s: 'PH/s' },
            { v: 1e12, s: 'TH/s' },
            { v: 1e9, s: 'GH/s' }
        ];
        const unit = units.find((u) => hashesPerSecond >= u.v) || units[units.length - 1];
        return `${(hashesPerSecond / unit.v).toFixed(2)} ${unit.s}`;
    };

    const formatDuration = (seconds) => {
        if (!Number.isFinite(seconds)) return 'N/A';
        const sign = seconds < 0 ? '-' : '';
        let s = Math.abs(Math.round(seconds));
        const d = Math.floor(s / 86400);
        s %= 86400;
        const h = Math.floor(s / 3600);
        s %= 3600;
        const m = Math.floor(s / 60);
        if (d > 0) return `${sign}${d}d ${h}h`;
        if (h > 0) return `${sign}${h}h ${m}m`;
        if (m > 0) return `${sign}${m}m`;
        return `${sign}${s}s`;
    };

    const formatInterval = (seconds) => {
        if (!Number.isFinite(seconds) || seconds <= 0) return 'N/A';
        if (seconds < 90) return `${Math.round(seconds)}s`;
        if (seconds < 3600) {
            const m = Math.floor(seconds / 60);
            const s = Math.round(seconds % 60);
            return s ? `${m}m ${s}s` : `${m}m`;
        }
        return formatDuration(seconds);
    };

    // mempool.guide's `difficulty` field is block work, 2^256 / (target+1),
    // which is about difficulty * 2^32. At 35 PH/s that figure implies millions
    // of years per block. Decode compact nBits with Bitcoin's diff1 target.
    const difficultyFromBits = (bits) => {
        if (!Number.isFinite(bits)) return NaN;
        const compact = bits >>> 0;
        const exponent = compact >>> 24;
        const mantissa = compact & 0xffffff;
        if (!mantissa || (mantissa & 0x800000)) return NaN;
        const power = 208 - 8 * (exponent - 3);
        return (0xffff / mantissa) * (2 ** power);
    };

    const formatBytes = (n) => {
        if (!Number.isFinite(n)) return 'N/A';
        if (n >= 1e6) return `${(n / 1e6).toFixed(2)} MB`;
        if (n >= 1e3) return `${(n / 1e3).toFixed(1)} kB`;
        return `${n} B`;
    };

    const jsonOrThrow = async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${url} → ${res.status}`);
        return res.json();
    };

    const summarizeMempoolBlocks = (projected) => {
        if (!Array.isArray(projected) || !projected.length) {
            return { count: 0, vsize: 0 };
        }
        return projected.reduce((acc, block) => {
            acc.count += block.nTx || 0;
            acc.vsize += block.blockVSize || 0;
            return acc;
        }, { count: 0, vsize: 0 });
    };

    const settledValue = (result, fallback = null) =>
        result.status === 'fulfilled' ? result.value : fallback;

    const getMaxDailyUsageKWh = () => {
        const startYear = 2024;
        const initialRenewableEJ = 33;
        const initialRenewableTWh = initialRenewableEJ * 277.778;
        const growthRate = 0.08;
        const yearsPassed = new Date().getFullYear() - startYear;
        const annualRenewableTWh = initialRenewableTWh * Math.pow(1 + growthRate, yearsPassed);
        return (annualRenewableTWh / 365.25) * 0.02 * 1e9;
    };

    const pickSentiment = ({ dailyBlocks, intervalS, tipAgeS, dailyEnergyKwh, heightDelta }) => {
        const highEnergy = getMaxDailyUsageKWh();

        if (tipAgeS > 30 * 60 && intervalS > 0 && tipAgeS > intervalS * 4) {
            return {
                text: 'Stalled',
                color: 'text-gray-400',
                image: 'DoomsDay.png',
                tooltip: 'No recent BLAKE2b block. Tip age is several times the current interval — the chain may be stalled or the explorer is behind.'
            };
        }
        if (dailyBlocks < HARD_DIFFICULTY_THRESHOLD) {
            return {
                text: 'Need Energy',
                color: 'text-gray-400',
                image: 'WinterStorm.png',
                tooltip: 'Network strain: fewer than 130 blocks/day (9.8% below the 144/day target) means hashrate is not holding the 10-minute clock.'
            };
        }
        if (dailyEnergyKwh > highEnergy) {
            return {
                text: 'Working too hard',
                color: 'text-orange-400',
                image: 'DrySummer.png',
                tooltip: 'Estimated BLAKE2b energy is above the 2% renewables ceiling used on the SHA256d page.'
            };
        }
        if (intervalS > 0 && intervalS < TARGET_INTERVAL_S * 0.5) {
            return {
                text: 'Racing',
                color: 'text-green-400',
                image: 'SpringBloom-1.0.png',
                tooltip: `Blocks are landing about every ${formatInterval(intervalS)}, well under the 10-minute target. Difficulty should rise at the next retarget. Height lead vs SHA256d: ${heightDelta > 0 ? '+' : ''}${formatInt(heightDelta)}.`
            };
        }
        if (intervalS > TARGET_INTERVAL_S * 1.25) {
            return {
                text: 'Slowing',
                color: 'text-orange-400',
                image: 'Fall-0.5.png',
                tooltip: `Average interval ${formatInterval(intervalS)} is slower than the 10-minute target. Watch the next difficulty retarget and pool hashrate.`
            };
        }
        if (heightDelta > 0) {
            return {
                text: 'Healthy Pace',
                color: 'text-green-400',
                image: 'SpringBloom-0.6.png',
                tooltip: `Near the 10-minute clock and ${formatInt(heightDelta)} blocks ahead of SHA256d Bitcoin.`
            };
        }
        return {
            text: 'Healthy Pace',
            color: 'text-yellow-300',
            image: 'NeutralMarket.jpg',
            tooltip: 'BLAKE2b is producing blocks near the 10-minute target.'
        };
    };

    const setSentiment = (sentiment) => {
        const imageContainer = el('image-container');
        const sentimentText = el('sentiment-text');
        const img = document.createElement('img');
        img.src = imageMap[sentiment.image] || imageMap['NeutralMarket.jpg'];
        img.alt = `Satoshi Nakamoto statue representing ${sentiment.text}`;
        img.className = 'w-full h-auto transition-transform duration-700 ease-in-out transform hover:scale-105';
        imageContainer.innerHTML = '';
        imageContainer.appendChild(img);

        sentimentText.textContent = sentiment.text;
        sentimentText.className = `text-base sm:text-lg font-bold mb-1 flex items-center justify-center relative ${sentiment.color}`;
        if (sentiment.tooltip) {
            sentimentText.setAttribute('data-tooltip', sentiment.tooltip);
        } else {
            sentimentText.removeAttribute('data-tooltip');
        }
    };

    const renderPools = (poolsPayload) => {
        const root = el('pools-list');
        const pools = (poolsPayload && poolsPayload.pools) || [];
        const total = poolsPayload && poolsPayload.blockCount
            ? poolsPayload.blockCount
            : pools.reduce((sum, p) => sum + (p.blockCount || 0), 0);

        if (!pools.length || !total) {
            root.textContent = 'No pool data.';
            return;
        }

        const top = pools.slice(0, 8);
        root.innerHTML = top.map((pool) => {
            const share = (pool.blockCount || 0) / total;
            const name = pool.name || 'Unknown';
            const href = `${GUIDE}/mining/pool/${pool.slug || 'unknown'}`;
            return `<div class="pool-row">
                <div>
                    <a href="${href}" target="_blank" rel="noopener">${name}</a>
                    <div class="pool-bar" aria-hidden="true"><span style="width:${(share * 100).toFixed(1)}%"></span></div>
                </div>
                <span class="text-gray-400">${(share * 100).toFixed(1)}% · ${formatInt(pool.blockCount)}</span>
            </div>`;
        }).join('');
    };

    const renderBlocks = (blocks) => {
        const root = el('blocks-list');
        if (!blocks || !blocks.length) {
            root.textContent = 'No recent blocks.';
            return;
        }
        const now = Date.now() / 1000;
        root.innerHTML = blocks.slice(0, 8).map((block) => {
            const pool = (block.extras && block.extras.pool && block.extras.pool.name) || 'Unknown';
            const href = `${GUIDE}/block/${block.id}`;
            return `<div class="block-row">
                <a href="${href}" target="_blank" rel="noopener">${formatInt(block.height)}</a>
                <span class="block-meta text-gray-400">${formatDuration(now - block.timestamp)} · ${pool}</span>
                <span>${formatInt(block.tx_count)} tx</span>
                <span class="block-weight text-gray-400">${formatInt(block.weight)} WU</span>
            </div>`;
        }).join('');
    };

    const showError = (message) => {
        el('image-container').innerHTML = `<div class="text-center p-4">${message}</div>`;
        el('sentiment-text').textContent = 'Error';
        el('sentiment-text').className = 'text-base sm:text-lg font-bold mb-1 flex items-center justify-center text-red-400';
        el('live-indicator').classList.add('stale');
        el('updated-at').textContent = 'failed';
    };

    const updateUI = (data) => {
        const {
            height,
            shaHeight,
            hashrate,
            difficulty,
            adjustment,
            mempool,
            fees,
            pools,
            blocks
        } = data;

        const tipBlock = blocks && blocks[0];
        const nowS = Date.now() / 1000;
        const tipAgeS = tipBlock ? nowS - tipBlock.timestamp : NaN;
        const intervalS = adjustment && adjustment.timeAvg ? adjustment.timeAvg / 1000 : NaN;
        const dailyBlocks = Number.isFinite(intervalS) && intervalS > 0
            ? Math.round(86400 / intervalS)
            : 144;
        const dailyEnergyKwh = (hashrate * BLAKE2B_J_PER_TH) / 1e15 * 24;
        const heightDelta = (height != null && shaHeight != null) ? height - shaHeight : null;
        const blocksSinceFork = height != null ? height - FORK_HEIGHT + 1 : null;
        const minerEquiv = hashrate ? (hashrate / 1e12) / SC5_PRO_TH : null;

        const sentiment = pickSentiment({
            dailyBlocks,
            intervalS,
            tipAgeS,
            dailyEnergyKwh,
            heightDelta: heightDelta || 0
        });
        setSentiment(sentiment);

        el('tip-height').textContent = formatInt(height);
        if (tipBlock && tipBlock.id) {
            el('height-link').href = `${GUIDE}/block/${tipBlock.id}`;
        }

        const deltaEl = el('height-delta');
        if (heightDelta == null) {
            deltaEl.textContent = 'N/A';
            deltaEl.className = 'text-base sm:text-lg font-bold mt-0.5 text-gray-400';
        } else {
            const ahead = heightDelta > 0;
            deltaEl.textContent = `${ahead ? '+' : ''}${formatInt(heightDelta)} ${ahead ? 'ahead' : (heightDelta < 0 ? 'behind' : 'tied')}`;
            deltaEl.className = `text-base sm:text-lg font-bold mt-0.5 ${ahead ? 'text-green-400' : heightDelta < 0 ? 'text-red-400' : 'text-yellow-300'}`;
        }

        el('hashrate').textContent = formatHashrate(hashrate);
        const energyText = dailyEnergyKwh >= 1e6
            ? `${(dailyEnergyKwh / 1e6).toFixed(2)} GWh/day`
            : `${(dailyEnergyKwh / 1e3).toFixed(2)} MWh/day`;
        el('energy-usage').textContent = energyText;
        el('energy-usage').title = minerEquiv
            ? `≈ ${formatInt(minerEquiv)} Goldshell SC5 Pro at ${BLAKE2B_J_PER_TH} J/TH`
            : '';

        const difficultyEl = el('difficulty-target');
        difficultyEl.textContent = formatNumber(difficulty);
        difficultyEl.title = Number.isFinite(difficulty)
            ? `Difficulty ${Math.round(difficulty).toLocaleString('en-US')}`
            : '';
        const intervalEl = el('block-interval');
        intervalEl.textContent = Number.isFinite(intervalS)
            ? `${formatInterval(intervalS)} · ${formatInt(dailyBlocks)}/day`
            : 'N/A';
        intervalEl.className = `text-sm sm:text-base font-bold mt-0.5 ${intervalS && intervalS < TARGET_INTERVAL_S ? 'text-green-400' : 'text-orange-400'}`;

        el('blocks-since-fork').textContent = blocksSinceFork != null
            ? `${formatInt(blocksSinceFork)} blocks`
            : 'N/A';
        el('fork-age').textContent = `${formatDuration(nowS - FORK_TIME)} since 30 Aug 2026`;

        const rdtsLeft = (RDTS_END_MS / 1000) - nowS;
        el('rdts-status').textContent = rdtsLeft > 0 ? '800k WU cap on' : 'RDTS expired';
        el('rdts-eta').textContent = rdtsLeft > 0
            ? `${formatDuration(rdtsLeft)} left · 1 Sep 2027`
            : 'data limits no longer forced';

        if (adjustment) {
            const pct = Math.max(0, Math.min(100, adjustment.progressPercent || 0));
            const change = adjustment.difficultyChange;
            const changeLabel = Number.isFinite(change)
                ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
                : 'n/a';
            el('retarget-bar').style.width = `${pct.toFixed(1)}%`;
            el('retarget-label').textContent = `${pct.toFixed(1)}% · ${changeLabel}`;
            const when = adjustment.estimatedRetargetDate
                ? new Date(adjustment.estimatedRetargetDate).toLocaleString()
                : 'unknown';
            el('retarget-detail').textContent =
                `${formatInt(adjustment.remainingBlocks)} blocks left · height ${formatInt(adjustment.nextRetargetHeight)} · ${when}`;
        }

        el('compare-blake-height').textContent = formatInt(height);
        el('compare-sha-height').textContent = formatInt(shaHeight);
        const maxH = Math.max(height || 0, shaHeight || 0, 1);
        const minH = Math.min(height || 0, shaHeight || 0);
        const span = Math.max(maxH - minH, 1);
        const blakeBar = 24 + ((height - minH) / span) * 48;
        const shaBar = 24 + ((shaHeight - minH) / span) * 48;
        el('compare-blake-bar').style.height = `${blakeBar}px`;
        el('compare-sha-bar').style.height = `${shaBar}px`;
        el('split-note').textContent = heightDelta == null
            ? 'Could not reach mempool.space for the SHA256d tip.'
            : `Split at ${formatInt(FORK_HEIGHT)}. BLAKE2b is ${heightDelta >= 0 ? formatInt(heightDelta) + ' blocks ahead of' : formatInt(-heightDelta) + ' blocks behind'} SHA256d.`;

        el('mempool-count').textContent = mempool ? formatInt(mempool.count) : 'N/A';
        el('mempool-vsize').textContent = mempool ? formatBytes(mempool.vsize) : 'N/A';
        el('mempool-fee').textContent = fees && fees.fastestFee != null
            ? `${fees.fastestFee} sat/vB`
            : 'N/A';

        renderPools(pools);
        renderBlocks(blocks);

        el('live-indicator').classList.toggle('stale', !Number.isFinite(tipAgeS) || tipAgeS > 30 * 60);
        el('updated-at').textContent = new Date().toLocaleTimeString();
    };

    const fetchData = async () => {
        try {
            const results = await Promise.allSettled([
                jsonOrThrow(`${GUIDE}/api/v1/blocks/tip/height`),
                jsonOrThrow(`${GUIDE}/api/v1/mining/hashrate/3d`),
                jsonOrThrow(`${GUIDE}/api/v1/difficulty-adjustment`),
                jsonOrThrow(`${GUIDE}/api/v1/fees/mempool-blocks`),
                jsonOrThrow(`${GUIDE}/api/v1/fees/recommended`),
                jsonOrThrow(`${GUIDE}/api/v1/mining/pools/1w`),
                jsonOrThrow(`${GUIDE}/api/v1/blocks`),
                jsonOrThrow(`${SPACE}/api/v1/blocks/tip/height`)
            ]);

            const height = settledValue(results[0]);
            const hashrateData = settledValue(results[1]);
            const adjustment = settledValue(results[2]);
            const mempoolBlocks = settledValue(results[3]);
            const mempool = Array.isArray(mempoolBlocks)
                ? summarizeMempoolBlocks(mempoolBlocks)
                : null;
            const fees = settledValue(results[4]);
            const pools = settledValue(results[5]);
            const blocks = settledValue(results[6]);
            const shaHeight = settledValue(results[7]);

            if (height == null) {
                showError('Failed to reach mempool.guide. Check your network connection.');
                return;
            }

            updateUI({
                height,
                shaHeight,
                hashrate: hashrateData && hashrateData.currentHashrate,
                difficulty: blocks && blocks[0] ? difficultyFromBits(blocks[0].bits) : NaN,
                adjustment,
                mempool,
                fees,
                pools,
                blocks
            });
        } catch (error) {
            console.error('Error fetching BLAKE2b fork data:', error);
            showError('Failed to fetch fork data. Check your network connection.');
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        fetchData();
        setInterval(fetchData, REFRESH_MS);
    });
})();
