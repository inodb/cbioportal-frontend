import * as React from 'react';
import { observer } from 'mobx-react';
import { observable, action, makeObservable } from 'mobx';
import { StudyViewPageStore } from 'pages/studyView/StudyViewPageStore';
import { ViewState } from 'shared/components/embeddings/EmbeddingTypes';
import { EmbeddingsPanel } from './EmbeddingsPanel';

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
    // Each mounted panel registers its own PNG-export function here (keyed
    // by panelIndex) so the primary panel's single "Export PNG" button can
    // export every panel at once. Plain, non-reactive - exporting is a
    // one-off action, not something that needs to trigger a re-render.
    private readonly panelExportFns: Map<number, () => void> = new Map();
    // Single toggle, shown only on the primary panel: when on, every
    // non-primary panel follows the primary panel's pan/zoom instead of
    // moving independently.
    @observable private sharedLockToPrimary = false;

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

    // Deliberately NOT MobX actions - plain registry bookkeeping and a
    // one-off side effect (triggering downloads), not observable state.
    private readonly registerPanelExport = (
        panelIndex: number,
        exportFn: (() => void) | null
    ) => {
        if (exportFn) {
            this.panelExportFns.set(panelIndex, exportFn);
        } else {
            this.panelExportFns.delete(panelIndex);
        }
    };

    private readonly exportAllPanels = () => {
        const indexes = Array.from(this.panelExportFns.keys()).sort(
            (a, b) => a - b
        );
        // Stagger slightly - firing several download links in the same
        // tick can cause a browser to drop all but the first.
        indexes.forEach((panelIndex, i) => {
            const exportFn = this.panelExportFns.get(panelIndex);
            if (exportFn) {
                setTimeout(() => exportFn(), i * 200);
            }
        });
    };

    @action.bound
    private onToggleLockToPrimary() {
        this.sharedLockToPrimary = !this.sharedLockToPrimary;
    }

    @action.bound
    private onToggleQcCategoryVisibility(category: string) {
        if (this.sharedHiddenQcCategories.has(category)) {
            this.sharedHiddenQcCategories.delete(category);
        } else {
            this.sharedHiddenQcCategories.add(category);
        }
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

    render() {
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
                            primaryViewStateHolder={this.primaryViewStateHolder}
                            onPrimaryViewStateChange={this.setPrimaryViewState}
                            onRegisterExport={this.registerPanelExport}
                            onExportAll={this.exportAllPanels}
                            isLockedToPrimary={this.sharedLockToPrimary}
                            onToggleLockedToPrimary={this.onToggleLockToPrimary}
                            onSetPanelCount={target =>
                                this.onSetPanelCount(target, panelIndex)
                            }
                        />
                    </div>
                ))}
            </div>
        );
    }
}
