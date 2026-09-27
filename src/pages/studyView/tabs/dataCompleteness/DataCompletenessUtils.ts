import _ from 'lodash';
import {
    ClinicalAttribute,
    ClinicalDataCountItem,
    GenePanelData,
    MolecularProfile,
    Sample,
    StudyViewFilter,
} from 'cbioportal-ts-api-client';
import { AlterationTypeConstants } from 'shared/constants';
import { getSuffixOfMolecularProfile } from 'shared/lib/molecularProfileUtils';

export type Coverage = {
    withData: number;
    total: number;
};

export type StudyCoverage = Coverage & {
    // false when the data element does not exist at all in this study
    available: boolean;
};

export type CoverageRow = Coverage & {
    byStudy: { [studyId: string]: StudyCoverage };
};

export type ClinicalCompletenessRow = CoverageRow & {
    attribute: ClinicalAttribute;
    level: CompletenessLevel;
};

export type ProfileCompletenessRow = CoverageRow & {
    profileKey: string;
    label: string;
    category: string;
};

export type GenePanelProfileUsage = {
    profileKey: string;
    label: string;
    category: string;
    samples: number;
};

export type GenePanelCompletenessRow = CoverageRow & {
    genePanelId: string | undefined;
    profiles: GenePanelProfileUsage[];
};

export enum CompletenessLevel {
    PATIENT = 'Patient',
    SAMPLE = 'Sample',
}

export type StudyCaseCounts = {
    [studyId: string]: { samples: number; patients: number };
};

export const NO_GENE_PANEL_LABEL = 'Whole exome / genome (no panel)';

const MISSING_VALUES = new Set(['NA']);

export function isMissingClinicalValue(value: string | undefined) {
    return (
        value === undefined ||
        value.trim() === '' ||
        MISSING_VALUES.has(value.trim().toUpperCase())
    );
}

export function completenessFraction(coverage: Coverage) {
    return coverage.total > 0 ? coverage.withData / coverage.total : 0;
}

export function getStudyCaseCounts(samples: Sample[]): StudyCaseCounts {
    return _.mapValues(
        _.groupBy(samples, s => s.studyId),
        studySamples => ({
            samples: studySamples.length,
            patients: _.uniqBy(studySamples, s => s.uniquePatientKey).length,
        })
    );
}

/**
 * Restricts a study view filter to a single physical study, keeping all
 * other filters so the result still reflects the current selection.
 */
export function getFilterForStudy(
    filters: StudyViewFilter,
    studyId: string
): StudyViewFilter {
    if (filters.sampleIdentifiers && filters.sampleIdentifiers.length > 0) {
        return {
            ...filters,
            studyIds: undefined as any,
            sampleIdentifiers: filters.sampleIdentifiers.filter(
                s => s.studyId === studyId
            ),
        };
    }
    return {
        ...filters,
        sampleIdentifiers: undefined as any,
        studyIds: [studyId],
    };
}

function clinicalAttributeKey(attr: ClinicalAttribute) {
    return `${attr.patientAttribute ? 'PATIENT' : 'SAMPLE'}_${
        attr.clinicalAttributeId
    }`;
}

function sumCoverage(byStudy: { [studyId: string]: StudyCoverage }) {
    return {
        withData: _.sumBy(_.values(byStudy), c => c.withData),
        total: _.sumBy(_.values(byStudy), c => c.total),
    };
}

/**
 * @param attributesByStudy clinical attributes defined in each study
 * @param countsByStudy clinical data counts (restricted to the selection) per study
 */
export function buildClinicalCompletenessRows(
    attributesByStudy: { [studyId: string]: ClinicalAttribute[] },
    countsByStudy: { [studyId: string]: ClinicalDataCountItem[] },
    caseCounts: StudyCaseCounts
): ClinicalCompletenessRow[] {
    const studyIds = _.keys(caseCounts);
    const allAttributes = _.uniqBy(
        _.flatten(studyIds.map(id => attributesByStudy[id] || [])),
        clinicalAttributeKey
    );

    const withDataByStudy = _.mapValues(countsByStudy, items =>
        _.mapValues(
            _.keyBy(items, item => item.attributeId),
            item =>
                _.sumBy(
                    item.counts.filter(c => !isMissingClinicalValue(c.value)),
                    c => c.count
                )
        )
    );

    const definedByStudy = _.mapValues(attributesByStudy, attrs =>
        _.keyBy(attrs, clinicalAttributeKey)
    );

    return allAttributes.map(attribute => {
        const key = clinicalAttributeKey(attribute);
        const level = attribute.patientAttribute
            ? CompletenessLevel.PATIENT
            : CompletenessLevel.SAMPLE;
        const byStudy = _.fromPairs(
            studyIds.map(studyId => {
                const available = !!definedByStudy[studyId]?.[key];
                const total =
                    level === CompletenessLevel.PATIENT
                        ? caseCounts[studyId].patients
                        : caseCounts[studyId].samples;
                const withData = available
                    ? Math.min(
                          withDataByStudy[studyId]?.[
                              attribute.clinicalAttributeId
                          ] || 0,
                          total
                      )
                    : 0;
                return [studyId, { withData, total, available }];
            })
        );
        return {
            attribute,
            level,
            byStudy,
            ...sumCoverage(byStudy),
        };
    });
}

export function getProfileCategory(profile: MolecularProfile) {
    switch (profile.molecularAlterationType) {
        case AlterationTypeConstants.MUTATION_EXTENDED:
        case AlterationTypeConstants.MUTATION_UNCALLED:
            return 'Mutations';
        case AlterationTypeConstants.STRUCTURAL_VARIANT:
        case AlterationTypeConstants.FUSION:
            return 'Structural variants';
        case AlterationTypeConstants.COPY_NUMBER_ALTERATION:
            return 'Copy number';
        case AlterationTypeConstants.MRNA_EXPRESSION:
        case AlterationTypeConstants.MRNA_EXPRESSION_NORMALS:
        case AlterationTypeConstants.RNA_EXPRESSION:
        case AlterationTypeConstants.MICRO_RNA_EXPRESSION:
            return 'Expression';
        case AlterationTypeConstants.PROTEIN_LEVEL:
        case AlterationTypeConstants.PROTEIN_ARRAY_PROTEIN_LEVEL:
        case AlterationTypeConstants.PROTEIN_ARRAY_PHOSPHORYLATION:
        case AlterationTypeConstants.PHOSPHORYLATION:
            return 'Protein';
        case AlterationTypeConstants.METHYLATION:
        case AlterationTypeConstants.METHYLATION_BINARY:
            return 'Methylation';
        case AlterationTypeConstants.GENESET_SCORE:
            return 'Gene set scores';
        case AlterationTypeConstants.GENERIC_ASSAY:
            return `Generic assay: ${_.startCase(
                (profile.genericAssayType || 'other').toLowerCase()
            )}`;
        default:
            return _.startCase(
                (profile.molecularAlterationType || 'other').toLowerCase()
            );
    }
}

/**
 * @param countsByStudy molecular profile sample counts per study, keyed by
 *  profile suffix (the profile id without the study prefix)
 */
export function buildProfileCompletenessRows(
    profiles: MolecularProfile[],
    countsByStudy: {
        [studyId: string]: { value: string; label: string; count: number }[];
    },
    caseCounts: StudyCaseCounts
): ProfileCompletenessRow[] {
    const studyIds = _.keys(caseCounts);
    const profilesBySuffix = _.groupBy(
        profiles.filter(p => p.studyId in caseCounts),
        getSuffixOfMolecularProfile
    );
    const countsBySuffixByStudy = _.mapValues(countsByStudy, counts =>
        _.keyBy(counts, c => c.value)
    );

    return _.map(profilesBySuffix, (suffixProfiles, profileKey) => {
        const studiesWithProfile = new Set(suffixProfiles.map(p => p.studyId));
        const byStudy = _.fromPairs(
            studyIds.map(studyId => {
                const available = studiesWithProfile.has(studyId);
                const total = caseCounts[studyId].samples;
                const withData = available
                    ? Math.min(
                          countsBySuffixByStudy[studyId]?.[profileKey]?.count ||
                              0,
                          total
                      )
                    : 0;
                return [studyId, { withData, total, available }];
            })
        );
        return {
            profileKey,
            label: mostCommon(suffixProfiles.map(p => p.name)),
            category: getProfileCategory(suffixProfiles[0]),
            byStudy,
            ...sumCoverage(byStudy),
        };
    });
}

export function isGenePanelProfile(profile: MolecularProfile) {
    return (
        profile.molecularAlterationType ===
            AlterationTypeConstants.MUTATION_EXTENDED ||
        profile.molecularAlterationType ===
            AlterationTypeConstants.STRUCTURAL_VARIANT ||
        (profile.molecularAlterationType ===
            AlterationTypeConstants.COPY_NUMBER_ALTERATION &&
            profile.datatype === 'DISCRETE')
    );
}

/**
 * One row per gene panel, counting the selected samples profiled with that
 * panel in any mutation, copy number or structural variant profile. The
 * denominator is all selected samples.
 */
export function buildGenePanelCompletenessRows(
    genePanelData: GenePanelData[],
    profiles: MolecularProfile[],
    selectedSampleKeys: Set<string>,
    caseCounts: StudyCaseCounts
): GenePanelCompletenessRow[] {
    const studyIds = _.keys(caseCounts);
    const profileById = _.keyBy(profiles, p => p.molecularProfileId);
    const profiled = genePanelData.filter(
        d =>
            d.profiled &&
            d.molecularProfileId in profileById &&
            selectedSampleKeys.has(d.uniqueSampleKey)
    );

    const profilesBySuffix = _.groupBy(profiles, getSuffixOfMolecularProfile);

    return _.map(
        _.groupBy(profiled, d => d.genePanelId || ''),
        (data, genePanelId) => {
            const countByStudy = _.countBy(
                _.uniqBy(data, d => d.uniqueSampleKey),
                d => d.studyId
            );
            const studiesWithPanel = new Set(data.map(d => d.studyId));
            const byStudy = _.fromPairs(
                studyIds.map(studyId => [
                    studyId,
                    {
                        withData: countByStudy[studyId] || 0,
                        total: caseCounts[studyId].samples,
                        available: studiesWithPanel.has(studyId),
                    },
                ])
            );
            const usage = _.map(
                _.groupBy(data, d =>
                    getSuffixOfMolecularProfile(
                        profileById[d.molecularProfileId]
                    )
                ),
                (profileData, profileKey) => ({
                    profileKey,
                    label: mostCommon(
                        profilesBySuffix[profileKey].map(p => p.name)
                    ),
                    category: getProfileCategory(
                        profilesBySuffix[profileKey][0]
                    ),
                    samples: _.uniqBy(profileData, d => d.uniqueSampleKey)
                        .length,
                })
            );
            return {
                genePanelId: genePanelId || undefined,
                profiles: _.sortBy(usage, u => u.category),
                byStudy,
                ...sumCoverage(byStudy),
            };
        }
    );
}

function mostCommon(values: string[]) {
    return _.maxBy(_.toPairs(_.countBy(values)), ([, count]) => count)![0];
}

/**
 * Red (0%) → amber (50%) → green (100%), light enough for dark text on top.
 */
export function completenessColor(fraction: number) {
    const clamped = Math.max(0, Math.min(1, fraction));
    const hue = Math.round(clamped * 120);
    return `hsl(${hue}, 65%, 82%)`;
}

export function completenessBarColor(fraction: number) {
    const clamped = Math.max(0, Math.min(1, fraction));
    const hue = Math.round(clamped * 120);
    return `hsl(${hue}, 60%, 45%)`;
}

export function formatPercent(fraction: number) {
    const pct = fraction * 100;
    if (pct > 0 && pct < 1) {
        return '<1%';
    }
    if (pct < 100 && pct > 99) {
        return '>99%';
    }
    return `${Math.round(pct)}%`;
}
