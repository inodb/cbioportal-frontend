import { remoteData } from 'cbioportal-frontend-commons';
import { EmbeddingData } from './EmbeddingTypes';

const EMBEDDING_BASE_URL =
    'https://datahub.assets.cbioportal.org/embeddings/msk_mosaic_2026';

// Mirrors umap_he_50k.json's own `studyIds` - kept in sync by hand.
export const EMBEDDING_MAP_STUDY_IDS: string[] = [
    'acc_tcga_pan_can_atlas_2018',
    'blca_tcga_pan_can_atlas_2018',
    'brca_tcga_pan_can_atlas_2018',
    'cesc_tcga_pan_can_atlas_2018',
    'chol_tcga_pan_can_atlas_2018',
    'coadread_tcga_pan_can_atlas_2018',
    'esca_tcga_pan_can_atlas_2018',
    'gbm_tcga_pan_can_atlas_2018',
    'hnsc_tcga_pan_can_atlas_2018',
    'kich_tcga_pan_can_atlas_2018',
    'kirc_tcga_pan_can_atlas_2018',
    'kirp_tcga_pan_can_atlas_2018',
    'lgg_tcga_pan_can_atlas_2018',
    'lihc_tcga_pan_can_atlas_2018',
    'luad_tcga_pan_can_atlas_2018',
    'lusc_tcga_pan_can_atlas_2018',
    'meso_tcga_pan_can_atlas_2018',
    'msk_impact_50k_2026',
    'paad_tcga_pan_can_atlas_2018',
    'pcpg_tcga_pan_can_atlas_2018',
    'prad_tcga_pan_can_atlas_2018',
    'sarc_tcga_pan_can_atlas_2018',
    'skcm_tcga_pan_can_atlas_2018',
    'stad_tcga_pan_can_atlas_2018',
    'tgct_tcga_pan_can_atlas_2018',
    'thca_tcga_pan_can_atlas_2018',
    'thym_tcga_pan_can_atlas_2018',
    'ucec_tcga_pan_can_atlas_2018',
    'ucs_tcga_pan_can_atlas_2018',
    'uvm_tcga_pan_can_atlas_2018',
];

// Module-level singleton so every consumer shares one fetch.
export const boehmHeData = remoteData<EmbeddingData>({
    await: () => [],
    invoke: async () => {
        const response = await fetch(`${EMBEDDING_BASE_URL}/umap_he_50k.json`);
        if (!response.ok) {
            throw new Error('Failed to load H&E embedding data');
        }
        return response.json();
    },
});
