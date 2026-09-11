import { remoteData } from 'cbioportal-frontend-commons';
import { EmbeddingData } from './EmbeddingTypes';

const EMBEDDING_BASE_URL =
    'https://datahub.assets.cbioportal.org/embeddings/msk_mosaic_2026';

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
