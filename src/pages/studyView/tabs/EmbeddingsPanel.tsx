import * as React from 'react';
import { observer } from 'mobx-react';
import {
    computed,
    observable,
    action,
    makeObservable,
    reaction,
    comparer,
} from 'mobx';
import { remoteData } from 'cbioportal-frontend-commons';
import { StudyViewPageStore } from 'pages/studyView/StudyViewPageStore';
import LoadingIndicator from 'shared/components/loadingIndicator/LoadingIndicator';
import {
    ColoringMenuOmnibarOption,
    ColoringMenuOmnibarGroup,
} from 'shared/components/plots/PlotsTabTypes';
import {
    makeEmbeddingScatterPlotData,
    EmbeddingPlotPoint,
    getEmbeddingDataFields,
    EMBEDDING_DATA_PREFIX,
    preComputeEmbeddingDataColors,
    getGeneAlterationLabel,
} from 'shared/components/plots/EmbeddingPlotUtils';
import {
    EmbeddingDeckGLVisualization,
    EmbeddingDataOption,
} from 'shared/components/embeddings';
import { EmbeddingControlStack } from 'shared/components/embeddings/controls/EmbeddingControlStack';
import { Gene } from 'cbioportal-ts-api-client';
import { addCancerStudyAttribute } from 'shared/lib/ClinicalAttributeUtils';

import {
    EmbeddingData,
    ViewState,
    EmbeddingPoint,
} from 'shared/components/embeddings/EmbeddingTypes';
import { calculateDataBounds } from 'shared/components/embeddings/utils/dataUtils';
import {
    preComputeClinicalDataMaps,
    getMolecularDataForGeneSync,
    aggregateMolecularDataByPatient,
} from 'shared/lib/PatientMolecularDataUtils';

export interface IEmbeddingsPanelProps {
    store: StudyViewPageStore;
    panelIndex: 1 | 2 | 3 | 4;
    panelCount: number;
    // Shared across every panel so Pan/Select applies to all of them at once.
    selectionMode: 'none' | 'lasso';
    onSelectionModeChange: (mode: 'none' | 'lasso') => void;
    // Shared across every panel so the same tooltip fields show everywhere.
    tooltipFields: Set<string>;
    onTooltipFieldsChange: (fields: Set<string>) => void;
    // Shared across every panel so hiding a QC category (via the primary
    // panel's legend Configuration section) applies everywhere.
    hiddenQcCategories: Set<string>;
    onToggleQcCategoryVisibility: (category: string) => void;
    // Shared across every panel so hiding a legend category's underlying
    // SAMPLES (via clicking it, or Hide All/Show All) filters every
    // panel's points, even one colored by a completely different
    // attribute with non-overlapping category names. This panel keeps its
    // own category-toggle state locally (see localHiddenCategories) purely
    // to drive its own legend UI, and contributes the resulting
    // sample/patient identity keys here via onSetPanelHiddenSampleKeys.
    hiddenSampleKeys: Set<string>;
    onSetPanelHiddenSampleKeys: (keys: Set<string>) => void;
    // Reports this panel's own total/visible sample counts up to the
    // wrapper (plain numbers, not Sets - no reference-instability risk),
    // so it can show a single "X / Y visible" status regardless of which
    // panel's legend selection is actually driving the cross-panel
    // filter. Every panel's visibleSampleCount already reflects the same
    // shared hiddenSampleKeys, so any one of them is representative.
    onReportSampleCounts?: (info: {
        total: number;
        visible: number;
        embeddingSampleSize: number;
        embeddingDescription: string;
        embeddingType: 'patients' | 'samples';
        cohortCount: number;
    }) => void;
    // Increments whenever the status bar's "Clear" button is clicked -
    // every panel resets both its own hidden-category and lasso-selection
    // filters when this changes (see componentDidUpdate).
    clearFilterRequestId: number;
    // The primary panel's live viewState. A plain mutable holder (not a
    // reactive prop) - the primary panel writes to it on every pan/zoom
    // frame via onPrimaryViewStateChange, and a locked panel polls it via
    // requestAnimationFrame (see startLockPolling) rather than receiving
    // pushed updates, so panning/zooming never forces every panel to
    // re-render.
    primaryViewStateHolder: { current: ViewState | null };
    onPrimaryViewStateChange: (viewState: ViewState) => void;
    // Single toggle shared by every panel (shown only on the primary
    // panel's controls): when on, every non-primary panel follows the
    // primary panel's pan/zoom instead of moving independently.
    isLockedToPrimary: boolean;
    onToggleLockedToPrimary: () => void;
    onSetPanelCount: (target: number) => void;
}

// Base URL for embedding data
const EMBEDDING_BASE_URL =
    'https://datahub.assets.cbioportal.org/embeddings/msk_mosaic_2026';

// Module-level singleton remote data loaders for embeddings
// These are shared across all component instances to prevent duplicate fetches
const boehmHeData = remoteData<EmbeddingData>({
    await: () => [], // No dependencies - invoke once immediately and cache
    invoke: async () => {
        const response = await fetch(`${EMBEDDING_BASE_URL}/umap_he_50k.json`);
        if (!response.ok) {
            throw new Error('Failed to load H&E embedding data');
        }
        return response.json();
    },
});

@observer
export class EmbeddingsPanel extends React.Component<
    IEmbeddingsPanelProps,
    {}
> {
    // Use @observable.ref to only track reference changes, not deep changes
    // This prevents MobX from trying to deeply traverse the object, which could cause
    // issues with circular references in custom attributes (the 'data' property contains
    // ClinicalData items that reference back to the parent attribute)
    @observable.ref private selectedColoringOption?: ColoringMenuOmnibarOption;
    @observable private coloringLogScale = false;
    @observable private mutationTypeEnabled = true;
    @observable private copyNumberEnabled = true;
    @observable private structuralVariantEnabled = true;
    @observable private selectedEmbeddingValue: string = 'msk_mosaic_2026_he';
    @observable.ref private viewState: ViewState = {
        target: [0, 0, 0],
        zoom: 0,
        minZoom: -5,
        maxZoom: 10,
    };
    @observable private windowHeight = window.innerHeight;
    @observable private legendCollapsed = false;
    @observable.ref private pinnedPoint: EmbeddingPoint | null = null;
    // This panel's own hidden legend categories - local, not shared, since
    // it purely drives this panel's own legend checkboxes. The resulting
    // set of hidden sample/patient identity keys is what actually gets
    // shared across panels (see ownHiddenSampleKeys and the reaction that
    // pushes it up via onSetPanelHiddenSampleKeys).
    @observable.ref private localHiddenCategories = new Set<string>();
    // A lasso selection, kept local for the same reason: it's a candidate
    // filter shown in the shared status bar, applied globally only when
    // the user clicks "Make Global" (see applyFilterGlobally). null means
    // no lasso filter is active; folded into ownHiddenSampleKeys below as
    // "everything outside the lasso is also hidden."
    @observable.ref private lassoSelectedKeys: Set<string> | null = null;
    private urlParameterReactionDisposer?: () => void;
    private urlSyncReactionDisposer?: () => void;
    private viewStateReactionDisposer?: () => void;
    private driverAnnotationReactionDisposer?: () => void;
    private filterChangeReactionDisposer?: () => void;
    private hiddenSampleKeysReactionDisposer?: () => void;
    private sampleCountsReportReactionDisposer?: () => void;
    private viewStateInitialized = false;
    private centerViewTimeoutId?: ReturnType<typeof setTimeout>;
    // mobx-react's @observer makes the whole `this.props` object reactive
    // as one unit, so any @computed that reads `this.props.X` depends on
    // EVERY prop this panel receives, not just X - e.g. it gets needlessly
    // invalidated whenever the shared Pan/Select mode changes, cascading
    // into a full plot data rebuild and a multi-second deck.gl GPU redraw.
    // `store` never changes for this panel's lifetime, so cache it as a
    // plain (non-reactive) field and read that everywhere instead.
    private readonly store = this.props.store;
    // hiddenSampleKeys/hiddenQcCategories/tooltipFields DO need to stay
    // reactive (their actual values change), so they can't just be
    // cached once like `store` - instead, mirror them into their own
    // observables that only get written (in componentDidUpdate, using
    // React's own prevProps snapshot rather than mobx-react's reactive
    // props) when the incoming prop's reference genuinely changes. Any
    // @computed reads the mirror, not this.props, so it's no longer
    // invalidated by unrelated prop churn (e.g. Pan/Select toggling).
    @observable.ref private hiddenSampleKeysMirror = this.props
        .hiddenSampleKeys;
    @observable.ref private hiddenQcCategoriesMirror = this.props
        .hiddenQcCategories;
    @observable.ref private tooltipFieldsMirror = this.props.tooltipFields;

    // Clinical attributes that always have a fixed tooltip row and so are
    // excluded from the user-toggleable tooltip fields dropdown.
    private static readonly FIXED_TOOLTIP_CLINICAL_ATTRIBUTE_IDS = [
        'CANCER_TYPE',
        'CANCER_TYPE_DETAILED',
        'SAMPLE_TYPE',
    ];

    // The panel's own URL param name for each piece of synced state. Panel 1
    // keeps the original unsuffixed names for backward compatibility with
    // already-shared links; panels 2-4 use suffixed names, matching the
    // codebase's plots_horz_selection/plots_vert_selection fixed-slot
    // convention.
    @computed private get coloringParamName(): string {
        return this.props.panelIndex === 1
            ? 'embeddings_coloring_selection'
            : `embeddings_panel${this.props.panelIndex}_coloring_selection`;
    }

    @computed private get mapParamName(): string {
        return this.props.panelIndex === 1
            ? 'embeddings_map'
            : `embeddings_panel${this.props.panelIndex}_map`;
    }

    @computed private get legendCollapsedParamName(): string {
        return this.props.panelIndex === 1
            ? 'embeddings_legend_collapsed'
            : `embeddings_panel${this.props.panelIndex}_legend_collapsed`;
    }

    constructor(props: IEmbeddingsPanelProps) {
        super(props);
        makeObservable(this);

        // Initialize default coloring
        this.initializeDefaultColoring();

        // Initialize map choice from the URL once, up front - a simple
        // single-value param, not gated on any async data the way
        // gene-based coloring is. Tooltip fields are shared across every
        // panel and owned by the wrapper (this.props.tooltipFields).
        const urlWrapper = (this.store as any).urlWrapper;
        const mapFromUrl = urlWrapper?.query?.[this.mapParamName];
        if (mapFromUrl) {
            this.selectedEmbeddingValue = mapFromUrl;
        }
        this.legendCollapsed =
            urlWrapper?.query?.[this.legendCollapsedParamName] === 'true';

        // Listen for window resize events
        this.handleResize = this.handleResize.bind(this);

        // Initialize view state when plot data is computed
        // Watch the actual rendered data, not the raw embedding data
        this.viewStateReactionDisposer = reaction(
            () => this.plotData,
            plotData => {
                // Only initialize ONCE when data first becomes available.
                // This check alone isn't enough to prevent duplicate
                // centerView() calls: plotData can change reference
                // several times in quick succession right after mount
                // (e.g. as this panel's own hiddenSampleKeys contribution
                // settles), and each firing would otherwise queue its own
                // 100ms timeout before the first one has had a chance to
                // flip viewStateInitialized - so debounce (clear any
                // pending timeout) and re-check the flag when the timeout
                // actually fires, not just when it's scheduled.
                if (
                    plotData &&
                    plotData.length > 0 &&
                    !this.viewStateInitialized
                ) {
                    if (this.centerViewTimeoutId !== undefined) {
                        clearTimeout(this.centerViewTimeoutId);
                    }
                    // Small delay to ensure DeckGL is fully initialized
                    this.centerViewTimeoutId = setTimeout(() => {
                        this.centerViewTimeoutId = undefined;
                        if (!this.viewStateInitialized) {
                            this.centerView(); // Use the action method
                            this.viewStateInitialized = true; // Mark as initialized
                        }
                    }, 100);
                }
            }
        );

        // Set up single URL-driven reaction for state management
        this.urlParameterReactionDisposer = reaction(
            () => {
                const urlOption = this.coloringFromURLParameter;
                const clinicalAttributesReady =
                    this.clinicalAttributes.length > 0;
                const urlWrapperReady = !!(this.store as any).urlWrapper;

                return {
                    urlOption,
                    clinicalAttributesReady,
                    urlWrapperReady,
                    hasUrlParams: this.hasExistingURLParameters,
                };
            },
            ({
                urlOption,
                clinicalAttributesReady,
                urlWrapperReady,
                hasUrlParams,
            }) => {
                if (!urlWrapperReady || !clinicalAttributesReady) {
                    return;
                }

                if (urlOption) {
                    // URL parameters exist - apply them
                    // GUARD: Don't update if we already have the same logical value
                    // This prevents infinite loops when URL sync creates new object references
                    const currentAttrId = this.selectedColoringOption?.info
                        ?.clinicalAttribute?.clinicalAttributeId;
                    const currentGeneId = this.selectedColoringOption?.info
                        ?.entrezGeneId;
                    const urlAttrId =
                        urlOption.info?.clinicalAttribute?.clinicalAttributeId;
                    const urlGeneId = urlOption.info?.entrezGeneId;

                    if (
                        currentAttrId === urlAttrId &&
                        currentGeneId === urlGeneId
                    ) {
                        return;
                    }
                    this.selectedColoringOption = urlOption;
                } else if (!hasUrlParams) {
                    // No URL parameters - set default and sync to URL
                    const defaultOption = this.getDefaultColoringOption();
                    if (defaultOption) {
                        this.selectedColoringOption = defaultOption;
                        this.syncColoringSelectionToURL(defaultOption);
                    }
                }
            },
            { fireImmediately: true }
        );

        // Reaction to enable driver annotations when a gene is selected for coloring
        // This replaces the side effect that was previously in the driverAnnotationsEnabled computed
        this.driverAnnotationReactionDisposer = reaction(
            () => ({
                entrezGeneId: this.selectedColoringOption?.info?.entrezGeneId,
                driversAnnotated: this.store.driverAnnotationSettings
                    ?.driversAnnotated,
            }),
            ({ entrezGeneId, driversAnnotated }) => {
                // Enable driver annotations when a gene is selected (not "Cancer Type" which is -3)
                // and annotations aren't already enabled
                if (
                    entrezGeneId &&
                    entrezGeneId !== -3 &&
                    entrezGeneId !== -10000 && // "None" option
                    !driversAnnotated
                ) {
                    this.enableDriverAnnotations();
                }
            },
            { fireImmediately: true }
        );

        // Clear pinned tooltip when all filters are cleared (selection count drops to 0)
        this.filterChangeReactionDisposer = reaction(
            () => this.store.numberOfSelectedSamplesInCustomSelection,
            count => {
                if (count === 0) {
                    this.pinnedPoint = null;
                }
            }
        );

        // Push this panel's own hidden-category selection up as a set of
        // sample/patient identity keys, so every panel - regardless of its
        // own coloring - can filter by the same underlying samples.
        // Deferred via setTimeout: the wrapper's render reads the shared
        // union of every panel's contribution, so calling straight into
        // its action here would mutate that same observable SYNCHRONOUSLY
        // as part of the very reaction/render flush that's about to read
        // it - MobX schedules the wrapper to re-render again immediately,
        // and since that re-render hands this panel a brand new
        // hiddenSampleKeys Set reference each time, it can cascade into
        // "Maximum update depth exceeded". Breaking out into its own tick
        // makes each push a clean, independent update instead.
        this.hiddenSampleKeysReactionDisposer = reaction(
            () => this.ownHiddenSampleKeys,
            keys => {
                setTimeout(
                    () => this.props.onSetPanelHiddenSampleKeys(keys),
                    0
                );
            },
            { fireImmediately: true }
        );

        // Report total/visible sample counts up to the wrapper for its
        // top status bar - plain values, so (unlike the Set above) there's
        // no risk of a reference-instability feedback loop. Also reports
        // the embedding's own full construction size and description
        // (independent of the current study's cohort), for the
        // "constructed using X samples" info and its explainer tooltip,
        // shown when no selection/filter is active.
        this.sampleCountsReportReactionDisposer = reaction(
            () => {
                const allSamples = this.store.samples.result || [];
                const embeddingType =
                    this.selectedEmbedding?.data.embedding_type || 'samples';
                // Full cohort size in the SAME unit as the embedding
                // (patients vs. samples), so it's directly comparable to
                // totalSampleCount below - only shown in the tooltip when
                // it's actually larger (i.e. the map covers fewer than
                // the full cohort).
                const cohortCount =
                    embeddingType === 'patients'
                        ? new Set(allSamples.map(s => s.patientId)).size
                        : allSamples.length;
                return {
                    total: this.totalSampleCount,
                    visible: this.visibleSampleCount,
                    embeddingSampleSize:
                        this.selectedEmbedding?.data.sampleSize || 0,
                    embeddingDescription:
                        this.selectedEmbedding?.data.description || '',
                    embeddingType: embeddingType as 'patients' | 'samples',
                    cohortCount,
                };
            },
            info => {
                if (this.props.onReportSampleCounts) {
                    this.props.onReportSampleCounts(info);
                }
            },
            // Structural (not reference) equality: the tracking function
            // above always returns a FRESH object literal, so MobX's
            // default reference-equality comparer would treat every
            // recompute as "changed" and re-fire the effect even when
            // every field is identical - which, if something upstream
            // (e.g. a clinicalDataCache entry that never resolves) keeps
            // rawPlotData recomputing on its own, becomes a self-sustaining
            // loop that can trip React's "Maximum update depth exceeded"
            // guard. Comparing by content lets the reaction actually
            // settle once the values stop changing, even if the
            // upstream recomputation itself doesn't.
            { fireImmediately: true, equals: comparer.structural }
        );
    }

    componentDidMount() {
        window.addEventListener('resize', this.handleResize);
        // A newly-created panel (e.g. from splitting into more panels)
        // should immediately join the sync if the lock is already on.
        if (this.props.isLockedToPrimary) {
            this.adoptPrimaryViewState();
            this.startLockPolling();
        }
    }

    componentDidUpdate(prevProps: IEmbeddingsPanelProps) {
        if (prevProps.isLockedToPrimary !== this.props.isLockedToPrimary) {
            if (this.props.isLockedToPrimary) {
                this.adoptPrimaryViewState();
                this.startLockPolling();
            } else {
                this.stopLockPolling();
            }
        }
        if (
            prevProps.clearFilterRequestId !== this.props.clearFilterRequestId
        ) {
            this.clearOwnFilters();
        }
        this.syncReactivePropMirrors(prevProps);
    }

    // See the hiddenSampleKeysMirror/hiddenQcCategoriesMirror/
    // tooltipFieldsMirror field comments - only write a mirror observable
    // when React's own prevProps snapshot shows the underlying prop
    // reference actually changed, so @computed getters that read the
    // mirror don't get invalidated by unrelated prop churn.
    @action.bound
    private syncReactivePropMirrors(prevProps: IEmbeddingsPanelProps) {
        if (prevProps.hiddenSampleKeys !== this.props.hiddenSampleKeys) {
            this.hiddenSampleKeysMirror = this.props.hiddenSampleKeys;
        }
        if (prevProps.hiddenQcCategories !== this.props.hiddenQcCategories) {
            this.hiddenQcCategoriesMirror = this.props.hiddenQcCategories;
        }
        if (prevProps.tooltipFields !== this.props.tooltipFields) {
            this.tooltipFieldsMirror = this.props.tooltipFields;
        }
    }

    @action.bound
    private clearOwnFilters() {
        this.localHiddenCategories = new Set();
        this.lassoSelectedKeys = null;
    }

    // Polls the shared viewState holder while locked, rather than
    // receiving it as a reactive prop - the holder is a plain mutable
    // object ANY panel can write to on every pan/zoom frame (see its own
    // comment for why), so this loop is the only way a panel picks up a
    // change some OTHER panel made. Every panel (not just one "primary"
    // source) both writes to and polls the same holder while locked, so
    // panning/zooming any one of them keeps them all in sync. Runs only
    // while locked, and only this panel re-renders when it actually
    // adopts a new view (a plain reference check skips the work entirely
    // when nothing has changed, including reacting to its own writes).
    private lockPollRafId?: number;

    private startLockPolling() {
        if (this.lockPollRafId !== undefined) {
            return;
        }
        const poll = () => {
            if (!this.props.isLockedToPrimary) {
                this.lockPollRafId = undefined;
                return;
            }
            const primary = this.props.primaryViewStateHolder.current;
            if (primary && primary !== this.viewState) {
                this.adoptPrimaryViewState();
            }
            this.lockPollRafId = requestAnimationFrame(poll);
        };
        this.lockPollRafId = requestAnimationFrame(poll);
    }

    private stopLockPolling() {
        if (this.lockPollRafId !== undefined) {
            cancelAnimationFrame(this.lockPollRafId);
            this.lockPollRafId = undefined;
        }
    }

    @action.bound
    private adoptPrimaryViewState() {
        const primary = this.props.primaryViewStateHolder.current;
        if (primary) {
            this.viewState = primary;
        }
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);

        // Clean up reactions
        if (this.viewStateReactionDisposer) {
            this.viewStateReactionDisposer();
        }
        if (this.urlParameterReactionDisposer) {
            this.urlParameterReactionDisposer();
        }
        if (this.urlSyncReactionDisposer) {
            this.urlSyncReactionDisposer();
        }
        if (this.driverAnnotationReactionDisposer) {
            this.driverAnnotationReactionDisposer();
        }
        if (this.filterChangeReactionDisposer) {
            this.filterChangeReactionDisposer();
        }
        if (this.hiddenSampleKeysReactionDisposer) {
            this.hiddenSampleKeysReactionDisposer();
        }
        if (this.sampleCountsReportReactionDisposer) {
            this.sampleCountsReportReactionDisposer();
        }
        if (this.centerViewTimeoutId !== undefined) {
            clearTimeout(this.centerViewTimeoutId);
        }
        this.stopLockPolling();
    }

    @action.bound
    private handleResize() {
        this.windowHeight = window.innerHeight;
    }

    private initializeDefaultColoring() {
        // Initialize with default coloring - URL parameters will be applied via reaction
        const defaultOption = this.getDefaultColoringOption();
        if (defaultOption) {
            this.selectedColoringOption = defaultOption;
        }
    }

    private getDefaultColoringOption(): ColoringMenuOmnibarOption | undefined {
        // Return the default coloring option (CANCER_TYPE_DETAILED or None)
        const cancerTypeAttr = this.clinicalAttributes.find(
            attr => attr.clinicalAttributeId === 'CANCER_TYPE_DETAILED'
        );
        if (cancerTypeAttr) {
            return {
                info: { clinicalAttribute: cancerTypeAttr },
                label: cancerTypeAttr.displayName,
                value: `clinical_${cancerTypeAttr.clinicalAttributeId}`,
            } as ColoringMenuOmnibarOption;
        } else {
            return {
                label: 'None',
                value: 'none',
                info: {
                    entrezGeneId: -10000,
                },
            };
        }
    }

    private parseColoringSelectionFromURL(
        selectedOption: string
    ): ColoringMenuOmnibarOption | undefined {
        try {
            // Parse gene selection (format: "entrezGeneId_undefined" e.g., "1956_undefined")
            const geneMatch = selectedOption.match(/^(\d+)_/);
            if (geneMatch) {
                const entrezGeneId = parseInt(geneMatch[1]);

                // Find the gene in the genes list
                const gene = this.genes.find(
                    g => g.entrezGeneId === entrezGeneId
                );
                if (gene) {
                    return {
                        info: { entrezGeneId: gene.entrezGeneId },
                        label: gene.hugoGeneSymbol,
                        value: `${gene.entrezGeneId}_${gene.hugoGeneSymbol}`,
                    } as ColoringMenuOmnibarOption;
                }
            }

            // Parse clinical attribute selection (format: "undefined_{...json...}")
            // This matches PlotsTab's encoding format exactly
            if (selectedOption.startsWith('undefined_')) {
                const jsonPart = selectedOption.substring('undefined_'.length);

                // The JSON may have escaped quotes that need to be unescaped
                // Replace \" with " to handle URL-encoded escaped quotes
                const unescapedJson = jsonPart.replace(/\\"/g, '"');
                const clinicalInfo = JSON.parse(unescapedJson);

                // Find the clinical attribute by ID (check both clinical attributes and embedding data fields)
                const embeddingFields = this.selectedEmbedding?.data
                    ? getEmbeddingDataFields(this.selectedEmbedding.data)
                    : [];
                const clinicalAttr = [
                    ...this.clinicalAttributes,
                    ...embeddingFields,
                ].find(
                    attr =>
                        attr.clinicalAttributeId ===
                        clinicalInfo.clinicalAttributeId
                );

                if (clinicalAttr) {
                    return {
                        info: { clinicalAttribute: clinicalAttr },
                        label: clinicalAttr.displayName,
                        value: `clinical_${clinicalAttr.clinicalAttributeId}`,
                    } as ColoringMenuOmnibarOption;
                }
            }

            return undefined;
        } catch (e) {
            return undefined;
        }
    }

    @computed get clinicalAttributes() {
        const baseAttributes = this.store.clinicalAttributes.result || [];
        const customAttributes = this.store.customAttributes.result || [];
        return addCancerStudyAttribute([
            ...baseAttributes,
            ...customAttributes,
        ]);
    }

    private getClinicalAttributeValueMap(
        clinicalAttributeId: string
    ): Map<string, string> {
        const attr = this.clinicalAttributes.find(
            a => a.clinicalAttributeId === clinicalAttributeId
        );
        if (!attr) {
            return new Map();
        }

        const cacheEntry = this.store.clinicalDataCache.get(attr);
        if (!cacheEntry?.isComplete || !cacheEntry.result) {
            return new Map();
        }

        // Sample-level embeddings render one point per sample, keyed by
        // uniqueSampleKey (see makeEmbeddingScatterPlotData/TooltipDisplay) -
        // a patient-aggregated map would be wrong/blank for sample-only
        // attributes and inconsistent with how every other point lookup in
        // this panel keys sample embeddings.
        if (this.selectedEmbedding?.data.embedding_type === 'samples') {
            const sampleValueMap = new Map<string, string>();
            cacheEntry.result.data.forEach(d => {
                if ('value' in d) {
                    sampleValueMap.set(d.uniqueSampleKey, d.value || 'Unknown');
                }
            });
            return sampleValueMap;
        }

        const maps = preComputeClinicalDataMaps(
            cacheEntry.result.data,
            null,
            cacheEntry.result.numericalValueToColor,
            attr.patientAttribute || false
        );
        return maps.patientValueMap;
    }

    // Every study clinical attribute the user can add to the tooltip via the
    // "Tooltip fields" dropdown, same universe as the coloring dropdown.
    @computed get tooltipClinicalAttributeOptions(): {
        value: string;
        label: string;
    }[] {
        return this.clinicalAttributes
            .filter(
                attr =>
                    !EmbeddingsPanel.FIXED_TOOLTIP_CLINICAL_ATTRIBUTE_IDS.includes(
                        attr.clinicalAttributeId
                    )
            )
            .map(attr => ({
                value: `clinical_${attr.clinicalAttributeId}`,
                label: attr.displayName,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    // Fields embedded directly in the current embedding's data payload
    // (e.g. "Data Partition (Split)") - same "Map Attributes" group offered
    // in the coloring dropdown.
    @computed get tooltipMapAttributeOptions(): {
        value: string;
        label: string;
    }[] {
        const fields = this.selectedEmbedding?.data
            ? getEmbeddingDataFields(this.selectedEmbedding.data)
            : [];
        return fields
            .map(attr => ({
                value: `mapattr_${attr.displayName}`,
                label: attr.displayName,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    // Genes the user can add to the tooltip as an alteration status field,
    // same universe as the coloring dropdown's "Genes" group.
    @computed get tooltipGeneOptions(): { value: string; label: string }[] {
        return this.genes
            .map(gene => ({
                value: `gene_${gene.entrezGeneId}`,
                label: gene.hugoGeneSymbol,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    // Grouped options for the "Tooltip fields" dropdown, matching the
    // coloring dropdown's Genes / Map Attributes / Clinical Attributes groups.
    @computed get tooltipFieldGroups(): {
        label: string;
        options: { value: string; label: string }[];
    }[] {
        const groups: {
            label: string;
            options: { value: string; label: string }[];
        }[] = [];
        if (this.tooltipGeneOptions.length > 0) {
            groups.push({ label: 'Genes', options: this.tooltipGeneOptions });
        }
        if (this.tooltipMapAttributeOptions.length > 0) {
            groups.push({
                label: 'Map Attributes',
                options: this.tooltipMapAttributeOptions,
            });
        }
        if (this.tooltipClinicalAttributeOptions.length > 0) {
            groups.push({
                label: 'Clinical Attributes',
                options: this.tooltipClinicalAttributeOptions,
            });
        }
        return groups;
    }

    // Flat lookup of every selectable tooltip field, used to resolve labels.
    @computed get tooltipFieldOptions(): { value: string; label: string }[] {
        return this.tooltipFieldGroups.reduce<
            { value: string; label: string }[]
        >((acc, group) => acc.concat(group.options), []);
    }

    // Value maps for the fixed clinical attribute fields plus whichever
    // optional ones are currently selected in the tooltip fields dropdown.
    @computed get tooltipClinicalAttributeValueMaps(): Map<
        string,
        Map<string, string>
    > {
        const ids = new Set(
            EmbeddingsPanel.FIXED_TOOLTIP_CLINICAL_ATTRIBUTE_IDS
        );
        this.tooltipFieldsMirror.forEach(field => {
            if (field.startsWith('clinical_')) {
                ids.add(field.slice('clinical_'.length));
            }
        });

        const result = new Map<string, Map<string, string>>();
        ids.forEach(id => {
            result.set(id, this.getClinicalAttributeValueMap(id));
        });
        return result;
    }

    // Value maps (keyed by patientId or sampleId, matching the current
    // embedding type) for whichever "Map Attributes" fields are selected.
    @computed get tooltipMapAttributeValueMaps(): Map<
        string,
        Map<string, string>
    > {
        const result = new Map<string, Map<string, string>>();
        const embeddingData = this.selectedEmbedding?.data;
        if (!embeddingData) {
            return result;
        }

        const fieldsByKey = new Map(
            getEmbeddingDataFields(embeddingData).map(attr => [
                attr.displayName,
                attr,
            ])
        );

        this.tooltipFieldsMirror.forEach(field => {
            if (!field.startsWith('mapattr_')) {
                return;
            }
            const key = field.slice('mapattr_'.length);
            const attr = fieldsByKey.get(key);
            if (!attr) {
                return;
            }
            const { valueMap } = preComputeEmbeddingDataColors(
                embeddingData,
                key,
                attr.datatype === 'NUMBER'
            );
            result.set(key, valueMap);
        });
        return result;
    }

    // Alteration-status value maps (keyed by patientId) for whichever genes
    // are selected in the tooltip fields dropdown.
    @computed get tooltipGeneValueMaps(): Map<number, Map<string, string>> {
        const result = new Map<number, Map<string, string>>();
        const driverSettings = this.store.driverAnnotationSettings;
        const driversAnnotated = driverSettings?.driversAnnotated || false;
        const plotsTabStore = this.store.plotsTabStore;

        // Mirror molecularDataForColoring's readiness gating: reading the
        // mutation cache before OncoKB/Hotspots annotations are loaded lets
        // putativeDriver get cached as false prematurely, so every mutation
        // then looks like a VUS forever.
        if (driversAnnotated && driverSettings) {
            if (
                driverSettings.oncoKb &&
                !plotsTabStore.oncoKbMutationAnnotationForOncoprint.isComplete
            ) {
                return result;
            }
            if (
                driverSettings.hotspots &&
                !plotsTabStore.isHotspotForOncoprint.isComplete
            ) {
                return result;
            }
            if (!plotsTabStore.getMutationPutativeDriverInfo.isComplete) {
                return result;
            }
        }

        const allSamples = this.store.samples.result || [];

        this.tooltipFieldsMirror.forEach(field => {
            if (!field.startsWith('gene_')) {
                return;
            }
            const entrezGeneId = parseInt(field.slice('gene_'.length), 10);
            if (isNaN(entrezGeneId)) {
                return;
            }

            const molecularData = getMolecularDataForGeneSync(
                entrezGeneId,
                this.store.plotsTabStore,
                {
                    mutationTypeEnabled: this.mutationTypeEnabled,
                    copyNumberEnabled: this.copyNumberEnabled,
                    structuralVariantEnabled: this.structuralVariantEnabled,
                }
            );
            const byPatient = aggregateMolecularDataByPatient(
                allSamples,
                molecularData.mutations,
                molecularData.cnas,
                molecularData.svs
            );

            const valueMap = new Map<string, string>();
            byPatient.forEach((data, patientId) => {
                valueMap.set(
                    patientId,
                    getGeneAlterationLabel(data, driversAnnotated)
                );
            });
            result.set(entrezGeneId, valueMap);
        });
        return result;
    }

    @computed get embeddingDataGroups(): ColoringMenuOmnibarGroup[] {
        const embeddingDataFields = this.selectedEmbedding?.data
            ? getEmbeddingDataFields(this.selectedEmbedding.data)
            : [];
        if (embeddingDataFields.length === 0) {
            return [];
        }
        return [
            {
                label: 'Map Attributes',
                options: embeddingDataFields.map(attr => ({
                    label: attr.displayName,
                    value: `clinical_${attr.clinicalAttributeId}`,
                    info: {
                        clinicalAttribute: attr,
                    },
                })),
            },
        ];
    }

    @computed get hasExistingURLParameters(): boolean {
        // Check if there are already URL parameters for embeddings coloring selection
        const embeddingsColoringSelection = (this.store as any).urlWrapper
            ?.query?.[this.coloringParamName];
        return !!embeddingsColoringSelection?.selectedOption;
    }

    @computed get genes(): Gene[] {
        // Use allGenes to match PlotsTab pattern exactly
        // This provides comprehensive gene search capability in StudyView
        const genesResult = this.store.allGenes;
        return genesResult.isComplete ? genesResult.result || [] : [];
    }

    // Reactive computed property that applies URL parameter once genes are loaded (for genes) or immediately (for clinical attributes)
    @computed get coloringFromURLParameter():
        | ColoringMenuOmnibarOption
        | undefined {
        // Check if there's a URL parameter for embeddings coloring selection
        const embeddingsColoringSelection = (this.store as any).urlWrapper
            ?.query?.[this.coloringParamName];
        if (embeddingsColoringSelection?.selectedOption) {
            const selectedOption = embeddingsColoringSelection.selectedOption;

            // For gene selections (format: "1956_undefined"), wait for genes to load
            if (selectedOption.match(/^\d+_/)) {
                if (this.genes.length === 0) {
                    return undefined;
                }
            }
            // For clinical attributes (format: "undefined_{...}"), process immediately

            const parsedOption = this.parseColoringSelectionFromURL(
                selectedOption
            );
            if (parsedOption) {
                return parsedOption;
            }
        }

        return undefined;
    }

    // Effective coloring option (URL parameter is applied via reaction to selectedColoringOption)
    @computed get effectiveColoringOption():
        | ColoringMenuOmnibarOption
        | undefined {
        return this.selectedColoringOption;
    }

    private isDefaultColoring(option: ColoringMenuOmnibarOption): boolean {
        // Check if this is the default cancer type coloring
        return (
            option.info?.clinicalAttribute?.clinicalAttributeId ===
                'CANCER_TYPE_DETAILED' || option.info?.entrezGeneId === -10000
        ); // "None" option
    }

    @action.bound
    private applyColoringOption(option: ColoringMenuOmnibarOption) {
        this.selectedColoringOption = option;
    }

    @computed get logScalePossible(): boolean {
        // Log scale not needed for UMAP coordinates
        return false;
    }

    @computed get plotHeight(): number {
        const viewportHeight = this.windowHeight;

        // Bottom axis labels and padding below the plot.
        const bottomPadding = 90;

        // Page chrome above this tab (study header, active filter bar) - the
        // controls render inside the canvas itself, so there's no separate
        // toolbar row above the plot to measure.
        const contentTop = 300;

        // At 4 panels the wrapper lays them out as a 2x2 grid (see
        // EmbeddingsTab.tsx) - two rows share the same vertical budget a
        // single row would otherwise get, so the whole grid fits within the
        // viewport instead of forcing a tall page scroll.
        const rowCount = this.props.panelCount === 4 ? 2 : 1;
        const rowGap = 12;

        const availableHeight =
            viewportHeight -
            contentTop -
            bottomPadding -
            (rowCount - 1) * rowGap;
        const calculatedHeight = availableHeight / rowCount;

        // Minimum height for usability - lower when splitting into rows,
        // since forcing 500px there would defeat the point and force a
        // scroll anyway.
        const minHeight = rowCount > 1 ? 300 : 500;
        return Math.max(minHeight, calculatedHeight);
    }

    @computed get mutationDataExists(): boolean {
        return !!this.store.plotsTabStore.annotatedMutationCache;
    }

    @computed get cnaDataExists(): boolean {
        return !!this.store.plotsTabStore.annotatedCnaCache;
    }

    @computed get svDataExists(): boolean {
        return !!this.store.plotsTabStore.structuralVariantCache;
    }

    @computed get allEmbeddingOptions(): EmbeddingDataOption[] {
        const options: EmbeddingDataOption[] = [];

        // Only return options for data that has been successfully loaded
        if (boehmHeData.isComplete && boehmHeData.result) {
            options.push({
                value: 'msk_mosaic_2026_he',
                label: boehmHeData.result.title,
                data: boehmHeData.result,
            });
        }

        return options;
    }

    @computed get currentStudyIds(): string[] {
        return this.store.queriedPhysicalStudyIds.result || [];
    }

    @computed get embeddingOptions(): EmbeddingDataOption[] {
        // Filter embedding options to show those that support ANY of the current studies
        // (Changed from requiring ALL studies to just needing at least one match)
        if (this.currentStudyIds.length === 0) {
            return [];
        }

        return this.allEmbeddingOptions.filter(option =>
            this.currentStudyIds.some(studyId =>
                option.data.studyIds.includes(studyId)
            )
        );
    }

    @computed get isEmbeddingDataLoading(): boolean {
        return boehmHeData.isPending;
    }

    @computed get hasEmbeddingSupport(): boolean {
        return this.embeddingOptions.length > 0;
    }

    @computed get selectedEmbedding(): EmbeddingDataOption | null {
        const availableOption = this.embeddingOptions.find(
            option => option.value === this.selectedEmbeddingValue
        );

        // If the selected embedding is not available for any of the current studies,
        // fall back to first available option
        if (!availableOption && this.embeddingOptions.length > 0) {
            return this.embeddingOptions[0];
        }

        return availableOption || null;
    }

    @computed get reactSelectEmbeddingOptions() {
        return this.embeddingOptions.map(option => ({
            value: option.value,
            label: option.label,
        }));
    }

    @computed get selectedReactSelectOption() {
        const selected = this.selectedEmbedding;
        return selected
            ? { value: selected.value, label: selected.label }
            : null;
    }

    // Ensure molecular data is loaded for gene-based coloring (similar to PlotsTab pattern)
    readonly molecularDataForColoring = remoteData({
        await: () => {
            const toAwait: any[] = [];

            if (
                this.selectedColoringOption?.info?.entrezGeneId &&
                this.selectedColoringOption.info.entrezGeneId !== -3 // Not "Cancer Type"
            ) {
                const entrezGeneId = this.selectedColoringOption.info
                    .entrezGeneId;
                const queries = [{ entrezGeneId }];

                // Ensure driver annotations are enabled first (reactive dependency)
                const driverAnnotationsReady = this.driverAnnotationsEnabled;

                // CRITICAL FIX: Explicitly wait for OncoKB and Hotspots data to be fully loaded
                // This ensures annotatedMutationCache doesn't use stale driver annotation data
                if (
                    driverAnnotationsReady &&
                    this.store.driverAnnotationSettings
                ) {
                    // Wait for OncoKB annotation data if enabled
                    if (this.store.driverAnnotationSettings.oncoKb) {
                        toAwait.push(
                            this.store.plotsTabStore
                                .oncoKbMutationAnnotationForOncoprint
                        );
                    }

                    // Wait for Hotspots data if enabled
                    if (this.store.driverAnnotationSettings.hotspots) {
                        toAwait.push(
                            this.store.plotsTabStore.isHotspotForOncoprint
                        );
                    }

                    // IMPORTANT: Wait for the driver info function itself - this is the key dependency
                    // The annotatedMutationCache depends on getMutationPutativeDriverInfo, so we need
                    // to ensure it's ready before we allow the cache to be used
                    toAwait.push(
                        this.store.plotsTabStore.getMutationPutativeDriverInfo
                    );
                }

                // CRITICAL: Wait for the annotation dependencies BEFORE accessing mutation cache
                // This ensures that annotatedMutationCache has fresh data computed with proper annotations

                // Add mutation data if enabled
                if (
                    this.mutationTypeEnabled &&
                    this.store.plotsTabStore.annotatedMutationCache
                ) {
                    toAwait.push(
                        ...this.store.plotsTabStore.annotatedMutationCache.getAll(
                            queries
                        )
                    );
                }

                // Add CNA data if enabled
                if (
                    this.copyNumberEnabled &&
                    this.store.plotsTabStore.annotatedCnaCache
                ) {
                    toAwait.push(
                        ...this.store.plotsTabStore.annotatedCnaCache.getAll(
                            queries
                        )
                    );
                }

                // Add structural variant data if enabled
                if (
                    this.structuralVariantEnabled &&
                    this.store.plotsTabStore.structuralVariantCache
                ) {
                    toAwait.push(
                        ...this.store.plotsTabStore.structuralVariantCache.getAll(
                            queries
                        )
                    );
                }
            }

            return toAwait;
        },
        invoke: () => Promise.resolve(true),
    });

    // Shared raw plot data - computed once and cached by MobX
    // Used by plotData, categoryCounts, and categoryColors to avoid redundant computation
    @computed get rawPlotData(): EmbeddingPlotPoint[] {
        if (!this.store.samples.isComplete || !this.selectedEmbedding?.data) {
            return [];
        }

        const isColoringByGene =
            this.selectedColoringOption?.info?.entrezGeneId &&
            this.selectedColoringOption.info.entrezGeneId !== -3; // Not "Cancer Type"

        // Only establish a reactive dependency on the shared, store-level
        // driver annotation settings when this panel's OWN coloring is
        // gene-based. driverAnnotationSettings lives on the store, not
        // per-panel, so an unconditional read here would make every
        // panel's rawPlotData - and so its whole plot - recompute
        // whenever ANY OTHER panel's gene selection flips it, even though
        // driver status has no bearing on a panel colored by something
        // else.
        if (isColoringByGene) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const _ = this.driverAnnotationsEnabled;
        }

        // If we're coloring by a gene, wait for molecular data to be loaded
        if (
            isColoringByGene &&
            (this.mutationTypeEnabled ||
                this.copyNumberEnabled ||
                this.structuralVariantEnabled)
        ) {
            // Depend on the remoteData to ensure proper loading
            if (!this.molecularDataForColoring.isComplete) {
                return [];
            }
        }

        // If we're coloring by a clinical attribute, wait for clinical data to be loaded
        // (skip for embedding data fields which don't use the clinical data cache)
        if (
            this.selectedColoringOption?.info?.clinicalAttribute &&
            !this.selectedColoringOption.info.clinicalAttribute.clinicalAttributeId.startsWith(
                EMBEDDING_DATA_PREFIX
            )
        ) {
            const clinicalDataCacheEntry = this.store.clinicalDataCache.get(
                this.selectedColoringOption.info.clinicalAttribute
            );
            if (!clinicalDataCacheEntry?.isComplete) {
                return [];
            }
        }

        // Call makeEmbeddingScatterPlotData ONCE - this is the expensive operation
        return makeEmbeddingScatterPlotData(
            this.selectedEmbedding.data,
            this.store,
            this.selectedColoringOption,
            this.mutationTypeEnabled,
            this.copyNumberEnabled,
            this.structuralVariantEnabled,
            this.coloringLogScale
        );
    }

    // The sample/patient identity keys this panel's OWN filters currently
    // cover - what actually gets shared across panels (via the
    // constructor's reaction), rather than category names or a lasso
    // point list, so a panel colored by a completely different attribute
    // still filters the same underlying samples. Combines two
    // independent local filters (both narrow further, never widen):
    // hidden legend categories, and a lasso selection (everything OUTSIDE
    // it is also hidden). Mirrors plotData/categoryCounts' own
    // selection-transform (a category can be "Unselected" rather than its
    // original label) so hiding that pseudo-category behaves the same
    // way here too.
    @computed get ownHiddenSampleKeys(): Set<string> {
        const hasCategoryFilter = this.localHiddenCategories.size > 0;
        const hasLassoFilter = this.lassoSelectedKeys !== null;
        if (!hasCategoryFilter && !hasLassoFilter) {
            return new Set<string>();
        }

        const rawPlotData = this.rawPlotData;
        const selectedPatientIds = this.selectedPatientIds;
        const hasSelection = selectedPatientIds.length > 0;
        const selectedPatientSet = new Set(selectedPatientIds);
        const lassoKeys = this.lassoSelectedKeys;

        const keys = new Set<string>();
        rawPlotData.forEach(point => {
            let label = point.displayLabel || '';
            if (hasSelection && point.isInCohort !== false) {
                const hasPatientId = Boolean(point.patientId);
                const isSelected =
                    hasPatientId && selectedPatientSet.has(point.patientId!);
                if (!isSelected) {
                    label = 'Unselected';
                }
            }
            const key = point.sampleId || point.patientId;
            if (!key) {
                return;
            }
            if (hasCategoryFilter && this.localHiddenCategories.has(label)) {
                keys.add(key);
                return;
            }
            if (hasLassoFilter && !lassoKeys!.has(key)) {
                keys.add(key);
            }
        });
        return keys;
    }

    @computed get plotData(): EmbeddingPlotPoint[] {
        // Use the shared rawPlotData computed property (cached by MobX)
        const rawPlotData = this.rawPlotData;

        if (rawPlotData.length === 0) {
            return [];
        }

        // Post-process to handle selection state - update displayLabels for better legend consistency
        const selectedPatientIds = this.selectedPatientIds;
        const hasSelection = selectedPatientIds.length > 0;

        if (!hasSelection) {
            // No selection - just return raw plot data without transformation
            return rawPlotData;
        }
        const selectedPatientSet = new Set(selectedPatientIds);

        let processedData = rawPlotData.map(point => {
            // Skip non-cohort samples
            if (point.isInCohort === false) {
                return point;
            }

            // Check if this point is selected (must have patientId and be in the selected set)
            const hasPatientId = Boolean(point.patientId);
            const isSelected =
                hasPatientId && selectedPatientSet.has(point.patientId!);

            if (!isSelected) {
                // Update ALL unselected in-cohort points to show "Unselected" in legend with light gray color
                return {
                    ...point,
                    displayLabel: 'Unselected',
                    color: '#C8C8C8', // Light gray to match visual rendering
                    strokeColor: '#C8C8C8',
                };
            }

            // Point is selected - return as is
            return point;
        });

        // Filter out hidden points: the main legend's hide/select is a
        // cross-panel filter by underlying sample/patient identity (see
        // hiddenSampleKeys), so it applies even when this panel is colored
        // by something else entirely; QC categories hidden via
        // Configuration are still matched by name and shared as-is.
        const filteredData = processedData.filter(point => {
            const label = point.displayLabel || '';
            const key = point.sampleId || point.patientId || '';
            return (
                !this.hiddenSampleKeysMirror.has(key) &&
                !this.hiddenQcCategoriesMirror.has(label)
            );
        });

        return filteredData;
    }

    // Per-category counts AFTER every active filter (legend hide/select,
    // lasso selection, cross-panel selection) - shown in the legend
    // alongside categoryCounts' raw/unfiltered totals as "visible / total"
    // so a category whose points got filtered out (by this panel's own
    // toggles or another panel's lasso selection) doesn't look unchanged
    // just because its raw total is still the same.
    @computed get visibleCategoryCounts(): Map<string, number> {
        const counts = new Map<string, number>();
        this.plotData.forEach(point => {
            const label = point.displayLabel || '';
            counts.set(label, (counts.get(label) || 0) + 1);
        });
        return counts;
    }

    @computed get categoryCounts(): Map<string, number> {
        // Use the shared rawPlotData computed property (cached by MobX)
        const rawPlotData = this.rawPlotData;

        if (rawPlotData.length === 0) {
            return new Map();
        }

        // Apply the same post-processing logic as plotData but without filtering
        const selectedPatientIds = this.selectedPatientIds;
        const hasSelection = selectedPatientIds.length > 0;

        let processedData;
        if (!hasSelection) {
            // No selection - use raw data without transformation
            processedData = rawPlotData;
        } else {
            const selectedPatientSet = new Set(selectedPatientIds);
            processedData = rawPlotData.map(point => {
                if (point.isInCohort === false) {
                    return point;
                }
                const hasPatientId = Boolean(point.patientId);
                const isSelected =
                    hasPatientId && selectedPatientSet.has(point.patientId!);

                if (!isSelected) {
                    return {
                        ...point,
                        displayLabel: 'Unselected',
                        color: '#C8C8C8',
                        strokeColor: '#C8C8C8',
                    };
                }
                return point;
            });
        }

        // Count all categories including "Unselected" so they appear in the legend
        const counts = new Map<string, number>();
        processedData.forEach(point => {
            const category = point.displayLabel || '';
            counts.set(category, (counts.get(category) || 0) + 1);
        });

        return counts;
    }

    @computed get categoryColors(): Map<
        string,
        { fillColor: string; strokeColor: string; hasStroke: boolean }
    > {
        // Use the shared rawPlotData computed property (cached by MobX)
        const rawPlotData = this.rawPlotData;

        if (rawPlotData.length === 0) {
            return new Map();
        }

        // Apply the same post-processing logic as plotData but without filtering
        const selectedPatientIds = this.selectedPatientIds;
        const hasSelection = selectedPatientIds.length > 0;

        let processedData;
        if (!hasSelection) {
            // No selection - use raw data without transformation
            processedData = rawPlotData;
        } else {
            const selectedPatientSet = new Set(selectedPatientIds);
            processedData = rawPlotData.map(point => {
                if (point.isInCohort === false) {
                    return point;
                }
                const hasPatientId = Boolean(point.patientId);
                const isSelected =
                    hasPatientId && selectedPatientSet.has(point.patientId!);

                if (!isSelected) {
                    return {
                        ...point,
                        displayLabel: 'Unselected',
                        color: '#C8C8C8',
                        strokeColor: '#C8C8C8',
                    };
                }
                return point;
            });
        }

        // Extract color information for each category
        const colors = new Map<
            string,
            { fillColor: string; strokeColor: string; hasStroke: boolean }
        >();
        processedData.forEach(point => {
            if (
                point.displayLabel &&
                point.color &&
                !colors.has(point.displayLabel)
            ) {
                // Determine if this category should have a stroke
                const isSpecialCategory =
                    point.displayLabel === 'Amplification' ||
                    point.displayLabel === 'Deep Deletion' ||
                    point.displayLabel === 'Structural Variant';

                colors.set(point.displayLabel, {
                    fillColor: point.color,
                    strokeColor: point.strokeColor || point.color,
                    hasStroke:
                        isSpecialCategory ||
                        !!(
                            point.strokeColor &&
                            point.strokeColor !== point.color
                        ),
                });
            }
        });

        return colors;
    }

    @computed get isNumericClinicalAttribute(): boolean {
        // Check if the current coloring option is a numeric clinical attribute
        if (this.selectedColoringOption?.info?.clinicalAttribute) {
            return (
                this.selectedColoringOption.info.clinicalAttribute.datatype ===
                'NUMBER'
            );
        }
        return false;
    }

    @computed get numericalValueRange(): [number, number] | undefined {
        // Get the numeric range for the current coloring option
        if (
            this.selectedColoringOption?.info?.clinicalAttribute &&
            this.isNumericClinicalAttribute
        ) {
            // Handle embedding data fields
            const attrId = this.selectedColoringOption.info.clinicalAttribute
                .clinicalAttributeId;
            if (
                attrId.startsWith(EMBEDDING_DATA_PREFIX) &&
                this.selectedEmbedding?.data
            ) {
                const fieldName = attrId.substring(
                    EMBEDDING_DATA_PREFIX.length
                );
                const result = preComputeEmbeddingDataColors(
                    this.selectedEmbedding.data,
                    fieldName,
                    true
                );
                return result.numericalRange;
            }

            // Handle regular clinical attributes
            const clinicalDataCacheEntry = this.store.clinicalDataCache.get(
                this.selectedColoringOption.info.clinicalAttribute
            );

            if (
                clinicalDataCacheEntry.isComplete &&
                clinicalDataCacheEntry.result
            ) {
                return clinicalDataCacheEntry.result.numericalValueRange;
            }
        }
        return undefined;
    }

    @computed get numericalValueToColor(): ((x: number) => string) | undefined {
        // Get the color function for the current numeric coloring option
        if (
            this.selectedColoringOption?.info?.clinicalAttribute &&
            this.isNumericClinicalAttribute
        ) {
            // Handle embedding data fields
            const attrId = this.selectedColoringOption.info.clinicalAttribute
                .clinicalAttributeId;
            if (
                attrId.startsWith(EMBEDDING_DATA_PREFIX) &&
                this.selectedEmbedding?.data
            ) {
                const fieldName = attrId.substring(
                    EMBEDDING_DATA_PREFIX.length
                );
                const result = preComputeEmbeddingDataColors(
                    this.selectedEmbedding.data,
                    fieldName,
                    true
                );
                return result.numericalColorFn;
            }

            // Handle regular clinical attributes
            const clinicalDataCacheEntry = this.store.clinicalDataCache.get(
                this.selectedColoringOption.info.clinicalAttribute
            );

            if (
                clinicalDataCacheEntry.isComplete &&
                clinicalDataCacheEntry.result
            ) {
                if (
                    this.coloringLogScale &&
                    clinicalDataCacheEntry.result.logScaleNumericalValueToColor
                ) {
                    return clinicalDataCacheEntry.result
                        .logScaleNumericalValueToColor;
                }
                return clinicalDataCacheEntry.result.numericalValueToColor;
            }
        }
        return undefined;
    }

    @computed get visibleSampleCount(): number {
        // plotData is already filtered by the shared sample-identity set
        // (see ownHiddenSampleKeys) and by hiddenQcCategories, so counting
        // its points directly stays correct even when a category is only
        // PARTIALLY hidden as a side effect of another panel's filter -
        // something a per-category name count could no longer capture.
        let visibleCount = 0;
        this.plotData.forEach(point => {
            const category = point.displayLabel || '';
            if (
                category !== 'Sample not in this cohort' &&
                category !== 'Case not in this cohort'
            ) {
                visibleCount++;
            }
        });
        return visibleCount;
    }

    @computed get totalSampleCount(): number {
        if (!this.categoryCounts) return 0;
        let total = 0;
        this.categoryCounts.forEach((count, category) => {
            // Exclude samples that are not in this cohort from the total count
            // These samples were used to construct the embedding but are not part of the current study
            if (
                category !== 'Sample not in this cohort' &&
                category !== 'Case not in this cohort'
            ) {
                total += count;
            }
        });
        return total;
    }

    @computed get visibleCategoryCount(): number {
        // This is "how many of THIS panel's own legend rows are enabled",
        // which is about its own toggle state, not the cross-panel sample
        // filter - so it reads localHiddenCategories, not hiddenSampleKeys.
        if (!this.categoryCounts) return 0;
        let visibleCount = 0;
        this.categoryCounts.forEach((count, category) => {
            if (
                !this.localHiddenCategories.has(category) &&
                !this.hiddenQcCategoriesMirror.has(category)
            ) {
                visibleCount++;
            }
        });
        return visibleCount;
    }

    @computed get totalCategoryCount(): number {
        return this.categoryCounts?.size || 0;
    }

    @computed get shouldShowControls(): boolean {
        // Check if there are URL parameters for embeddings coloring selection
        const hasUrlParams = (this.store as any).urlWrapper?.query?.[
            this.coloringParamName
        ]?.selectedOption;

        if (hasUrlParams) {
            // For gene selections (format: "1956_undefined"), wait for genes to load
            if (hasUrlParams.match(/^\d+_/)) {
                return this.genes.length > 0;
            }
            // For clinical attributes (format: "undefined_{...}"), show immediately
            return true;
        } else {
            // No URL params, show controls immediately
            return true;
        }
    }

    @computed get selectedPatientIds(): string[] {
        return this.store.selectedPatients?.map((p: any) => p.patientId) || [];
    }

    @computed get driverAnnotationsEnabled(): boolean {
        // Pure computed property - no side effects
        // The reaction in the constructor handles enabling driver annotations when needed
        if (this.store.driverAnnotationSettings) {
            return this.store.driverAnnotationSettings.driversAnnotated;
        }
        return false;
    }

    @action.bound
    private enableDriverAnnotations() {
        if (this.store.driverAnnotationSettings) {
            this.store.driverAnnotationSettings.oncoKb = true;
            this.store.driverAnnotationSettings.hotspots = true;
            this.store.driverAnnotationSettings.customBinary = true;
            this.store.driverAnnotationSettings.includeDriver = true;
            this.store.driverAnnotationSettings.includeVUS = true;
        }
    }

    @computed get isLoading(): boolean {
        // Check if embedding data is still loading
        if (boehmHeData.isPending) {
            return true;
        }

        if (
            !this.store.samples.isComplete ||
            !this.store.selectedSamples.isComplete
        ) {
            return true;
        }

        if (
            this.selectedColoringOption?.info?.clinicalAttribute &&
            !this.selectedColoringOption.info.clinicalAttribute.clinicalAttributeId.startsWith(
                EMBEDDING_DATA_PREFIX
            )
        ) {
            const cacheEntry = this.store.clinicalDataCache.get(
                this.selectedColoringOption.info.clinicalAttribute
            );
            if (!cacheEntry.isComplete) {
                return true;
            }
        }

        // Check molecular data loading to prevent flickering
        if (
            this.selectedColoringOption?.info?.entrezGeneId &&
            this.selectedColoringOption.info.entrezGeneId !== -3 &&
            (this.mutationTypeEnabled ||
                this.copyNumberEnabled ||
                this.structuralVariantEnabled) &&
            !this.molecularDataForColoring.isComplete
        ) {
            return true;
        }

        return false;
    }

    @action.bound
    private onColoringSelectionChange(option?: ColoringMenuOmnibarOption) {
        this.selectedColoringOption = option;
        this.syncColoringSelectionToURL(option);
    }

    private syncColoringSelectionToURL(option?: ColoringMenuOmnibarOption) {
        const urlWrapper = (this.store as any).urlWrapper;
        if (!urlWrapper) {
            return;
        }

        try {
            if (
                option?.info?.entrezGeneId &&
                option.info.entrezGeneId !== -10000 &&
                option.info.entrezGeneId !== -3
            ) {
                // Gene coloring selection
                const selectedOption = `${option.info.entrezGeneId}_undefined`;

                urlWrapper.updateURL({
                    [this.coloringParamName]: {
                        selectedOption: selectedOption,
                        colorByMutationType: this.mutationTypeEnabled
                            ? 'true'
                            : 'false',
                        colorByCopyNumber: this.copyNumberEnabled
                            ? 'true'
                            : 'false',
                        colorBySv: this.structuralVariantEnabled
                            ? 'true'
                            : 'false',
                    },
                });
            } else if (option?.info?.clinicalAttribute) {
                // Clinical attribute coloring selection
                // Follow PlotsTab's encoding format exactly
                const clinicalInfo = {
                    clinicalAttributeId:
                        option.info.clinicalAttribute.clinicalAttributeId,
                    patientAttribute:
                        option.info.clinicalAttribute.patientAttribute || false,
                    studyId: this.currentStudyIds[0] || '', // Use first study ID
                };
                const selectedOption = `undefined_${JSON.stringify(
                    clinicalInfo
                )}`;

                urlWrapper.updateURL({
                    [this.coloringParamName]: {
                        selectedOption: selectedOption,
                        colorByMutationType: this.mutationTypeEnabled
                            ? 'true'
                            : 'false',
                        colorByCopyNumber: this.copyNumberEnabled
                            ? 'true'
                            : 'false',
                        colorBySv: this.structuralVariantEnabled
                            ? 'true'
                            : 'false',
                    },
                });
            } else {
                // Clear coloring selection (e.g., for "None" option)
                urlWrapper.updateURL({
                    [this.coloringParamName]: undefined,
                });
            }
        } catch (e) {
            // Error syncing coloring selection to URL
        }
    }

    @action.bound
    private onLogScaleChange(enabled: boolean) {
        this.coloringLogScale = enabled;
    }

    @action.bound
    private onMutationTypeToggle(enabled: boolean) {
        this.mutationTypeEnabled = enabled;
    }

    @action.bound
    private onCopyNumberToggle(enabled: boolean) {
        this.copyNumberEnabled = enabled;
    }

    @action.bound
    private onStructuralVariantToggle(enabled: boolean) {
        this.structuralVariantEnabled = enabled;
    }

    // Public (not private) - called directly from EmbeddingsTab's top bar
    // when this is the only panel (see its single-panel Map dropdown),
    // via a ref, the same way applyFilterGlobally is.
    @action.bound
    onEmbeddingChange(selectedOption: { value: string; label: string } | null) {
        if (selectedOption) {
            const embeddingOption = this.embeddingOptions.find(
                option => option.value === selectedOption.value
            );
            if (embeddingOption) {
                this.selectedEmbeddingValue = selectedOption.value;
                // Reset view state when embedding type changes
                this.centerView(); // Use the action method
                // Mark as initialized after manual embedding change
                this.viewStateInitialized = true;

                const urlWrapper = (this.store as any).urlWrapper;
                if (urlWrapper) {
                    urlWrapper.updateURL({
                        [this.mapParamName]: selectedOption.value,
                    });
                }
            }
        }
    }

    @action.bound
    private setViewState(newViewState: ViewState) {
        this.viewState = newViewState;
        // While locked, every panel (not just one designated "primary")
        // both drives and follows the shared view - panning/zooming any
        // one of them broadcasts to the rest via the same holder they all
        // poll (see startLockPolling).
        if (this.props.isLockedToPrimary) {
            this.props.onPrimaryViewStateChange(newViewState);
        }
    }

    @action.bound
    private onViewStateChange(newViewState: ViewState) {
        this.setViewState(newViewState);
    }

    @action.bound
    private centerView() {
        if (this.plotData && this.plotData.length > 0) {
            const bounds = calculateDataBounds(
                this.plotData as EmbeddingPoint[]
            );
            this.setViewState({
                target: [bounds.centerX, bounds.centerY, 0],
                zoom: bounds.zoom,
                minZoom: -5,
                maxZoom: 10,
            });
        }
    }

    @action.bound
    private pinPoint(point: EmbeddingPoint) {
        this.pinnedPoint = point;
    }

    @action.bound
    private unpinPoint() {
        this.pinnedPoint = null;
    }

    @action.bound
    private onLegendCollapsedChange(collapsed: boolean) {
        this.legendCollapsed = collapsed;

        const urlWrapper = (this.store as any).urlWrapper;
        if (urlWrapper) {
            urlWrapper.updateURL({
                [this.legendCollapsedParamName]: collapsed ? 'true' : undefined,
            });
        }
    }

    @action.bound
    private toggleCategoryVisibility(category: string) {
        const next = new Set(this.localHiddenCategories);
        if (next.has(category)) {
            next.delete(category);
        } else {
            next.add(category);
        }
        this.localHiddenCategories = next;
    }

    @action.bound
    private toggleAllCategories() {
        // QC categories are tracked separately via hiddenQcCategories, but
        // keep this exclusion as a defensive safety net. Writing to
        // localHiddenCategories (not a shared set) is enough - the
        // constructor's reaction derives the underlying sample keys from
        // it and pushes those up, which is what actually applies
        // everywhere (see ownHiddenSampleKeys).
        const embeddingConfigCategories = [
            'Sample not in this cohort',
            'Case not in this cohort',
        ];

        if (this.localHiddenCategories.size === 0) {
            const toHide = new Set<string>();
            if (this.categoryCounts) {
                this.categoryCounts.forEach((count, category) => {
                    if (!embeddingConfigCategories.includes(category)) {
                        toHide.add(category);
                    }
                });
            }
            this.localHiddenCategories = toHide;
        } else {
            const keepHidden = new Set<string>();
            this.localHiddenCategories.forEach(category => {
                if (embeddingConfigCategories.includes(category)) {
                    keepHidden.add(category);
                }
            });
            this.localHiddenCategories = keepHidden;
        }
    }

    // Public (not private) - called via a ref from EmbeddingsTab's "Make
    // Global" status bar button, so the currently-visible embedding
    // selection (whichever panel's legend filter, lasso selection, or
    // combination of several is driving it) can be applied as a real
    // Study View selection, filtering every other chart on the page.
    // plotData is already filtered down to exactly the visible points by
    // the shared hiddenSampleKeys/hiddenQcCategories, so this reads
    // straight from it. Returns whether a selection was actually applied -
    // the wrapper only resets the legend/lasso filters that produced it
    // when this is true, so a no-op (e.g. Hide All left nothing visible)
    // doesn't silently discard the user's filter state for nothing.
    @action.bound
    applyFilterGlobally(): boolean {
        if (this.plotData.length === 0 || !this.selectedEmbedding) {
            return false;
        }

        const selectedPoints = this.plotData;
        const allSamples = this.store.samples.result || [];
        const embeddingType = this.selectedEmbedding.data.embedding_type;

        if (embeddingType === 'samples') {
            // Sample-level embedding: select specific samples
            const selectedSampleIds = new Set(
                selectedPoints.map(p => p.sampleId).filter(Boolean)
            );

            const samplesForSelection = allSamples.filter(sample =>
                selectedSampleIds.has(sample.sampleId)
            );

            const customChartData = {
                origin: [this.selectedEmbedding.label],
                displayName: `${this.selectedEmbedding.label} Sample Selection`,
                description: `Samples selected from ${this.selectedEmbedding.label} embedding`,
                datatype: 'STRING',
                patientAttribute: false, // Sample-level selection
                priority: 1,
                data: samplesForSelection.map(sample => ({
                    studyId: sample.studyId,
                    patientId: sample.patientId,
                    sampleId: sample.sampleId,
                    value: 'Selected',
                })),
            };

            this.store.updateCustomSelect(customChartData);
        } else {
            // Patient-level embedding: select all samples from selected patients
            const selectedPatientSet = new Set(
                selectedPoints.map(p => p.patientId).filter(Boolean)
            );

            const samplesForSelectedPatients = allSamples.filter(sample =>
                selectedPatientSet.has(sample.patientId)
            );

            const customChartData = {
                origin: [this.selectedEmbedding.label],
                displayName: `${this.selectedEmbedding.label} Patient Selection`,
                description: `Patients selected from ${this.selectedEmbedding.label} embedding`,
                datatype: 'STRING',
                patientAttribute: true, // Patient-level selection
                priority: 1,
                data: samplesForSelectedPatients.map(sample => ({
                    studyId: sample.studyId,
                    patientId: sample.patientId,
                    sampleId: sample.sampleId,
                    value: 'Selected',
                })),
            };

            this.store.updateCustomSelect(customChartData);
        }
        return true;
    }

    // A lasso selection no longer applies globally right away - like a
    // legend hide/select, it just becomes a local filter (see
    // lassoSelectedKeys, folded into ownHiddenSampleKeys below), shown in
    // the shared status bar. The user explicitly clicks "Make Global" to
    // apply it as a real Study View selection via applyFilterGlobally.
    @action.bound
    private handlePointSelection(selectedPoints: any[]) {
        if (!selectedPoints || selectedPoints.length === 0) {
            return;
        }
        const keys = new Set<string>();
        selectedPoints.forEach(p => {
            const key = p.sampleId || p.patientId;
            if (key) {
                keys.add(key);
            }
        });
        this.lassoSelectedKeys = keys;
    }

    // A plain method, not @computed: its renderControls callback reads
    // props (like isLockedToPrimary) and store-derived values that a
    // cached computed wouldn't reliably see change - a computed only
    // recomputes when ITS OWN synchronous execution touches a changed
    // MobX observable, and prop reads (and reads deferred into a
    // lazily-invoked callback) don't count, so a cached version of this
    // could silently keep returning stale controls. Called directly from
    // render(), which already re-runs on every relevant prop/observable
    // change via React + the @observer reaction, so nothing here needs
    // its own memoization.
    private renderPlotComponent(): JSX.Element {
        if (this.isLoading) {
            return (
                <div
                    style={{
                        width: '100%',
                        height: `${this.plotHeight}px`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <LoadingIndicator
                        isLoading={true}
                        center={true}
                        size={'big'}
                    />
                </div>
            );
        }

        if (!this.selectedEmbedding) {
            return (
                <div
                    style={{
                        width: '100%',
                        height: `${this.plotHeight}px`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <p>No embedding selected</p>
                </div>
            );
        }

        const patientData = this.plotData;
        const visualizationProps = {
            data: patientData,
            title: `${this.selectedEmbedding.label} Embedding - ${this.selectedEmbedding.data.title}`,
            xAxisLabel: `${this.selectedEmbedding.label} 1`,
            yAxisLabel: `${this.selectedEmbedding.label} 2`,
            height: this.plotHeight,
            showLegend: true,
            filename: `${this.selectedEmbedding.value}_embedding`,
            viewState: this.viewState,
            onViewStateChange: this.onViewStateChange,
            onPointSelection: this.handlePointSelection,
            selectedPatientIds: this.selectedPatientIds,
            embeddingType: this.selectedEmbedding.data.embedding_type,
            categoryCounts: this.categoryCounts,
            visibleCategoryCounts: this.visibleCategoryCounts,
            categoryColors: this.categoryColors,
            hiddenCategories: this.localHiddenCategories,
            onToggleCategoryVisibility: this.toggleCategoryVisibility,
            onToggleAllCategories: this.toggleAllCategories,
            hiddenQcCategories: this.props.hiddenQcCategories,
            onToggleQcCategoryVisibility: this.props
                .onToggleQcCategoryVisibility,
            showLegendHeaderAndConfiguration: this.props.panelIndex === 1,
            isFilterActive: this.props.hiddenSampleKeys.size > 0,
            legendCollapsed: this.legendCollapsed,
            onLegendCollapsedChange: this.onLegendCollapsedChange,
            visibleSampleCount: this.visibleSampleCount,
            totalSampleCount: this.totalSampleCount,
            visibleCategoryCount: this.visibleCategoryCount,
            totalCategoryCount: this.totalCategoryCount,
            isNumericAttribute: this.isNumericClinicalAttribute,
            numericalValueRange: this.numericalValueRange,
            numericalValueToColor: this.numericalValueToColor,
            pinnedPoint: this.pinnedPoint,
            onPinPoint: this.pinPoint,
            onUnpinPoint: this.unpinPoint,
            selectedTooltipFields: new Set(this.props.tooltipFields), //Clone to ensure prop identity changes and the tooltip re-renders reliably
            colorByLabel: this.effectiveColoringOption?.label,
            // Shared with every other panel, so Pan/Select applies to all.
            selectionMode: this.props.selectionMode,
            onSelectionModeChange: this.props.onSelectionModeChange,
            tooltipFieldOptions: this.tooltipFieldOptions,
            clinicalAttributeValueMaps: this.tooltipClinicalAttributeValueMaps,
            mapAttributeValueMaps: this.tooltipMapAttributeValueMaps,
            geneValueMaps: this.tooltipGeneValueMaps,
            renderControls: (childControls: {
                selectionMode: 'none' | 'lasso';
                onSelectionModeChange: (mode: 'none' | 'lasso') => void;
            }) => (
                <EmbeddingControlStack
                    mapOptions={this.reactSelectEmbeddingOptions}
                    selectedMapOption={this.selectedReactSelectOption}
                    onMapChange={this.onEmbeddingChange}
                    showMapColorTooltipControls={this.shouldShowControls}
                    showMapInControlStack={this.props.panelCount > 1}
                    genes={this.genes}
                    clinicalAttributes={this.clinicalAttributes}
                    additionalGroups={this.embeddingDataGroups}
                    selectedColoringOption={this.effectiveColoringOption}
                    logScale={this.coloringLogScale}
                    logScalePossible={this.logScalePossible}
                    isLoading={this.isLoading}
                    mutationDataExists={this.mutationDataExists}
                    cnaDataExists={this.cnaDataExists}
                    svDataExists={this.svDataExists}
                    mutationTypeEnabled={this.mutationTypeEnabled}
                    copyNumberEnabled={this.copyNumberEnabled}
                    structuralVariantEnabled={this.structuralVariantEnabled}
                    onColoringSelectionChange={this.onColoringSelectionChange}
                    onLogScaleChange={this.onLogScaleChange}
                    onMutationTypeToggle={this.onMutationTypeToggle}
                    onCopyNumberToggle={this.onCopyNumberToggle}
                    onStructuralVariantToggle={this.onStructuralVariantToggle}
                    tooltipFieldGroups={this.tooltipFieldGroups}
                    selectedTooltipFields={this.props.tooltipFields}
                    onTooltipFieldsChange={this.props.onTooltipFieldsChange}
                    onCenter={this.centerView}
                    isLockedToPrimary={this.props.isLockedToPrimary}
                    onToggleLockedToPrimary={this.props.onToggleLockedToPrimary}
                    panelIndex={this.props.panelIndex}
                    panelCount={this.props.panelCount}
                    onSetPanelCount={this.props.onSetPanelCount}
                />
            ),
        };

        return (
            <div style={{ width: '100%' }} data-test="embeddings-visualization">
                <EmbeddingDeckGLVisualization {...visualizationProps} />
            </div>
        );
    }

    render() {
        // Safety check for study ID access
        if (this.currentStudyIds.length === 0) {
            return (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                    <h4>Embeddings Visualization</h4>
                    <p>Loading study information...</p>
                </div>
            );
        }

        // Show loading while embedding data is being fetched
        if (this.isEmbeddingDataLoading) {
            return <LoadingIndicator isLoading={true} />;
        }

        // Only show "not available" message if data is loaded but not for this study
        if (!this.hasEmbeddingSupport) {
            const studyText =
                this.currentStudyIds.length === 1
                    ? `Current study: ${this.currentStudyIds[0]}`
                    : `Current studies: ${this.currentStudyIds.join(', ')}`;

            return (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                    <h4>Embeddings Visualization</h4>
                    <p>
                        Embeddings are not available for any of{' '}
                        {this.currentStudyIds.length === 1
                            ? 'this study'
                            : 'these studies'}
                        .
                    </p>
                    <p>
                        <strong>{studyText}</strong>
                    </p>
                </div>
            );
        }

        return (
            <div className="embeddings-tab">
                {/* Plot */}
                {this.renderPlotComponent()}
            </div>
        );
    }
}
