import { test, expect, Page } from '../fixtures';

/**
 * Port of end-to-end-test/local/specs/core/embeddings.spec.js.
 *
 * Functional (non-screenshot) coverage of the Similarity Maps tab: legend
 * toggling, sample counts, toolbar controls, selection/filtering, and URL
 * parameter handling. Lives in the remote lane for the same reason as
 * embeddings-screenshot.spec.ts: the embedding data and the
 * `msk_impact_50k_2026` cohort only exist against the public backend.
 *
 * The original wdio `coloring menu interactions` test targeted a
 * `[data-test="embeddings-coloring-menu"]` selector that does not exist in
 * the component and was guarded by `isExisting()`, so it never asserted
 * anything — it is intentionally not ported.
 */

const STUDY = 'msk_impact_50k_2026';
const LEGEND = '[data-test="embeddings-legend"]';
const VIZ = '[data-test="embeddings-visualization"]';
const LEGEND_ITEM = `${LEGEND} div[style*="cursor: pointer"]`;
const STATUS_BAR = '[data-test="embeddings-status-bar"]';
const PAN_BUTTON = '[data-test="embeddings-pan-button"]';
const SELECT_BUTTON = '[data-test="embeddings-select-button"]';
const CLEAR_BUTTON = '[data-test="embeddings-clear-button"]';
const MAKE_GLOBAL_BUTTON = '[data-test="embeddings-make-global-button"]';
const panelCountButton = (n: number) =>
    `[data-test="embeddings-panel-count-${n}"]`;

function coloringParam(selection: Record<string, string>): string {
    return encodeURIComponent(JSON.stringify(selection));
}

// Study-view filters are applied via the `#filterJson=` URL hash using the
// clinicalDataFilters schema (each value is an object); see
// tests/studyview.spec.ts for the canonical encoding.
function filterHash(values: string[]): string {
    return `#filterJson=${encodeURIComponent(
        JSON.stringify({
            clinicalDataFilters: [
                {
                    attributeId: 'CANCER_TYPE',
                    values: values.map(value => ({ value })),
                },
            ],
        })
    )}`;
}

async function gotoEmbeddings(page: Page, query = '') {
    await page.goto(
        `/study/embeddings?id=${STUDY}&featureFlags=EMBEDDINGS${query}`
    );
    await expect(page.locator(LEGEND)).toBeVisible({ timeout: 60000 });
}

test.describe('embeddings tab interactions', () => {
    test.describe('legend interactions', () => {
        test('toggles category visibility when clicking a legend item', async ({
            page,
        }) => {
            await gotoEmbeddings(page);
            const firstItem = page.locator(LEGEND_ITEM).first();
            await expect(firstItem).toBeVisible();

            await firstItem.click({ timeout: 30000 });
            await expect(firstItem).toHaveAttribute('style', /opacity:\s*0\.5/);

            await firstItem.click({ timeout: 30000 });
            await expect(firstItem).toHaveAttribute('style', /opacity:\s*1/);
        });

        test('shows/hides all categories with the Show All/Hide All button', async ({
            page,
        }) => {
            await gotoEmbeddings(page);
            // Not getByRole('button').first(): the legend's collapse/expand
            // chevron is also a button and sits before this one in the DOM,
            // and clicking it collapses the panel (removing this button
            // entirely) rather than toggling categories.
            const toggle = page.locator(
                '[data-test="embeddings-legend-toggle-all"]'
            );
            await expect(toggle).toBeVisible();

            await toggle.click();
            await expect(toggle).toContainText('Show All');

            await toggle.click();
            await expect(toggle).toContainText('Hide All');
        });

        test('displays the total embedded sample count in the status bar', async ({
            page,
        }) => {
            // Total/visible counts live in the shared status bar above the
            // panels (see EmbeddingsTab), not in the legend itself - the
            // legend only shows its own per-category counts.
            await gotoEmbeddings(page);
            await expect(page.locator(STATUS_BAR)).toContainText(
                /[\d,]+ samples embedded in/
            );
        });

        test('status bar switches to "Selection active" once a category is hidden, and Clear restores it', async ({
            page,
        }) => {
            await gotoEmbeddings(page);
            const firstItem = page.locator(LEGEND_ITEM).first();
            await expect(firstItem).toBeVisible();

            await firstItem.click({ timeout: 30000 });
            await expect(page.locator(STATUS_BAR)).toContainText(
                /Selection active.*[\d,]+\s*\/\s*[\d,]+.*visible/
            );
            await expect(page.locator(CLEAR_BUTTON)).toBeVisible();
            await expect(page.locator(MAKE_GLOBAL_BUTTON)).toBeVisible();

            await page.locator(CLEAR_BUTTON).click();
            await expect(page.locator(STATUS_BAR)).toContainText(
                /[\d,]+ samples embedded in/
            );
            await expect(page.locator(CLEAR_BUTTON)).not.toBeVisible();
        });

        test('legend row shows "visible / total" once its category is hidden', async ({
            page,
        }) => {
            await gotoEmbeddings(page);
            const firstItem = page.locator(LEGEND_ITEM).first();
            await expect(firstItem).toBeVisible();

            await firstItem.click({ timeout: 30000 });
            // The hidden category's own samples are filtered out of this
            // same panel too (the filter applies by sample identity across
            // every panel, including the one that set it), so its count
            // drops to "0 / N".
            await expect(firstItem).toContainText(/0\s*\/\s*[\d,]+/);
        });
    });

    test.describe('toolbar controls', () => {
        test('renders control buttons in the visualization toolbar', async ({
            page,
        }) => {
            await gotoEmbeddings(page);
            await expect(page.locator(`${VIZ} button`).first()).toBeVisible();
        });
    });

    test.describe('selection and filtering', () => {
        // Navigate straight to the embeddings route with the filter in the
        // URL: clicking the tab from a freshly-loaded summary view is not
        // actionable within the action timeout while the 50k-sample study
        // view renders.
        test('shows an Unselected category when a study-view filter is applied', async ({
            page,
        }) => {
            await page.goto(
                `/study/embeddings?id=${STUDY}&featureFlags=EMBEDDINGS${filterHash(
                    ['Colorectal Cancer']
                )}`
            );
            await expect(page.locator(LEGEND)).toBeVisible({ timeout: 60000 });
            await expect(page.locator(LEGEND)).toContainText('Unselected', {
                timeout: 60000,
            });
        });
    });

    test.describe('multi-panel split view', () => {
        test('Pan/Select and panel-count controls are visible', async ({
            page,
        }) => {
            await gotoEmbeddings(page);
            await expect(page.locator(PAN_BUTTON)).toBeVisible();
            await expect(page.locator(SELECT_BUTTON)).toBeVisible();
            await expect(page.locator(panelCountButton(1))).toBeVisible();
        });

        test('hides the per-embedding status sentence once a second panel is open', async ({
            page,
        }) => {
            // Single panel: the status bar reports this one panel's map and
            // its sample counts.
            await gotoEmbeddings(page);
            await expect(page.locator(STATUS_BAR)).toContainText(
                /[\d,]+ samples embedded in/
            );

            // A second panel can have a completely different map selected,
            // so there's no longer a single "the" map/sample-size the
            // status bar could report - it should show nothing here rather
            // than an arbitrary/stale one of the two panels' numbers.
            await page.locator(panelCountButton(2)).click();
            await expect(page.locator(VIZ)).toHaveCount(2, { timeout: 30000 });
            await expect(page.locator(STATUS_BAR)).not.toContainText(
                /embedded in/
            );

            // Switching back to a single panel restores it.
            await page.locator(panelCountButton(1)).click();
            await expect(page.locator(VIZ)).toHaveCount(1);
            await expect(page.locator(STATUS_BAR)).toContainText(
                /[\d,]+ samples embedded in/
            );
        });

        test('a cross-panel selection filter is reflected in every open panel', async ({
            page,
        }) => {
            // Load directly into 2-panel mode via the panel-2 URL params
            // (see EmbeddingsTab's constructor) rather than clicking the
            // panel-count control - avoids racing the first panel's own
            // render while the 50k-sample view is still settling.
            await page.goto(
                `/study/embeddings?id=${STUDY}&featureFlags=EMBEDDINGS&embeddings_panel2_map=msk_mosaic_2026_he`
            );
            await expect(page.locator(VIZ)).toHaveCount(2, { timeout: 60000 });
            await expect(page.locator(LEGEND).first()).toBeVisible({
                timeout: 60000,
            });

            // Hiding a category in panel 1's legend is a cross-panel,
            // sample-identity filter - it should show up as an active
            // selection in the shared status bar even though the filter
            // was set from a single panel.
            const firstPanelFirstItem = page.locator(LEGEND_ITEM).first();
            await expect(firstPanelFirstItem).toBeVisible();
            await firstPanelFirstItem.click({ timeout: 30000 });

            await expect(page.locator(STATUS_BAR)).toContainText(
                /Selection active/
            );
            await expect(page.locator(CLEAR_BUTTON)).toBeVisible();

            await page.locator(CLEAR_BUTTON).click();
            await expect(page.locator(STATUS_BAR)).not.toContainText(
                /Selection active/
            );
        });
    });

    test.describe('URL parameter handling', () => {
        test('initializes gene mutation coloring from the URL', async ({
            page,
        }) => {
            // Gene coloring is keyed by `<entrezGeneId>_<...>`; EGFR = 1956.
            const param = coloringParam({
                selectedOption: '1956_undefined',
                colorByMutationType: 'true',
                colorByCopyNumber: 'true',
                colorBySv: 'true',
            });
            await gotoEmbeddings(
                page,
                `&embeddings_coloring_selection=${param}`
            );
            // Mutation coloring replaces the default cancer-type legend
            // once the gene's mutation data loads; allow time for it.
            await expect(page.locator(LEGEND)).toContainText(
                /Missense|Truncating|Inframe|Not mutated/,
                {
                    timeout: 60000,
                }
            );
        });

        test('initializes clinical attribute coloring from the URL', async ({
            page,
        }) => {
            const param = coloringParam({
                selectedOption: `undefined_${JSON.stringify({
                    clinicalAttributeId: 'SEX',
                    patientAttribute: true,
                    studyId: STUDY,
                })}`,
                colorByMutationType: 'false',
                colorByCopyNumber: 'false',
                colorBySv: 'false',
            });
            await gotoEmbeddings(
                page,
                `&embeddings_coloring_selection=${param}`
            );
            await expect(page.locator(LEGEND)).toContainText(/Male|Female/, {
                timeout: 60000,
            });
        });
    });
});
