import * as React from 'react';
import Select from 'react-select';
import ColorSamplesByDropdown from 'shared/components/colorSamplesByDropdown/ColorSamplesByDropdown';
import {
    ColoringMenuOmnibarOption,
    ColoringMenuOmnibarGroup,
} from 'shared/components/plots/PlotsTabTypes';
import { Gene, ClinicalAttribute } from 'cbioportal-ts-api-client';
import { TooltipDropdown } from 'shared/components/embeddings/controls/TooltipDropdown';

export interface EmbeddingControlStackProps {
    // Map
    mapOptions: { value: string; label: string }[];
    selectedMapOption: { value: string; label: string } | null;
    onMapChange: (option: { value: string; label: string } | null) => void;

    // Whether the Map/Color by/Tooltip fields controls should render at all
    // (gated by the panel while it's waiting on data needed to resolve a
    // URL-driven selection, to avoid flashing the wrong default).
    showMapColorTooltipControls: boolean;
    // Suppresses just the Map dropdown here - EmbeddingsTab renders it in
    // its own top bar instead when this is the only panel (each Map only
    // makes sense to pick per-panel once there's more than one).
    // Defaults to true (shown) so multi-panel callers don't need to think
    // about it.
    showMapInControlStack?: boolean;

    // Color by
    genes: Gene[];
    clinicalAttributes: ClinicalAttribute[];
    additionalGroups?: ColoringMenuOmnibarGroup[];
    selectedColoringOption?: ColoringMenuOmnibarOption;
    logScale: boolean;
    logScalePossible: boolean;
    isLoading: boolean;
    mutationDataExists: boolean;
    cnaDataExists: boolean;
    svDataExists: boolean;
    mutationTypeEnabled: boolean;
    copyNumberEnabled: boolean;
    structuralVariantEnabled: boolean;
    onColoringSelectionChange: (option?: ColoringMenuOmnibarOption) => void;
    onLogScaleChange: (enabled: boolean) => void;
    onMutationTypeToggle: (enabled: boolean) => void;
    onCopyNumberToggle: (enabled: boolean) => void;
    onStructuralVariantToggle: (enabled: boolean) => void;

    // Tooltip fields
    tooltipFieldGroups: {
        label: string;
        options: { value: string; label: string }[];
    }[];
    selectedTooltipFields: Set<string>;
    onTooltipFieldsChange: (fields: Set<string>) => void;

    // Center (Pan/Select now lives in EmbeddingsTab's top bar, not here)
    onCenter: () => void;
    // Shared toggle, shown only on the primary panel: when on, every
    // non-primary panel follows the primary panel's pan/zoom instead of
    // moving independently.
    isLockedToPrimary: boolean;
    onToggleLockedToPrimary: () => void;

    // Panel count
    panelIndex: number;
    panelCount: number;
    onSetPanelCount: (target: number) => void;
}

const BOX_STYLE: React.CSSProperties = {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid #ccc',
    borderRadius: '4px',
};

const ROW_LABEL_STYLE: React.CSSProperties = {
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    color: '#888',
    lineHeight: '12px',
};

// Bordered, compact react-select look shared by Map/Color by/Tooltip - each
// is its own self-contained dropdown (no wrapping card, no separate popover
// fanning out beside it - clicking one opens its menu directly below, same
// as any other <select>).
const SELECT_STYLES = {
    control: (base: any) => ({
        ...base,
        fontSize: '12px',
        minHeight: '32px',
        boxShadow: 'none',
        border: '1px solid #ccc',
    }),
    menu: (base: any) => ({ ...base, fontSize: '12px', zIndex: 9999 }),
    container: (base: any) => ({ ...base, width: '100%' }),
    multiValue: (base: any) => ({ ...base, fontSize: '11px' }),
};

export const EmbeddingControlStack: React.FC<EmbeddingControlStackProps> = ({
    mapOptions,
    selectedMapOption,
    onMapChange,
    showMapColorTooltipControls,
    showMapInControlStack = true,
    genes,
    clinicalAttributes,
    additionalGroups,
    selectedColoringOption,
    logScale,
    logScalePossible,
    isLoading,
    mutationDataExists,
    cnaDataExists,
    svDataExists,
    mutationTypeEnabled,
    copyNumberEnabled,
    structuralVariantEnabled,
    onColoringSelectionChange,
    onLogScaleChange,
    onMutationTypeToggle,
    onCopyNumberToggle,
    onStructuralVariantToggle,
    tooltipFieldGroups,
    selectedTooltipFields,
    onTooltipFieldsChange,
    onCenter,
    isLockedToPrimary,
    onToggleLockedToPrimary,
    panelIndex,
    panelCount,
    onSetPanelCount,
}) => {
    // Pan/Select, tooltip fields, panel count, and export are all either
    // shared across every panel or only make sense once - so only the
    // first panel shows them; the rest keep just Map/Color by/Center.
    const isPrimaryPanel = panelIndex === 1;

    return (
        <div
            style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontFamily: 'inherit',
            }}
        >
            {showMapColorTooltipControls && showMapInControlStack && (
                <div style={{ width: '190px' }}>
                    <span style={ROW_LABEL_STYLE}>Map</span>
                    <Select
                        name="embedding-select"
                        value={selectedMapOption}
                        onChange={(option: any) => onMapChange(option)}
                        options={mapOptions}
                        isSearchable={false}
                        styles={SELECT_STYLES}
                    />
                </div>
            )}

            {showMapColorTooltipControls && (
                <div style={{ width: '190px' }}>
                    <span style={ROW_LABEL_STYLE}>Color by</span>
                    <ColorSamplesByDropdown
                        genes={genes}
                        clinicalAttributes={clinicalAttributes}
                        additionalGroups={additionalGroups}
                        selectedOption={selectedColoringOption}
                        logScale={logScale}
                        hasNoQueriedGenes={true}
                        logScalePossible={logScalePossible}
                        isLoading={isLoading}
                        mutationDataExists={mutationDataExists}
                        cnaDataExists={cnaDataExists}
                        svDataExists={svDataExists}
                        mutationTypeEnabled={mutationTypeEnabled}
                        copyNumberEnabled={copyNumberEnabled}
                        structuralVariantEnabled={structuralVariantEnabled}
                        stacked
                        onSelectionChange={onColoringSelectionChange}
                        onLogScaleChange={onLogScaleChange}
                        onMutationTypeToggle={onMutationTypeToggle}
                        onCopyNumberToggle={onCopyNumberToggle}
                        onStructuralVariantToggle={onStructuralVariantToggle}
                        hideLabel
                        selectStyles={SELECT_STYLES}
                    />
                </div>
            )}

            {showMapColorTooltipControls && isPrimaryPanel && (
                <div style={{ width: '190px' }}>
                    <span style={ROW_LABEL_STYLE}>Tooltip</span>
                    <TooltipDropdown
                        selectedFields={selectedTooltipFields}
                        onSelectionChange={onTooltipFieldsChange}
                        options={tooltipFieldGroups}
                        hideLabel
                        selectStyles={SELECT_STYLES}
                    />
                </div>
            )}

            {isPrimaryPanel && (
                <div>
                    <span style={{ ...ROW_LABEL_STYLE, paddingLeft: '2px' }}>
                        Viewport
                    </span>
                    <button
                        onClick={onCenter}
                        style={{
                            ...BOX_STYLE,
                            display: 'block',
                            width: '100%',
                            marginTop: '2px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            cursor: 'pointer',
                        }}
                    >
                        Center
                    </button>
                </div>
            )}

            {isPrimaryPanel && (
                <div>
                    <span style={{ ...ROW_LABEL_STYLE, paddingLeft: '2px' }}>
                        Panels
                    </span>
                    <div
                        style={{
                            display: 'flex',
                            gap: '2px',
                            ...BOX_STYLE,
                            padding: '2px',
                            marginTop: '2px',
                        }}
                    >
                        {[1, 2, 3, 4].map(n => (
                            <button
                                key={n}
                                onClick={() => onSetPanelCount(n)}
                                title={`Show ${n} map${n > 1 ? 's' : ''}`}
                                style={{
                                    flex: 1,
                                    padding: '4px 0',
                                    fontSize: '11px',
                                    border: 'none',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    backgroundColor:
                                        panelCount === n
                                            ? '#007bff'
                                            : 'transparent',
                                    color: panelCount === n ? 'white' : '#333',
                                }}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                    {panelCount > 1 && (
                        <button
                            onClick={onToggleLockedToPrimary}
                            title="Lock every other panel's pan/zoom to this one"
                            style={{
                                ...BOX_STYLE,
                                display: 'block',
                                width: '100%',
                                marginTop: '2px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                backgroundColor: isLockedToPrimary
                                    ? '#007bff'
                                    : 'rgba(255, 255, 255, 0.95)',
                                color: isLockedToPrimary ? 'white' : '#333',
                                border: isLockedToPrimary
                                    ? '1px solid #007bff'
                                    : '1px solid #ccc',
                            }}
                        >
                            Lock panel viewports
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
