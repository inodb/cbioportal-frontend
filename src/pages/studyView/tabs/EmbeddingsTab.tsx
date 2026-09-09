import * as React from 'react';
import Select from 'react-select';
import { observer } from 'mobx-react';
import { observable, action, computed, makeObservable } from 'mobx';
import { DefaultTooltip } from 'cbioportal-frontend-commons';
import { StudyViewPageStore } from 'pages/studyView/StudyViewPageStore';
import { ViewState } from 'shared/components/embeddings/EmbeddingTypes';
import { EmbeddingsPanel } from './EmbeddingsPanel';

// Matches EmbeddingControlStack's own SELECT_STYLES - kept as a separate
// copy rather than a shared import since this one only needs to style a
// single, simple Map dropdown moved here for the single-panel case.
const MAP_SELECT_STYLES = {
    control: (base: any) => ({
        ...base,
        fontSize: '11px',
        minHeight: '28px',
        height: '28px',
        boxShadow: 'none',
        border: '1px solid #ccc',
    }),
    valueContainer: (base: any) => ({
        ...base,
        height: '28px',
        padding: '0 6px',
    }),
    indicatorsContainer: (base: any) => ({ ...base, height: '28px' }),
    menu: (base: any) => ({ ...base, fontSize: '11px', zIndex: 9999 }),
    container: (base: any) => ({ ...base, width: '160px' }),
};

export interface IEmbeddingsTabProps {
    store: StudyViewPageStore;
}

type PanelIndex = 1 | 2 | 3 | 4;

const MAX_PANELS = 4;

function coloringParamName(panelIndex: number): string {
    return panelIndex === 1
        ? 'embeddings_coloring_selection'
        : `embeddings_panel${panelIndex}_coloring_selection`;
}

function mapParamName(panelIndex: number): string {
    return panelIndex === 1
        ? 'embeddings_map'
        : `embeddings_panel${panelIndex}_map`;
}

// Tooltip fields are shared across every panel (one set of fields shown
// everywhere), so there's a single URL param rather than a per-panel slot.
const TOOLTIP_FIELDS_PARAM = 'embeddings_tooltip_fields';

// Splits the embeddings tab into 1-4 independent, side-by-side panels, each
// its own EmbeddingsPanel with its own map/color-by/tooltip-fields state,
// synced to its own fixed-slot URL params (see coloringParamName et al.).
@observer
export class EmbeddingsTab extends React.Component<IEmbeddingsTabProps, {}> {
    @observable private panelCount: number = 1;
    // Shared across every panel so Pan/Select applies to all of them at
    // once, rather than each split-view panel tracking its own mode.
    @observable private sharedSelectionMode: 'none' | 'lasso' = 'none';
    // Shared across every panel so the same tooltip fields show everywhere.
    @observable.ref private sharedTooltipFields = new Set<string>();
    // Shared across every panel so hiding a QC category (e.g. "Sample not
    // in this cohort") from the primary panel's legend Configuration
    // section applies everywhere.
    @observable private sharedHiddenQcCategories = new Set<string>();
    // Cross-panel sample filter: clicking a legend category (or Hide
    // All/Show All) in any panel should hide the underlying SAMPLES
    // everywhere, even in a panel colored by a completely different
    // attribute whose own category names don't match (e.g. "Breast Cancer"
    // vs. "Missense (Driver)"). Each panel keeps its own category-toggle
    // state locally (purely to drive its own legend UI - see
    // EmbeddingsPanel's localHiddenCategories) and contributes the
    // resulting set of hidden sample/patient identity keys here, keyed by
    // panel index so a panel's contribution can be replaced or dropped
    // independently of every other panel's. Every panel's plot then
    // filters by the union of all contributions below.
    //
    // @observable.shallow, not plain @observable: a contribution can hold
    // tens of thousands of sample keys (e.g. "Hide All" on a large study),
    // and MobX's default deep enhancer would recursively convert each
    // Set<string> VALUE stored in this Map into its own observable Set too
    // - instrumenting every individual string entry. That made every
    // update to a large hidden set catastrophically slow (and memory-
    // hungry). Shallow keeps only the Map's own key/value slots reactive
    // (just up to 4 of them, one per panel) and leaves each Set a plain,
    // uninstrumented JS Set.
    @observable.shallow private hiddenSampleKeysByPanel = new Map<
        number,
        Set<string>
    >();

    @computed private get sharedHiddenSampleKeys(): Set<string> {
        const result = new Set<string>();
        this.hiddenSampleKeysByPanel.forEach(keys => {
            keys.forEach(key => result.add(key));
        });
        return result;
    }
    // The primary panel's live viewState, broadcast so a non-primary panel
    // can optionally lock its own view to follow it. Deliberately a plain
    // (non-observable) mutable holder, not MobX/React state: the primary
    // panel writes to it on every pan/zoom frame, and making that a tracked
    // observable read during this component's render() would force the
    // entire multi-panel wrapper (and every sibling panel) to re-render on
    // every single frame of a drag - a severe, highly visible perf
    // regression. Locked panels poll this holder themselves (see
    // EmbeddingsPanel's rAF-driven lock loop) instead of receiving pushed
    // updates, so only a locked panel's own render is ever triggered.
    private readonly primaryViewStateHolder: { current: ViewState | null } = {
        current: null,
    };
    // Single toggle, shown only on the primary panel: when on, every
    // non-primary panel follows the primary panel's pan/zoom instead of
    // moving independently.
    @observable private sharedLockToPrimary = false;
    // When on (default), every panel shows the same map, driven from the
    // status bar's dropdown instead of each panel's own.
    @observable private sharedLockMap = true;
    @observable private sharedMapValue: string | undefined;

    // Total/visible sample counts (plus the embedding's own full
    // construction size and description), reported by whichever panel
    // last fired its reaction (they should all agree, since
    // visibleSampleCount already reflects the same shared
    // hiddenSampleKeys) - plain values, so no reference-instability risk
    // the way a shared Set would have. Drives the top status bar below,
    // both its "X / Y visible" state and its "constructed using N
    // samples" info state plus explainer tooltip.
    @observable private reportedTotalSampleCount = 0;
    @observable private reportedVisibleSampleCount = 0;
    @observable private reportedEmbeddingSampleSize = 0;
    @observable private reportedEmbeddingDescription = '';
    @observable private reportedEmbeddingType: 'patients' | 'samples' =
        'samples';
    // Full cohort size (same unit as the embedding) - only mentioned in
    // the explainer tooltip when it's larger than reportedTotalSampleCount,
    // i.e. the map actually covers fewer than the full cohort.
    @observable private reportedCohortCount = 0;

    // Ref to panel 1 specifically, so the status bar's "Make Global"
    // button can trigger its applyFilterGlobally() directly - simpler
    // than inventing another cross-panel broadcast mechanism for a
    // one-off, explicit user action.
    private readonly panel1Ref = React.createRef<EmbeddingsPanel>();

    // Increments when the status bar's "Clear" button is clicked - every
    // panel resets its own hidden-category and lasso-selection filters in
    // response (see EmbeddingsPanel's componentDidUpdate). Unlike "Make
    // Global", this needs to reach EVERY panel (not just panel 1), so a
    // broadcast request id is simpler than one ref per panel.
    @observable private sharedClearFilterRequestId = 0;

    constructor(props: IEmbeddingsTabProps) {
        super(props);
        makeObservable(this);

        const urlWrapper = (this.props.store as any).urlWrapper;
        let count = 1;
        for (let i = 2; i <= MAX_PANELS; i++) {
            const hasParams =
                !!urlWrapper?.query?.[coloringParamName(i)]?.selectedOption ||
                !!urlWrapper?.query?.[mapParamName(i)];
            if (hasParams) {
                count = i;
            } else {
                break;
            }
        }
        this.panelCount = count;
        // Locking defaults to on whenever multiple panels are in play,
        // including a URL loaded directly into split view.
        this.sharedLockToPrimary = count > 1;

        const tooltipFieldsFromUrl = urlWrapper?.query?.[TOOLTIP_FIELDS_PARAM];
        if (tooltipFieldsFromUrl) {
            try {
                const parsed = JSON.parse(tooltipFieldsFromUrl);
                if (Array.isArray(parsed)) {
                    this.sharedTooltipFields = new Set(parsed);
                }
            } catch (e) {
                // Malformed URL param - ignore and keep the empty default.
            }
        }
    }

    @action.bound
    private onSharedSelectionModeChange(mode: 'none' | 'lasso') {
        this.sharedSelectionMode = mode;
    }

    @action.bound
    private onSharedTooltipFieldsChange(fields: Set<string>) {
        this.sharedTooltipFields = fields;

        const urlWrapper = (this.props.store as any).urlWrapper;
        if (urlWrapper) {
            urlWrapper.updateURL({
                [TOOLTIP_FIELDS_PARAM]: JSON.stringify(Array.from(fields)),
            });
        }
    }

    @action.bound
    private onToggleLockToPrimary() {
        this.sharedLockToPrimary = !this.sharedLockToPrimary;
    }

    @action.bound
    private onToggleLockMap() {
        this.sharedLockMap = !this.sharedLockMap;
        if (this.sharedLockMap) {
            const current = this.panel1Ref.current?.selectedReactSelectOption;
            if (current) {
                this.sharedMapValue = current.value;
            }
        }
    }

    @action.bound
    private onSharedMapChange(value: string) {
        this.sharedMapValue = value;
    }

    @action.bound
    private onToggleQcCategoryVisibility(category: string) {
        if (this.sharedHiddenQcCategories.has(category)) {
            this.sharedHiddenQcCategories.delete(category);
        } else {
            this.sharedHiddenQcCategories.add(category);
        }
    }

    @action.bound
    private onSetPanelHiddenSampleKeys(panelIndex: number, keys: Set<string>) {
        // Content-equality short-circuit, not just a reference check: the
        // panel's own computed rebuilds a brand new Set object every time
        // it re-executes, even when nothing meaningful changed (e.g. once
        // MobX is holding it less warmly across a setTimeout-deferred
        // hop). Writing that "new but identical" Set into this Map
        // unconditionally would invalidate sharedHiddenSampleKeys, force
        // this wrapper to re-render, hand every panel a new
        // hiddenSampleKeys prop, and cause their plotData to recompute -
        // which can re-derive the SAME "new" Set again and repeat
        // indefinitely, entirely self-sustaining once started. Bailing
        // out here when the content is unchanged stops that loop from
        // ever getting a foothold.
        const existing = this.hiddenSampleKeysByPanel.get(panelIndex);
        if (existing && existing.size === keys.size) {
            let identical = true;
            for (const key of keys) {
                if (!existing.has(key)) {
                    identical = false;
                    break;
                }
            }
            if (identical) {
                return;
            }
        }
        this.hiddenSampleKeysByPanel.set(panelIndex, keys);
    }

    @action.bound
    private onReportSampleCounts(info: {
        total: number;
        visible: number;
        embeddingSampleSize: number;
        embeddingDescription: string;
        embeddingType: 'patients' | 'samples';
        cohortCount: number;
    }) {
        this.reportedTotalSampleCount = info.total;
        this.reportedVisibleSampleCount = info.visible;
        this.reportedEmbeddingSampleSize = info.embeddingSampleSize;
        this.reportedEmbeddingDescription = info.embeddingDescription;
        this.reportedEmbeddingType = info.embeddingType;
        this.reportedCohortCount = info.cohortCount;
    }

    // "samples" or "patients", matching the current embedding's own unit -
    // used throughout the top status bar and its explainer tooltip so the
    // wording is accurate for both sample-level and patient-level maps.
    @computed private get unitLabel(): string {
        return this.reportedEmbeddingType;
    }

    // Some of the current cohort's own samples aren't part of the
    // precomputed map at all (nothing to show for them).
    @computed private get hasMissingCohortSamples(): boolean {
        return this.reportedCohortCount > this.reportedTotalSampleCount;
    }

    // The map also includes samples from outside the current cohort
    // (shown, but labeled "not in this cohort" - hideable via
    // Configuration).
    @computed private get hasExtraNonCohortSamples(): boolean {
        return this.reportedEmbeddingSampleSize > this.reportedTotalSampleCount;
    }

    // Drives the main status-bar icon: warn (rather than just inform) when
    // either mismatch means what's shown isn't a clean 1:1 match with the
    // current cohort.
    @computed private get hasEmbeddingWarning(): boolean {
        return this.hasMissingCohortSamples || this.hasExtraNonCohortSamples;
    }

    @action.bound
    private onApplyGlobally() {
        // Reads and applies the CURRENT filter synchronously (via
        // panel 1's plotData), so it's safe to broadcast a clear right
        // after - once the filtering happens upstream, as a real Study
        // View selection, the local legend/lasso filter that produced it
        // is now redundant and would just be stale, unreset state. Only
        // clear when a selection was actually applied - e.g. Hide All
        // leaving zero visible samples is a no-op, and clearing then
        // would just silently discard the user's filter for nothing.
        const applied = this.panel1Ref.current?.applyFilterGlobally();
        if (applied) {
            this.sharedClearFilterRequestId += 1;
        }
    }

    @action.bound
    private onClearFilter() {
        this.sharedClearFilterRequestId += 1;
    }

    // Deliberately NOT a MobX @action - a plain field write on the holder
    // above, so broadcasting the primary panel's view every pan/zoom frame
    // costs nothing and never triggers a re-render (see the holder's
    // comment for why that matters).
    private readonly setPrimaryViewState = (viewState: ViewState) => {
        this.primaryViewStateHolder.current = viewState;
    };

    // Jumps straight to a target panel count (from the "1 2 3 4" control),
    // rather than splitting one panel at a time. Growing copies the calling
    // panel's current selection into every newly-added slot; shrinking
    // trims from the top.
    @action.bound
    private onSetPanelCount(targetCount: number, callingPanelIndex: number) {
        const currentCount = this.panelCount;
        if (targetCount === currentCount) {
            return;
        }
        const urlWrapper = (this.props.store as any).urlWrapper;
        if (!urlWrapper) {
            return;
        }

        if (targetCount > currentCount) {
            const updates: { [key: string]: any } = {};
            for (let i = currentCount + 1; i <= targetCount; i++) {
                updates[coloringParamName(i)] =
                    urlWrapper.query?.[coloringParamName(callingPanelIndex)];
                updates[mapParamName(i)] =
                    urlWrapper.query?.[mapParamName(callingPanelIndex)];
            }
            urlWrapper.updateURL(updates);
            this.panelCount = targetCount;
            // Locking defaults to on the moment multiple panels first
            // come into play.
            if (currentCount === 1) {
                this.sharedLockToPrimary = true;
            }
        } else {
            // Shrinking - unmount the panels above targetCount FIRST
            // (disposing their own URL-sync reactions) before clearing
            // their URL params, so they can't write a stale default back
            // into a slot we're freeing.
            this.panelCount = targetCount;
            if (targetCount === 1) {
                // Back to a single panel - reset so the next split starts
                // fresh with the default-on behavior above.
                this.sharedLockToPrimary = false;
            }
            // Drop the vacated panels' sample-filter contributions too -
            // otherwise a stale, non-empty contribution from a since-closed
            // panel would keep filtering every remaining panel forever.
            for (let i = targetCount + 1; i <= currentCount; i++) {
                this.hiddenSampleKeysByPanel.delete(i);
            }
            setTimeout(() => {
                const updates: { [key: string]: any } = {};
                for (let i = targetCount + 1; i <= currentCount; i++) {
                    updates[coloringParamName(i)] = undefined;
                    updates[mapParamName(i)] = undefined;
                }
                urlWrapper.updateURL(updates);
            }, 0);
        }
    }

    private renderPanels() {
        const panelIndexes: PanelIndex[] = Array.from(
            { length: this.panelCount },
            (_, i) => (i + 1) as PanelIndex
        );

        // 4 panels lay out as a 2x2 square rather than one cramped row.
        const isSquareLayout = this.panelCount === 4;

        return (
            <div
                style={
                    isSquareLayout
                        ? {
                              display: 'grid',
                              gridTemplateColumns: 'repeat(2, 1fr)',
                              gridTemplateRows: 'repeat(2, 1fr)',
                              gap: '12px',
                              width: '100%',
                          }
                        : {
                              display: 'flex',
                              gap: '12px',
                              width: '100%',
                          }
                }
            >
                {panelIndexes.map(panelIndex => (
                    <div
                        key={panelIndex}
                        style={{
                            minWidth: 0,
                            // One border around the whole panel, owned by
                            // the wrapper rather than the plot itself -
                            // adjacent panels already have the flex/grid
                            // gap between them, so giving each panel its
                            // own border too used to draw two parallel
                            // lines at every seam.
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            ...(isSquareLayout ? {} : { flex: 1 }),
                        }}
                    >
                        <EmbeddingsPanel
                            store={this.props.store}
                            panelIndex={panelIndex}
                            panelCount={this.panelCount}
                            selectionMode={this.sharedSelectionMode}
                            onSelectionModeChange={
                                this.onSharedSelectionModeChange
                            }
                            tooltipFields={this.sharedTooltipFields}
                            onTooltipFieldsChange={
                                this.onSharedTooltipFieldsChange
                            }
                            hiddenQcCategories={this.sharedHiddenQcCategories}
                            onToggleQcCategoryVisibility={
                                this.onToggleQcCategoryVisibility
                            }
                            hiddenSampleKeys={this.sharedHiddenSampleKeys}
                            onSetPanelHiddenSampleKeys={keys =>
                                this.onSetPanelHiddenSampleKeys(
                                    panelIndex,
                                    keys
                                )
                            }
                            onReportSampleCounts={this.onReportSampleCounts}
                            clearFilterRequestId={
                                this.sharedClearFilterRequestId
                            }
                            primaryViewStateHolder={this.primaryViewStateHolder}
                            onPrimaryViewStateChange={this.setPrimaryViewState}
                            isLockedToPrimary={this.sharedLockToPrimary}
                            onToggleLockedToPrimary={this.onToggleLockToPrimary}
                            isMapLocked={this.sharedLockMap}
                            onToggleLockMap={this.onToggleLockMap}
                            sharedMapValue={this.sharedMapValue}
                            onSharedMapChange={this.onSharedMapChange}
                            onSetPanelCount={target =>
                                this.onSetPanelCount(target, panelIndex)
                            }
                            ref={panelIndex === 1 ? this.panel1Ref : undefined}
                        />
                    </div>
                ))}
            </div>
        );
    }

    // Always-visible top bar: Pan/Select on the left (moved here from
    // each panel's own floating control stack, since selection mode is
    // already shared across every panel) and a status area on the right -
    // either general info about the embedding itself (no selection
    // active) or the active cross-panel selection's Clear/Make Global
    // controls.
    render() {
        const isFilterActive = this.sharedHiddenSampleKeys.size > 0;
        return (
            <div>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        marginBottom: '10px',
                        padding: '8px 12px',
                        backgroundColor: isFilterActive ? '#fff8e1' : '#f8f9fa',
                        border: isFilterActive
                            ? '1px solid #ffe082'
                            : '1px solid #dee2e6',
                        borderRadius: '4px',
                        fontSize: '12px',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            gap: '2px',
                            flexShrink: 0,
                            height: '28px',
                            boxSizing: 'border-box',
                            backgroundColor: 'white',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            padding: '2px',
                        }}
                    >
                        <button
                            data-test="embeddings-pan-button"
                            onClick={() =>
                                this.onSharedSelectionModeChange('none')
                            }
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px 8px',
                                fontSize: '11px',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                backgroundColor:
                                    this.sharedSelectionMode === 'none'
                                        ? '#007bff'
                                        : 'transparent',
                                color:
                                    this.sharedSelectionMode === 'none'
                                        ? 'white'
                                        : '#333',
                            }}
                            title="Pan and zoom the visualization"
                        >
                            <i
                                className="fa-regular fa-hand"
                                style={{
                                    marginRight: '4px',
                                    fontSize: '11px',
                                }}
                            ></i>
                            Pan
                        </button>
                        <button
                            data-test="embeddings-select-button"
                            onClick={() =>
                                this.onSharedSelectionModeChange('lasso')
                            }
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px 8px',
                                fontSize: '11px',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                backgroundColor:
                                    this.sharedSelectionMode === 'lasso'
                                        ? '#007bff'
                                        : 'transparent',
                                color:
                                    this.sharedSelectionMode === 'lasso'
                                        ? 'white'
                                        : '#333',
                            }}
                            title="Draw a freeform lasso to select points"
                        >
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeDasharray="4,4"
                                style={{ marginRight: '4px' }}
                            >
                                <path d="M3 8c0-3 2-5 6-5s8 2 10 6c2 4 1 8-2 10s-7 2-10 0S1 13 3 8Z" />
                            </svg>
                            Select
                        </button>
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                        }}
                    >
                        <span
                            data-test="embeddings-status-bar"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '4px',
                            }}
                        >
                            {isFilterActive ? (
                                <>
                                    Selection active &mdash;{' '}
                                    {this.reportedVisibleSampleCount.toLocaleString()}{' '}
                                    /{' '}
                                    {this.reportedTotalSampleCount.toLocaleString()}{' '}
                                    {this.unitLabel} visible
                                </>
                            ) : this.panelCount === 1 || this.sharedLockMap ? (
                                <>
                                    {this.reportedTotalSampleCount.toLocaleString()}{' '}
                                    {this.unitLabel} embedded in{' '}
                                    {this.panel1Ref.current
                                        ?.shouldShowControls ? (
                                        <Select
                                            name="embedding-select"
                                            value={
                                                this.panel1Ref.current
                                                    .selectedReactSelectOption
                                            }
                                            onChange={(option: any) =>
                                                this.panel1Ref.current?.onEmbeddingChange(
                                                    option
                                                )
                                            }
                                            options={
                                                this.panel1Ref.current
                                                    .reactSelectEmbeddingOptions
                                            }
                                            isSearchable={false}
                                            styles={MAP_SELECT_STYLES}
                                        />
                                    ) : null}{' '}
                                    similarity map (constructed using{' '}
                                    {this.reportedEmbeddingSampleSize.toLocaleString()}{' '}
                                    {this.unitLabel})
                                </>
                            ) : null}
                        </span>
                        {!isFilterActive &&
                            (this.panelCount === 1 || this.sharedLockMap) && (
                                <DefaultTooltip
                                    placement="bottom"
                                    overlay={
                                        <div
                                            style={{
                                                minWidth: '220px',
                                                maxWidth: '300px',
                                                fontSize: '12px',
                                            }}
                                        >
                                            {this
                                                .reportedEmbeddingDescription && (
                                                <div
                                                    style={{
                                                        marginBottom: '6px',
                                                    }}
                                                >
                                                    {
                                                        this
                                                            .reportedEmbeddingDescription
                                                    }
                                                </div>
                                            )}
                                            <div>
                                                This shows a 2D projection of an{' '}
                                                <strong>embedding</strong> - a
                                                representation that places{' '}
                                                {this.unitLabel} with similar
                                                patterns close together.
                                                {this
                                                    .hasMissingCohortSamples && (
                                                    <>
                                                        {' '}
                                                        It&apos;s precomputed,
                                                        so only the{' '}
                                                        {this.unitLabel} that
                                                        were part of building it
                                                        show up here (in your
                                                        case,{' '}
                                                        <strong>
                                                            {this.reportedTotalSampleCount.toLocaleString()}
                                                        </strong>{' '}
                                                        of your cohort&apos;s{' '}
                                                        <strong>
                                                            {this.reportedCohortCount.toLocaleString()}
                                                        </strong>{' '}
                                                        {this.unitLabel}).
                                                    </>
                                                )}
                                            </div>
                                            {this.hasExtraNonCohortSamples && (
                                                <div
                                                    style={{ marginTop: '6px' }}
                                                >
                                                    The map was built using an
                                                    additional{' '}
                                                    <strong>
                                                        {(
                                                            this
                                                                .reportedEmbeddingSampleSize -
                                                            this
                                                                .reportedTotalSampleCount
                                                        ).toLocaleString()}
                                                    </strong>{' '}
                                                    {this.unitLabel} from
                                                    outside your current cohort
                                                    - shown here too, but you
                                                    can hide them via the
                                                    legend&apos;s Configuration
                                                    section.
                                                </div>
                                            )}
                                        </div>
                                    }
                                >
                                    <i
                                        className={
                                            this.hasEmbeddingWarning
                                                ? 'fa fa-exclamation-triangle'
                                                : 'fa fa-info-circle'
                                        }
                                        style={{
                                            color: this.hasEmbeddingWarning
                                                ? '#e0a800'
                                                : '#888',
                                            cursor: 'help',
                                        }}
                                    />
                                </DefaultTooltip>
                            )}
                        {isFilterActive && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                    data-test="embeddings-clear-button"
                                    onClick={this.onClearFilter}
                                    title="Clear this selection on every panel"
                                    style={{
                                        padding: '4px 10px',
                                        fontSize: '11px',
                                        border: '1px solid #ccc',
                                        borderRadius: '3px',
                                        backgroundColor: 'white',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Clear
                                </button>
                                <button
                                    data-test="embeddings-make-global-button"
                                    onClick={this.onApplyGlobally}
                                    title="Apply this selection as a Study View selection, affecting every tab on the page"
                                    style={{
                                        padding: '4px 10px',
                                        fontSize: '11px',
                                        border: '1px solid #ccc',
                                        borderRadius: '3px',
                                        backgroundColor: 'white',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Make Global
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                {this.renderPanels()}
            </div>
        );
    }
}
