import { assert } from 'chai';
import {
    ClinicalAttribute,
    GenePanelData,
    MolecularProfile,
    Sample,
} from 'cbioportal-ts-api-client';
import {
    buildClinicalCompletenessRows,
    buildGenePanelCompletenessRows,
    buildProfileCompletenessRows,
    CompletenessLevel,
    formatPercent,
    getFilterForStudy,
    getProfileCategory,
    getStudyCaseCounts,
    isMissingClinicalValue,
} from './DataCompletenessUtils';

function sample(studyId: string, patientId: string, sampleId: string) {
    return {
        studyId,
        patientId,
        sampleId,
        uniqueSampleKey: `${studyId}:${sampleId}`,
        uniquePatientKey: `${studyId}:${patientId}`,
    } as Sample;
}

function attr(
    studyId: string,
    clinicalAttributeId: string,
    patientAttribute: boolean
) {
    return {
        studyId,
        clinicalAttributeId,
        patientAttribute,
        displayName: clinicalAttributeId,
        datatype: 'STRING',
    } as ClinicalAttribute;
}

function profile(
    studyId: string,
    suffix: string,
    molecularAlterationType: string,
    datatype = 'MAF',
    genericAssayType?: string
) {
    return {
        studyId,
        molecularProfileId: `${studyId}_${suffix}`,
        molecularAlterationType,
        datatype,
        genericAssayType,
        name: suffix,
    } as MolecularProfile;
}

describe('DataCompletenessUtils', () => {
    const samples = [
        sample('a', 'p1', 's1'),
        sample('a', 'p1', 's2'),
        sample('a', 'p2', 's3'),
        sample('b', 'q1', 't1'),
    ];
    const caseCounts = getStudyCaseCounts(samples);

    it('counts samples and unique patients per study', () => {
        assert.deepEqual(caseCounts, {
            a: { samples: 3, patients: 2 },
            b: { samples: 1, patients: 1 },
        });
    });

    it('treats NA and empty values as missing', () => {
        assert.isTrue(isMissingClinicalValue('NA'));
        assert.isTrue(isMissingClinicalValue(' na '));
        assert.isTrue(isMissingClinicalValue(''));
        assert.isFalse(isMissingClinicalValue('Male'));
        assert.isFalse(isMissingClinicalValue('0'));
    });

    it('restricts filters to one study', () => {
        assert.deepEqual(
            getFilterForStudy({ studyIds: ['a', 'b'] } as any, 'b').studyIds,
            ['b']
        );
        const bySample = getFilterForStudy(
            {
                sampleIdentifiers: [
                    { studyId: 'a', sampleId: 's1' },
                    { studyId: 'b', sampleId: 't1' },
                ],
            } as any,
            'a'
        );
        assert.deepEqual(bySample.sampleIdentifiers, [
            { studyId: 'a', sampleId: 's1' },
        ]);
        assert.isUndefined(bySample.studyIds);
    });

    it('builds clinical rows with patient/sample denominators and per-study availability', () => {
        const rows = buildClinicalCompletenessRows(
            {
                a: [attr('a', 'SEX', true), attr('a', 'SAMPLE_TYPE', false)],
                b: [attr('b', 'SEX', true)],
            },
            {
                a: [
                    {
                        attributeId: 'SEX',
                        counts: [
                            { value: 'Male', count: 1 } as any,
                            { value: 'NA', count: 1 } as any,
                        ],
                    },
                    {
                        attributeId: 'SAMPLE_TYPE',
                        counts: [{ value: 'Primary', count: 3 } as any],
                    },
                ],
                b: [
                    {
                        attributeId: 'SEX',
                        counts: [{ value: 'Female', count: 1 } as any],
                    },
                ],
            },
            caseCounts
        );
        const sex = rows.find(r => r.attribute.clinicalAttributeId === 'SEX')!;
        assert.equal(sex.level, CompletenessLevel.PATIENT);
        assert.equal(sex.withData, 2);
        assert.equal(sex.total, 3);
        assert.deepEqual(sex.byStudy.a, {
            withData: 1,
            total: 2,
            available: true,
        });

        const sampleType = rows.find(
            r => r.attribute.clinicalAttributeId === 'SAMPLE_TYPE'
        )!;
        assert.equal(sampleType.level, CompletenessLevel.SAMPLE);
        assert.equal(sampleType.withData, 3);
        assert.equal(sampleType.total, 4);
        assert.deepEqual(sampleType.byStudy.b, {
            withData: 0,
            total: 1,
            available: false,
        });
    });

    it('builds molecular profile rows grouped by profile suffix', () => {
        const rows = buildProfileCompletenessRows(
            [
                profile('a', 'mutations', 'MUTATION_EXTENDED'),
                profile('b', 'mutations', 'MUTATION_EXTENDED'),
                profile(
                    'a',
                    'ancestry',
                    'GENERIC_ASSAY',
                    'LIMIT-VALUE',
                    'GENETIC_ANCESTRY'
                ),
                profile('zzz', 'mutations', 'MUTATION_EXTENDED'),
            ],
            {
                a: [
                    { value: 'mutations', label: 'Mutations', count: 2 },
                    { value: 'ancestry', label: 'Ancestry', count: 3 },
                ],
                b: [{ value: 'mutations', label: 'Mutations', count: 1 }],
            },
            caseCounts
        );
        const mutations = rows.find(r => r.profileKey === 'mutations')!;
        assert.equal(mutations.withData, 3);
        assert.equal(mutations.total, 4);
        assert.equal(mutations.category, 'Mutations');

        const ancestry = rows.find(r => r.profileKey === 'ancestry')!;
        assert.equal(ancestry.category, 'Generic assay: Genetic Ancestry');
        assert.equal(ancestry.withData, 3);
        assert.isFalse(ancestry.byStudy.b.available);
    });

    it('builds gene panel rows restricted to selected, profiled samples', () => {
        const profiles = [
            profile('a', 'mutations', 'MUTATION_EXTENDED'),
            profile('b', 'mutations', 'MUTATION_EXTENDED'),
        ];
        const gpd = (
            studyId: string,
            sampleId: string,
            genePanelId: string | undefined,
            profiled = true
        ) =>
            ({
                studyId,
                sampleId,
                uniqueSampleKey: `${studyId}:${sampleId}`,
                molecularProfileId: `${studyId}_mutations`,
                genePanelId,
                profiled,
            } as GenePanelData);

        const rows = buildGenePanelCompletenessRows(
            [
                gpd('a', 's1', 'IMPACT341'),
                gpd('a', 's2', 'IMPACT468'),
                gpd('a', 's3', 'IMPACT468', false),
                gpd('a', 'unselected', 'IMPACT468'),
                gpd('b', 't1', undefined),
            ],
            profiles,
            new Set(samples.map(s => s.uniqueSampleKey)),
            caseCounts
        );
        const byPanel = (id: string | undefined) =>
            rows.find(r => r.genePanelId === id)!;
        assert.equal(rows.length, 3);
        assert.equal(byPanel('IMPACT468').withData, 1);
        assert.equal(byPanel('IMPACT468').total, 4);
        assert.deepEqual(byPanel('IMPACT468').profiles, [
            {
                profileKey: 'mutations',
                label: 'mutations',
                category: 'Mutations',
                samples: 1,
            },
        ]);
        assert.equal(byPanel(undefined).byStudy.b.withData, 1);
        assert.isFalse(byPanel(undefined).byStudy.a.available);
    });

    it('counts a sample once per panel across profiles', () => {
        const profiles = [
            profile('a', 'mutations', 'MUTATION_EXTENDED'),
            profile('a', 'cna', 'COPY_NUMBER_ALTERATION', 'DISCRETE'),
        ];
        const rows = buildGenePanelCompletenessRows(
            ['mutations', 'cna'].map(
                suffix =>
                    ({
                        studyId: 'a',
                        sampleId: 's1',
                        uniqueSampleKey: 'a:s1',
                        molecularProfileId: `a_${suffix}`,
                        genePanelId: 'IMPACT468',
                        profiled: true,
                    } as GenePanelData)
            ),
            profiles,
            new Set(['a:s1']),
            caseCounts
        );
        assert.equal(rows.length, 1);
        assert.equal(rows[0].withData, 1);
        assert.deepEqual(
            rows[0].profiles.map(p => p.category),
            ['Copy number', 'Mutations']
        );
    });

    it('categorizes CNA and expression profiles', () => {
        assert.equal(
            getProfileCategory(
                profile('a', 'cna', 'COPY_NUMBER_ALTERATION', 'DISCRETE')
            ),
            'Copy number'
        );
        assert.equal(
            getProfileCategory(profile('a', 'rna', 'MRNA_EXPRESSION')),
            'Expression'
        );
    });

    it('formats percentages without rounding to 0% or 100%', () => {
        assert.equal(formatPercent(0), '0%');
        assert.equal(formatPercent(0.004), '<1%');
        assert.equal(formatPercent(0.996), '>99%');
        assert.equal(formatPercent(1), '100%');
        assert.equal(formatPercent(0.5), '50%');
    });
});
