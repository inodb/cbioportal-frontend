export enum FeatureFlagEnum {
    LEFT_TRUNCATION_ADJUSTMENT = 'LEFT_TRUNCATION_ADJUSTMENT',
    PATIENT_MRNA_TAB = 'patientMRNATab',
    GENE_SPECIFIC_VIOLIN_PLOT = 'geneSpecificViolinPlot',
    EMBEDDINGS = 'EMBEDDINGS',
}

export interface FeatureFlagPortalOverride {
    description?: string;
    exampleUrl?: string;
}

export interface FeatureFlagMetadata {
    /** shown to users deciding whether to opt in */
    description: string;
    /**
     * whether this flag has a user-facing opt-in control at all. Set to
     * false for flags that exist purely for internal/ops use.
     */
    userOptIn: boolean;
    /** a URL demonstrating the feature, relative to the portal's origin */
    exampleUrl?: string;
    /**
     * restricts the opt-in control to these app_names (IAppConfig.app_name).
     * Omit for "available on every portal".
     */
    portals?: string[];
    /** app_names where this behavior is already unconditionally on */
    alwaysOnPortals?: string[];
    /** per-portal overrides of description/exampleUrl above */
    portalOverrides?: { [appName: string]: FeatureFlagPortalOverride };
}

export const FEATURE_FLAG_METADATA: {
    [flag in FeatureFlagEnum]: FeatureFlagMetadata;
} = {
    [FeatureFlagEnum.LEFT_TRUNCATION_ADJUSTMENT]: {
        description:
            'Adjusts survival curves for left-truncation bias in the ' +
            'Comparison and Study View survival tabs. Only has an effect ' +
            'for the heme_onc_nsclc_genie_bpc GENIE BPC cohort, the only ' +
            'study with the entry-time data this adjustment needs; it is a ' +
            'no-op for every other study.',
        userOptIn: true,
        exampleUrl:
            '/study?id=heme_onc_nsclc_genie_bpc&featureFlags=LEFT_TRUNCATION_ADJUSTMENT',
    },
    [FeatureFlagEnum.PATIENT_MRNA_TAB]: {
        description:
            "Adds the patient view's mRNA/Plots tab for studies with an " +
            'expression profile.',
        userOptIn: true,
        exampleUrl:
            '/patient/plots?studyId=brca_tcga&caseId=TCGA-A2-A0T2&featureFlags=patientMRNATab',
        alwaysOnPortals: ['mskcc-portal'],
    },
    [FeatureFlagEnum.GENE_SPECIFIC_VIOLIN_PLOT]: {
        description:
            'Auto-adds a default-configured gene-specific violin plot chart ' +
            'from mRNA profiles in Study View.',
        userOptIn: true,
        exampleUrl:
            '/study?id=msk_target_test&featureFlags=geneSpecificViolinPlot',
    },
    [FeatureFlagEnum.EMBEDDINGS]: {
        description:
            'Enables the embeddings (e.g. UMAP) visualization tab in Study ' +
            'View for studies with embedding resources.',
        userOptIn: true,
        exampleUrl:
            '/study/embeddings?id=msk_impact_50k_2026&featureFlags=EMBEDDINGS',
    },
};

export function getFeatureFlagDisplayInfo(
    flag: FeatureFlagEnum,
    appName: string | undefined | null
) {
    const meta = FEATURE_FLAG_METADATA[flag];
    const override = appName ? meta.portalOverrides?.[appName] : undefined;
    return {
        description: override?.description ?? meta.description,
        exampleUrl: override?.exampleUrl ?? meta.exampleUrl,
        alwaysOn: !!appName && !!meta.alwaysOnPortals?.includes(appName),
    };
}

export function isFeatureFlagOptable(
    flag: FeatureFlagEnum,
    appName: string | undefined | null
): boolean {
    const meta = FEATURE_FLAG_METADATA[flag];
    if (!meta.userOptIn) {
        return false;
    }
    if (!meta.portals || meta.portals.length === 0) {
        return true;
    }
    return !!appName && meta.portals.includes(appName);
}
