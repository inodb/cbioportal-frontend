import _ from 'lodash';
import { computed, makeObservable } from 'mobx';
import { remoteData } from 'cbioportal-frontend-commons';
import {
    ClinicalAttribute,
    ClinicalDataCountItem,
    GenePanel,
    GenePanelData,
} from 'cbioportal-ts-api-client';
import { getClient } from 'shared/api/cbioportalClientInstance';
import { StudyViewPageStore } from '../../StudyViewPageStore';
import {
    buildClinicalCompletenessRows,
    buildGenePanelCompletenessRows,
    buildProfileCompletenessRows,
    getFilterForStudy,
    getStudyCaseCounts,
    isGenePanelProfile,
} from './DataCompletenessUtils';

export class DataCompletenessStore {
    constructor(private store: StudyViewPageStore) {
        makeObservable(this);
    }

    @computed get caseCounts() {
        return getStudyCaseCounts(this.store.selectedSamples.result);
    }

    @computed get selectedStudyIds() {
        return _.keys(this.caseCounts).sort();
    }

    @computed get selectedSampleKeys() {
        return new Set(
            this.store.selectedSamples.result.map(s => s.uniqueSampleKey)
        );
    }

    readonly clinicalAttributesByStudy = remoteData<{
        [studyId: string]: ClinicalAttribute[];
    }>({
        await: () => [this.store.queriedPhysicalStudyIds],
        invoke: async () => {
            const studyIds = this.store.queriedPhysicalStudyIds.result;
            if (studyIds.length === 0) {
                return {};
            }
            const attributes = await getClient().fetchClinicalAttributesUsingPOST(
                { studyIds }
            );
            return _.groupBy(attributes, a => a.studyId);
        },
        default: {},
    });

    readonly clinicalDataCountsByStudy = remoteData<{
        [studyId: string]: ClinicalDataCountItem[];
    }>({
        await: () => [
            this.store.selectedSamples,
            this.clinicalAttributesByStudy,
        ],
        invoke: async () => {
            const filters = this.store.filters;
            const entries = await Promise.all(
                this.selectedStudyIds.map(async studyId => {
                    const attributes = _.uniqBy(
                        this.clinicalAttributesByStudy.result[studyId] || [],
                        a => a.clinicalAttributeId
                    ).map(a => ({ attributeId: a.clinicalAttributeId }));
                    if (attributes.length === 0) {
                        return [studyId, []] as [
                            string,
                            ClinicalDataCountItem[]
                        ];
                    }
                    const counts = await this.store.internalClient.fetchClinicalDataCountsUsingPOST(
                        {
                            clinicalDataCountFilter: {
                                attributes,
                                studyViewFilter: getFilterForStudy(
                                    filters,
                                    studyId
                                ),
                            } as any,
                        }
                    );
                    return [studyId, counts] as [string, typeof counts];
                })
            );
            return _.fromPairs(entries);
        },
        default: {},
    });

    readonly clinicalRows = remoteData({
        await: () => [
            this.store.selectedSamples,
            this.clinicalAttributesByStudy,
            this.clinicalDataCountsByStudy,
        ],
        invoke: () =>
            Promise.resolve(
                buildClinicalCompletenessRows(
                    this.clinicalAttributesByStudy.result,
                    this.clinicalDataCountsByStudy.result,
                    this.caseCounts
                )
            ),
        default: [],
    });

    readonly profileSampleCountsByStudy = remoteData<{
        [studyId: string]: { value: string; label: string; count: number }[];
    }>({
        await: () => [this.store.selectedSamples],
        invoke: async () => {
            const filters = this.store.filters;
            const entries = await Promise.all(
                this.selectedStudyIds.map(async studyId => {
                    const counts = await this.store.internalClient.fetchMolecularProfileSampleCountsUsingPOST(
                        {
                            studyViewFilter: getFilterForStudy(
                                filters,
                                studyId
                            ),
                        }
                    );
                    return [studyId, counts] as [string, typeof counts];
                })
            );
            return _.fromPairs(entries);
        },
        default: {},
    });

    readonly profileRows = remoteData({
        await: () => [
            this.store.selectedSamples,
            this.store.molecularProfiles,
            this.profileSampleCountsByStudy,
        ],
        invoke: () =>
            Promise.resolve(
                buildProfileCompletenessRows(
                    this.store.molecularProfiles.result,
                    this.profileSampleCountsByStudy.result,
                    this.caseCounts
                )
            ),
        default: [],
    });

    @computed get genePanelProfiles() {
        return this.store.molecularProfiles.result.filter(isGenePanelProfile);
    }

    // Fetched for all samples in the queried studies so that changing the
    // selection only re-filters client-side.
    readonly allGenePanelData = remoteData<GenePanelData[]>({
        await: () => [this.store.molecularProfiles],
        invoke: async () => {
            const molecularProfileIds = this.genePanelProfiles.map(
                p => p.molecularProfileId
            );
            if (molecularProfileIds.length === 0) {
                return [];
            }
            return getClient().fetchGenePanelDataInMultipleMolecularProfilesUsingPOST(
                {
                    genePanelDataMultipleStudyFilter: {
                        molecularProfileIds,
                    } as any,
                }
            );
        },
        default: [],
    });

    readonly genePanelRows = remoteData({
        await: () => [
            this.store.selectedSamples,
            this.store.molecularProfiles,
            this.allGenePanelData,
        ],
        invoke: () =>
            Promise.resolve(
                buildGenePanelCompletenessRows(
                    this.allGenePanelData.result,
                    this.genePanelProfiles,
                    this.selectedSampleKeys,
                    this.caseCounts
                )
            ),
        default: [],
    });

    readonly genePanels = remoteData<{ [genePanelId: string]: GenePanel }>({
        await: () => [this.allGenePanelData],
        invoke: async () => {
            const genePanelIds = _.uniq(
                _.compact(this.allGenePanelData.result.map(d => d.genePanelId))
            );
            if (genePanelIds.length === 0) {
                return {};
            }
            const panels = await getClient().fetchGenePanelsUsingPOST({
                genePanelIds,
                projection: 'DETAILED',
            });
            return _.keyBy(panels, p => p.genePanelId);
        },
        default: {},
    });
}
