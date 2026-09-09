import * as React from 'react';
import { EmbeddingPoint } from '../EmbeddingTypes';
import FontAwesome from 'react-fontawesome';

// Helper function to format numbers with commas
const formatCount = (count: number): string => {
    return count.toLocaleString();
};

// Helper function to render a legend item
// Helper function to check if a category should be rendered as unfilled (transparent with border)
const isUnfilledCategory = (displayLabel: string): boolean => {
    return (
        displayLabel === 'Amplification' ||
        displayLabel === 'Deep Deletion' ||
        displayLabel === 'Structural Variant'
    );
};

// Helper function to check if a category is a VUS mutation
const isVUSCategory = (displayLabel: string): boolean => {
    return displayLabel.endsWith('(VUS)');
};

// Import required constants for VUS coloring
import {
    MUT_COLOR_MISSENSE_PASSENGER,
    MUT_COLOR_INFRAME_PASSENGER,
    MUT_COLOR_TRUNC_PASSENGER,
    MUT_COLOR_SPLICE_PASSENGER,
} from 'cbioportal-frontend-commons';

// Helper function to get the correct VUS color based on mutation type
const getVUSColor = (displayLabel: string): string | undefined => {
    if (displayLabel === 'Missense (VUS)') {
        return MUT_COLOR_MISSENSE_PASSENGER;
    } else if (displayLabel === 'Inframe (VUS)') {
        return MUT_COLOR_INFRAME_PASSENGER;
    } else if (displayLabel === 'Truncating (VUS)') {
        return MUT_COLOR_TRUNC_PASSENGER;
    } else if (displayLabel === 'Splice (VUS)') {
        return MUT_COLOR_SPLICE_PASSENGER;
    }
    return undefined;
};

const renderLegendItem = (
    displayLabel: string,
    styling: { fillColor: string; strokeColor: string; hasStroke: boolean },
    count: number,
    visibleCount: number | undefined,
    isHidden: boolean,
    isClickable: boolean,
    onToggleCategoryVisibility?: (category: string) => void
) => {
    return (
        <div
            key={displayLabel}
            style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '2px',
                cursor: isClickable ? 'pointer' : 'default',
                opacity: isHidden ? 0.5 : 1,
                padding: '2px',
                borderRadius: '2px',
            }}
            onClick={() => {
                if (isClickable && onToggleCategoryVisibility) {
                    onToggleCategoryVisibility(displayLabel);
                }
            }}
            onMouseEnter={e => {
                if (isClickable) {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                }
            }}
            onMouseLeave={e => {
                if (isClickable) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                }
            }}
        >
            <div
                style={{
                    width: '10px', // Keep container width consistent
                    height: '10px', // Keep container height consistent
                    marginRight: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <div
                    style={{
                        width:
                            displayLabel === 'Case not in this cohort' ||
                            displayLabel === 'Sample not in this cohort'
                                ? '4px'
                                : '12px', // Slightly larger dots for better visibility
                        height:
                            displayLabel === 'Case not in this cohort' ||
                            displayLabel === 'Sample not in this cohort'
                                ? '4px'
                                : '12px', // Slightly larger dots for better visibility
                        backgroundColor: isHidden
                            ? '#CCCCCC'
                            : isUnfilledCategory(displayLabel)
                            ? 'transparent' // Use transparent background for unfilled categories
                            : styling.fillColor,
                        borderRadius: '50%',
                        border: isHidden
                            ? '1px solid #CCCCCC'
                            : styling.hasStroke
                            ? `2px solid ${styling.strokeColor}` // Use strokeColor with moderately thick border
                            : `1px solid ${styling.fillColor}`,
                        opacity: isHidden ? 0.4 : 1,
                    }}
                />
            </div>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                    fontSize: '12px',
                }}
            >
                <span
                    style={{
                        textDecoration: isHidden ? 'line-through' : 'none',
                        color: isHidden ? '#CCCCCC' : 'inherit',
                        opacity: isHidden ? 0.6 : 1,
                    }}
                >
                    {displayLabel}
                </span>
                <span
                    style={{
                        marginLeft: '8px',
                        color: isHidden ? '#CCCCCC' : '#666',
                        fontWeight: 500,
                        opacity: isHidden ? 0.6 : 1,
                        fontSize: '11px',
                    }}
                >
                    {visibleCount !== undefined && visibleCount !== count
                        ? `${formatCount(visibleCount)} / ${formatCount(count)}`
                        : formatCount(count)}
                </span>
            </div>
        </div>
    );
};

// Helper function to render a gradient legend for numeric attributes
const renderGradientLegend = (
    numericalValueRange: [number, number],
    numericalValueToColor: (x: number) => string,
    displayLabel: string
) => {
    const [min, max] = numericalValueRange;
    const GRADIENT_MESH = 30;
    const gradientStops = [];

    for (let i = 0; i < GRADIENT_MESH; i++) {
        const fraction = i / GRADIENT_MESH;
        const value = fraction * max + (1 - fraction) * min;
        const color = numericalValueToColor(value);
        gradientStops.push(
            <stop
                key={i}
                offset={`${(fraction * 100).toFixed(0)}%`}
                stopColor={color}
            />
        );
    }

    const gradientId = `gradient-${displayLabel.replace(/\s+/g, '-')}`;

    return (
        <div style={{ marginTop: '8px' }}>
            <div
                style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '6px',
                    color: '#333',
                }}
            >
                {displayLabel}
            </div>
            <svg width="100%" height="60">
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                        {gradientStops}
                    </linearGradient>
                </defs>
                <rect
                    x="0"
                    y="5"
                    width="100%"
                    height="20"
                    fill={`url(#${gradientId})`}
                    stroke="#ccc"
                    strokeWidth="1"
                />
                <text x="0" y="40" fontSize="11" fill="#666" textAnchor="start">
                    {min.toFixed(2)}
                </text>
                <text
                    x="50%"
                    y="40"
                    fontSize="11"
                    fill="#666"
                    textAnchor="middle"
                >
                    {((min + max) / 2).toFixed(2)}
                </text>
                <text
                    x="100%"
                    y="40"
                    fontSize="11"
                    fill="#666"
                    textAnchor="end"
                >
                    {max.toFixed(2)}
                </text>
            </svg>
        </div>
    );
};

export interface LegendPanelProps {
    data: EmbeddingPoint[];
    showLegend?: boolean;
    actualHeight: number;
    categoryCounts?: Map<string, number>;
    // Per-category counts after every active filter - shown alongside
    // categoryCounts' raw/unfiltered totals as "visible / total" so a
    // category whose points got filtered out (by this panel's own toggles
    // or another panel's lasso selection) doesn't look unchanged just
    // because its raw total is still the same.
    visibleCategoryCounts?: Map<string, number>;
    categoryColors?: Map<
        string,
        { fillColor: string; strokeColor: string; hasStroke: boolean }
    >;
    hiddenCategories?: Set<string>;
    onToggleCategoryVisibility?: (category: string) => void;
    onToggleAllCategories?: () => void;
    // QC categories are toggled through this separate pair when supplied
    // (shared across split-view panels), falling back to the general pair
    // above otherwise.
    hiddenQcCategories?: Set<string>;
    onToggleQcCategoryVisibility?: (category: string) => void;
    // Hides the Total/Visible Samples header and the Configuration section
    // - used so only one split-view panel shows them, saving space on the
    // rest. Defaults to true (shown).
    showHeaderAndConfiguration?: boolean;
    visibleSampleCount?: number;
    totalSampleCount?: number;
    visibleCategoryCount?: number;
    totalCategoryCount?: number;
    isNumericAttribute?: boolean;
    numericalValueRange?: [number, number];
    numericalValueToColor?: (x: number) => string;
    // Controlled collapse state (e.g. synced to the URL by the caller).
    // Falls back to local state when omitted.
    isCollapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
    // Highlights the legend with a colored border when a cross-panel
    // sample filter is currently active (from this panel's own legend
    // selection, or another panel's) - a quick visual cue that what's
    // rendered is a filtered subset, even on a non-primary panel that
    // doesn't show the Total/Visible Samples header.
    isFilterActive?: boolean;
}

export const LegendPanel: React.FC<LegendPanelProps> = ({
    data,
    showLegend = true,
    actualHeight,
    categoryCounts,
    visibleCategoryCounts,
    categoryColors,
    hiddenCategories,
    onToggleCategoryVisibility,
    onToggleAllCategories,
    hiddenQcCategories,
    onToggleQcCategoryVisibility,
    showHeaderAndConfiguration = true,
    visibleSampleCount,
    totalSampleCount,
    visibleCategoryCount,
    totalCategoryCount,
    isNumericAttribute = false,
    numericalValueRange,
    numericalValueToColor,
    isCollapsed: controlledIsCollapsed,
    onCollapsedChange,
    isFilterActive = false,
}) => {
    const [isConfigExpanded, setIsConfigExpanded] = React.useState(false);
    const [localIsCollapsed, setLocalIsCollapsed] = React.useState(false);
    const isCollapsed =
        controlledIsCollapsed !== undefined
            ? controlledIsCollapsed
            : localIsCollapsed;
    const setIsCollapsed = (value: boolean) => {
        if (onCollapsedChange) {
            onCollapsedChange(value);
        } else {
            setLocalIsCollapsed(value);
        }
    };
    if (!showLegend) {
        return null;
    }

    // Use categoryCounts and categoryColors as the primary data source for legend items
    // This ensures all categories always appear in the legend, even when hidden
    let legendItems: Record<
        string,
        { fillColor: string; strokeColor: string; hasStroke: boolean }
    > = {};

    if (categoryCounts && categoryColors && categoryCounts.size > 0) {
        // Create legend items for all categories using the complete color data
        categoryCounts.forEach((count, category) => {
            const colorInfo = categoryColors.get(category);
            if (colorInfo) {
                // Check if this is a VUS category and use explicit VUS color if available
                const vusColor = isVUSCategory(category)
                    ? getVUSColor(category)
                    : undefined;

                legendItems[category] = {
                    fillColor: vusColor || colorInfo.fillColor, // Use VUS color if available
                    strokeColor:
                        colorInfo.strokeColor ||
                        vusColor ||
                        colorInfo.fillColor,
                    hasStroke: colorInfo.hasStroke,
                };
            } else {
                // Fallback styling for categories not in color data (shouldn't happen, but defensive)
                legendItems[category] = {
                    fillColor: '#CCCCCC',
                    strokeColor: '#CCCCCC',
                    hasStroke: false,
                };
            }
        });
    } else {
        // Fallback to old method if categoryCounts/categoryColors not available
        if (!data || data.length === 0) {
            return null;
        }

        legendItems = data.reduce((acc, point) => {
            if (point.displayLabel && point.color) {
                // Use explicit VUS colors for categories that end with (VUS)
                const vusColor = isVUSCategory(point.displayLabel)
                    ? getVUSColor(point.displayLabel)
                    : undefined;

                acc[point.displayLabel] = {
                    fillColor: vusColor || point.color, // Use VUS color if available
                    strokeColor: point.strokeColor || vusColor || point.color, // Use strokeColor or VUS color
                    hasStroke: !!(
                        point.strokeColor && point.strokeColor !== point.color
                    ),
                };
            }
            return acc;
        }, {} as Record<string, { fillColor: string; strokeColor: string; hasStroke: boolean }>);
    }

    // Separate biological categories from QC categories (non-cohort samples)
    const qcCategories = [
        'Case not in this cohort',
        'Sample not in this cohort',
    ];

    const biologicalEntries: [
        string,
        { fillColor: string; strokeColor: string; hasStroke: boolean }
    ][] = [];
    const qcEntries: [
        string,
        { fillColor: string; strokeColor: string; hasStroke: boolean }
    ][] = [];

    Object.entries(legendItems).forEach(([label, styling]) => {
        if (qcCategories.includes(label)) {
            qcEntries.push([label, styling]);
        } else {
            // Everything else goes in biological section (including "Unselected")
            biologicalEntries.push([label, styling]);
        }
    });

    // Sort biological entries by count (highest to lowest)
    biologicalEntries.sort(([labelA], [labelB]) => {
        const countA = categoryCounts?.get(labelA) || 0;
        const countB = categoryCounts?.get(labelB) || 0;
        return countB - countA; // Descending order
    });

    // Sort QC entries with specific order
    qcEntries.sort(([labelA], [labelB]) => {
        const priority = {
            'Case not in this cohort': 1,
            'Sample not in this cohort': 2,
        };

        const priorityA = priority[labelA as keyof typeof priority] || 999;
        const priorityB = priority[labelB as keyof typeof priority] || 999;

        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        return labelA.localeCompare(labelB);
    });

    if (biologicalEntries.length === 0 && qcEntries.length === 0) {
        return null;
    }

    if (isCollapsed) {
        return (
            <button
                data-test="embeddings-legend-expand"
                onClick={() => setIsCollapsed(false)}
                title="Show legend"
                style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    zIndex: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid #ccc',
                    borderRadius: '3px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
            >
                <FontAwesome name="chevron-left" />
                Legend
            </button>
        );
    }

    return (
        <div
            data-test="embeddings-legend"
            style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                border: isFilterActive ? '2px solid #ffc107' : '1px solid #ccc',
                borderRadius: '3px',
                padding: '8px',
                fontSize: '10px',
                maxHeight: `${actualHeight - 20}px`,
                minWidth: categoryCounts ? '220px' : '160px',
                maxWidth: '300px',
                boxShadow: isFilterActive
                    ? '0 0 0 1px #ffc107, 0 2px 8px rgba(0,0,0,0.1)'
                    : '0 2px 8px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header with buttons - Always visible */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    marginBottom: '8px',
                    gap: '4px',
                    flexShrink: 0,
                }}
            >
                <button
                    data-test="embeddings-legend-collapse"
                    onClick={() => setIsCollapsed(true)}
                    title="Hide legend"
                    style={{
                        background: '#f8f9fa',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px',
                        padding: '4px 6px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        marginRight: 'auto',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = '#e9ecef';
                        e.currentTarget.style.borderColor = '#adb5bd';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                        e.currentTarget.style.borderColor = '#dee2e6';
                    }}
                >
                    <FontAwesome name="chevron-right" />
                </button>
                {onToggleAllCategories &&
                    (() => {
                        // Determine if all categories are currently visible
                        const allVisible =
                            !hiddenCategories || hiddenCategories.size === 0;
                        const buttonText = allVisible ? 'Hide All' : 'Show All';
                        const iconName = allVisible ? 'eye-slash' : 'eye';
                        const buttonTitle = allVisible
                            ? 'Hide All Categories'
                            : 'Show All Categories';

                        return (
                            <button
                                onClick={onToggleAllCategories}
                                style={{
                                    background: '#f8f9fa',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '4px',
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.backgroundColor =
                                        '#e9ecef';
                                    e.currentTarget.style.borderColor =
                                        '#adb5bd';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.backgroundColor =
                                        '#f8f9fa';
                                    e.currentTarget.style.borderColor =
                                        '#dee2e6';
                                }}
                                title={buttonTitle}
                            >
                                <span
                                    style={{
                                        marginRight: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                    }}
                                >
                                    <FontAwesome name={iconName} />
                                </span>
                                <span>{buttonText}</span>
                            </button>
                        );
                    })()}
            </div>

            {/* Scrollable area for biological categories OR gradient legend for numeric attributes */}
            <div
                style={{
                    overflowY: 'auto',
                    maxHeight: '400px',
                    marginBottom: '8px',
                    flexGrow: 1,
                }}
            >
                {(() => {
                    /* Show gradient legend for numeric attributes */
                    if (
                        isNumericAttribute &&
                        numericalValueRange &&
                        numericalValueToColor &&
                        biologicalEntries.length > 0
                    ) {
                        return renderGradientLegend(
                            numericalValueRange,
                            numericalValueToColor,
                            biologicalEntries[0][0] // Use the first entry's display label (e.g., "Current Age")
                        );
                    } else {
                        /* Biological Categories (sorted by count) */
                        return biologicalEntries.map(
                            ([displayLabel, styling]) => {
                                const count =
                                    categoryCounts?.get(displayLabel) || 0;
                                // A category with zero currently-visible
                                // points has no entry in the map at all
                                // (nothing to count), which must still
                                // read as 0 here - not "no filter active"
                                // (Map.get's undefined) - or a fully
                                // hidden category would wrongly show its
                                // raw, unfiltered count.
                                const visibleCount = visibleCategoryCounts
                                    ? visibleCategoryCounts.get(displayLabel) ||
                                      0
                                    : undefined;
                                const isHidden =
                                    hiddenCategories?.has(displayLabel) ||
                                    false;
                                const isClickable =
                                    onToggleCategoryVisibility !== undefined;

                                return renderLegendItem(
                                    displayLabel,
                                    styling,
                                    count,
                                    visibleCount,
                                    isHidden,
                                    isClickable,
                                    onToggleCategoryVisibility
                                );
                            }
                        );
                    }
                })()}
            </div>

            {/* Collapsible Configuration Section for non-cohort samples -
                only on the primary panel; the QC visibility it controls is
                shared across every panel via hiddenQcCategories. */}
            {showHeaderAndConfiguration && qcEntries.length > 0 && (
                <div
                    style={{
                        borderTop: '1px solid #eee',
                        paddingTop: '8px',
                        flexShrink: 0,
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            padding: '4px 2px',
                            borderRadius: '3px',
                            marginBottom: '4px',
                            backgroundColor: isConfigExpanded
                                ? '#f8f9fa'
                                : 'transparent',
                            border: '1px solid transparent',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#666',
                        }}
                        onClick={() => setIsConfigExpanded(!isConfigExpanded)}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                            e.currentTarget.style.borderColor = '#dee2e6';
                        }}
                        onMouseLeave={e => {
                            if (!isConfigExpanded) {
                                e.currentTarget.style.backgroundColor =
                                    'transparent';
                                e.currentTarget.style.borderColor =
                                    'transparent';
                            }
                        }}
                    >
                        <span style={{ marginRight: '4px', fontSize: '10px' }}>
                            {isConfigExpanded ? '▼' : '▶'}
                        </span>
                        Configuration
                    </div>

                    {isConfigExpanded && (
                        <div style={{ paddingLeft: '8px' }}>
                            {qcEntries.map(([displayLabel, styling]) => {
                                const count =
                                    categoryCounts?.get(displayLabel) || 0;
                                // A category with zero currently-visible
                                // points has no entry in the map at all
                                // (nothing to count), which must still
                                // read as 0 here - not "no filter active"
                                // (Map.get's undefined) - or a fully
                                // hidden category would wrongly show its
                                // raw, unfiltered count.
                                const visibleCount = visibleCategoryCounts
                                    ? visibleCategoryCounts.get(displayLabel) ||
                                      0
                                    : undefined;
                                const toggleQcVisibility =
                                    onToggleQcCategoryVisibility ||
                                    onToggleCategoryVisibility;
                                const isHidden =
                                    hiddenQcCategories?.has(displayLabel) ||
                                    hiddenCategories?.has(displayLabel) ||
                                    false;
                                const isClickable =
                                    toggleQcVisibility !== undefined;

                                return renderLegendItem(
                                    displayLabel,
                                    styling,
                                    count,
                                    visibleCount,
                                    isHidden,
                                    isClickable,
                                    toggleQcVisibility
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
