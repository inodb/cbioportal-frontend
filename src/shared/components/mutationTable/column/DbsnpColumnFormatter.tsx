import * as React from 'react';
import { Mutation } from "shared/api/generated/CBioPortalAPI";
import { MyVariantInfo as MyVariantInfoData } from 'shared/api/generated/GenomeNexusAPIInternal';
import GenomeNexusCache, { GenomeNexusCacheDataType } from "shared/cache/GenomeNexusEnrichment";
import MyVariantInfo from "shared/components/annotation/genomeNexus/MyVariantInfo.tsx";

interface IDbsnpData {
    myVariantInfo: MyVariantInfoData;
}
export default class DbsnpColumnFormatter
{
    private static getData(genomeNexusData: GenomeNexusCacheDataType | null): IDbsnpData | null {
        if (genomeNexusData === null ||
            genomeNexusData.status === "error" ||
            genomeNexusData.data === null) {
            return null;
    }

        // TODO: handle multiple transcripts instead of just picking the first one
        const myVariantInfo = genomeNexusData.data.my_variant_info && genomeNexusData.data.my_variant_info.annotation;

        return {myVariantInfo};
    }
    public static renderFunction(data: Mutation[], genomeNexusCache: GenomeNexusCache) {
        const genomeNexusData = DbsnpColumnFormatter.getGenomeNexusData(data, genomeNexusCache);
        return (
            <div>
                {genomeNexusData}
            </div>
        );
    }
    public static download(data: Mutation[], genomeNexusCache: GenomeNexusCache): string {
        const genomeNexusData = DbsnpColumnFormatter.getGenomeNexusData(data, genomeNexusCache);
        const dbSNPData = DbsnpColumnFormatter.getData(genomeNexusData);

        if (!dbSNPData) {
            return "";
        }

        return [
            `MyVariantInfo: ${MyVariantInfo.download(dbSNPData.myVariantInfo)}`
        ].join(";");
    }

    private static getGenomeNexusData(data: Mutation[], cache: GenomeNexusCache): GenomeNexusCacheDataType | null {
        if (data.length === 0) {
            return null;
        }
        return cache.get(data[0]);
    }
}