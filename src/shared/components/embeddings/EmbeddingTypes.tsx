/**
 * Common types and interfaces for embedding visualizations
 */

interface BaseEmbeddingData {
    studyIds: string[];
    title: string;
    description: string;
    totalPatients: number;
    sampleSize: number;
    embedding_type: 'patients' | 'samples';
}

export interface PatientEmbeddingData extends BaseEmbeddingData {
    embedding_type: 'patients';
    data: {
        patientId: string;
        x: number;
        y: number;
        data?: Record<string, any>;
    }[];
}

export interface SampleEmbeddingData extends BaseEmbeddingData {
    embedding_type: 'samples';
    data: {
        sampleId: string;
        x: number;
        y: number;
        data?: Record<string, any>;
    }[];
}

export type EmbeddingData = PatientEmbeddingData | SampleEmbeddingData;

export interface EmbeddingDataOption {
    value: string;
    label: string;
    data: EmbeddingData;
}

export interface EmbeddingPoint {
    x: number;
    y: number;
    patientId?: string;
    sampleId?: string;
    uniqueSampleKey?: string;
    color?: string;
    strokeColor?: string;
    displayLabel?: string;
    isInCohort?: boolean;
    [key: string]: any; // Allow additional properties for extensibility
}

export interface ViewState {
    target: [number, number, number];
    zoom: number;
    minZoom: number;
    maxZoom: number;
}

export interface EmbeddingVisualizationProps {
    data: EmbeddingPoint[];
    title?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    width?: number;
    height?: number;
    onPointSelection?: (selectedPoints: EmbeddingPoint[]) => void;
    selectedPatientIds?: string[];
    showLegend?: boolean;
    filename?: string;
    viewState?: ViewState;
    onViewStateChange?: (viewState: ViewState) => void;
    embeddingType?: 'patients' | 'samples';
    categoryCounts?: Map<string, number>;
    // Shown alongside categoryCounts as "visible / total".
    visibleCategoryCounts?: Map<string, number>;
    categoryColors?: Map<
        string,
        { fillColor: string; strokeColor: string; hasStroke: boolean }
    >;
    hiddenCategories?: Set<string>;
    onToggleCategoryVisibility?: (category: string) => void;
    onToggleAllCategories?: () => void;
    // Shared across every split-view panel, unlike hiddenCategories.
    hiddenQcCategories?: Set<string>;
    onToggleQcCategoryVisibility?: (category: string) => void;
    // Only the primary panel shows the Configuration section, to save
    // space.
    showLegendHeaderAndConfiguration?: boolean;
    // Synced to the URL by the panel, so it survives reload/sharing.
    legendCollapsed?: boolean;
    onLegendCollapsedChange?: (collapsed: boolean) => void;
    visibleSampleCount?: number;
    totalSampleCount?: number;
    visibleCategoryCount?: number;
    totalCategoryCount?: number;
    // Colored border cue when a cross-panel sample filter is active.
    isFilterActive?: boolean;
    isNumericAttribute?: boolean;
    numericalValueRange?: [number, number];
    numericalValueToColor?: (x: number) => string;
    pinnedPoint?: EmbeddingPoint | null;
    onPinPoint?: (point: EmbeddingPoint) => void;
    onUnpinPoint?: () => void;
    selectedTooltipFields?: Set<string>;
    colorByLabel?: string;
    tooltipFieldOptions?: { value: string; label: string }[];
    clinicalAttributeValueMaps?: Map<string, Map<string, string>>;
    mapAttributeValueMaps?: Map<string, Map<string, string>>;
    geneValueMaps?: Map<number, Map<string, string>>;
    // Controlled pan/lasso-select mode, shared across mounted panels when
    // supplied. Omit to keep the mode purely local to this instance.
    selectionMode?: 'none' | 'lasso';
    onSelectionModeChange?: (mode: 'none' | 'lasso') => void;
    // Lets the parent supply the top-left control cluster's markup while
    // export/pan-select mechanics stay owned by
    // EmbeddingDeckGLVisualization. Falls back to the default
    // ToolbarControls/SelectionControls when omitted.
    renderControls?: (childControls: {
        onExport: () => void;
        selectionMode: 'none' | 'lasso';
        onSelectionModeChange: (mode: 'none' | 'lasso') => void;
    }) => React.ReactNode;
}

export interface EmbeddingControlsProps {
    embeddingOptions: EmbeddingDataOption[];
    selectedEmbedding: string;
    onEmbeddingChange: (value: string) => void;
    coloringComponent?: React.ReactNode;
}
