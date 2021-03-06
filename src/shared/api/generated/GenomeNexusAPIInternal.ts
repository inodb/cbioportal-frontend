import * as request from "superagent";

type CallbackHandler = (err: any, res ? : request.Response) => void;
export type EnsemblTranscript = {
    'geneId': string

        'proteinId': string

        'proteinLength': number

        'transcriptId': string

};
export type Hotspot = {
    'geneId': string

        'hugoSymbol': string

        'proteinEnd': string

        'proteinStart': string

        'residue': string

        'transcriptId': string

};
export type IsoformOverride = {
    'ccdsId': string

        'geneSymbol': string

        'refseqId': string

        'transcriptId': string

};
export type MutationAssessor = {
    'codonStartPosition': string

        'cosmicCount': number

        'functionalImpact': string

        'functionalImpactScore': number

        'hugoSymbol': string

        'input': string

        'mappingIssue': string

        'msaGaps': number

        'msaHeight': number

        'msaLink': string

        'pdbLink': string

        'referenceGenomeVariant': string

        'referenceGenomeVariantType': string

        'refseqId': string

        'refseqPosition': number

        'refseqResidue': string

        'snpCount': number

        'uniprotId': string

        'uniprotPosition': number

        'uniprotResidue': string

        'variant': string

        'variantConservationScore': number

        'variantSpecificityScore': number

};

/**
 * Genome Nexus Variant Annotation API
 * @class GenomeNexusAPIInternal
 * @param {(string)} [domainOrOptions] - The project domain.
 */
export default class GenomeNexusAPIInternal {

    private domain: string = "";
    private errorHandlers: CallbackHandler[] = [];

    constructor(domain ? : string) {
        if (domain) {
            this.domain = domain;
        }
    }

    getDomain() {
        return this.domain;
    }

    addErrorHandler(handler: CallbackHandler) {
        this.errorHandlers.push(handler);
    }

    private request(method: string, url: string, body: any, headers: any, queryParameters: any, form: any, reject: CallbackHandler, resolve: CallbackHandler, errorHandlers: CallbackHandler[]) {
        let req = (new(request as any).Request(method, url) as request.Request)
            .query(queryParameters);
        Object.keys(headers).forEach(key => {
            req.set(key, headers[key]);
        });

        if (body) {
            req.send(body);
        }

        if (typeof(body) === 'object' && !(body.constructor.name === 'Buffer')) {
            req.set('Content-Type', 'application/json');
        }

        if (Object.keys(form).length > 0) {
            req.type('form');
            req.send(form);
        }

        req.end((error, response) => {
            if (error || !response.ok) {
                reject(error);
                errorHandlers.forEach(handler => handler(error));
            } else {
                resolve(response);
            }
        });
    }

    fetchHotspotAnnotationPOSTURL(parameters: {
        'variants': Array < string > ,
        $queryParameters ? : any
    }): string {
        let queryParameters: any = {};
        let path = '/cancer_hotspots';

        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                var parameter = parameters.$queryParameters[parameterName];
                queryParameters[parameterName] = parameter;
            });
        }
        let keys = Object.keys(queryParameters);
        return this.domain + path + (keys.length > 0 ? '?' + (keys.map(key => key + '=' + encodeURIComponent(queryParameters[key])).join('&')) : '');
    };

    /**
     * Retrieves hotspot annotation for the provided list of variants
     * @method
     * @name GenomeNexusAPIInternal#fetchHotspotAnnotationPOST
     * @param {} variants - List of variants. For example ["7:g.140453136A>T","12:g.25398285C>A"]
     */
    fetchHotspotAnnotationPOST(parameters: {
            'variants': Array < string > ,
            $queryParameters ? : any,
            $domain ? : string
        }): Promise < Array < Hotspot >
        > {
            const domain = parameters.$domain ? parameters.$domain : this.domain;
            const errorHandlers = this.errorHandlers;
            const request = this.request;
            let path = '/cancer_hotspots';
            let body: any;
            let queryParameters: any = {};
            let headers: any = {};
            let form: any = {};
            return new Promise(function(resolve, reject) {
                headers['Accept'] = 'application/json';
                headers['Content-Type'] = 'application/json';

                if (parameters['variants'] !== undefined) {
                    body = parameters['variants'];
                }

                if (parameters['variants'] === undefined) {
                    reject(new Error('Missing required  parameter: variants'));
                    return;
                }

                if (parameters.$queryParameters) {
                    Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                        var parameter = parameters.$queryParameters[parameterName];
                        queryParameters[parameterName] = parameter;
                    });
                }

                request('POST', domain + path, body, headers, queryParameters, form, reject, resolve, errorHandlers);

            }).then(function(response: request.Response) {
                return response.body;
            });
        };

    fetchHotspotAnnotationGETURL(parameters: {
        'variant': string,
        $queryParameters ? : any
    }): string {
        let queryParameters: any = {};
        let path = '/cancer_hotspots/{variant}';

        path = path.replace('{variant}', parameters['variant'] + '');

        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                var parameter = parameters.$queryParameters[parameterName];
                queryParameters[parameterName] = parameter;
            });
        }
        let keys = Object.keys(queryParameters);
        return this.domain + path + (keys.length > 0 ? '?' + (keys.map(key => key + '=' + encodeURIComponent(queryParameters[key])).join('&')) : '');
    };

    /**
     * Retrieves hotspot annotation for a specific variant
     * @method
     * @name GenomeNexusAPIInternal#fetchHotspotAnnotationGET
     * @param {string} variant - A variant. For example 7:g.140453136A>T
     */
    fetchHotspotAnnotationGET(parameters: {
            'variant': string,
            $queryParameters ? : any,
            $domain ? : string
        }): Promise < Array < Hotspot >
        > {
            const domain = parameters.$domain ? parameters.$domain : this.domain;
            const errorHandlers = this.errorHandlers;
            const request = this.request;
            let path = '/cancer_hotspots/{variant}';
            let body: any;
            let queryParameters: any = {};
            let headers: any = {};
            let form: any = {};
            return new Promise(function(resolve, reject) {
                headers['Accept'] = 'application/json';
                headers['Content-Type'] = 'application/json';

                path = path.replace('{variant}', parameters['variant'] + '');

                if (parameters['variant'] === undefined) {
                    reject(new Error('Missing required  parameter: variant'));
                    return;
                }

                if (parameters.$queryParameters) {
                    Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                        var parameter = parameters.$queryParameters[parameterName];
                        queryParameters[parameterName] = parameter;
                    });
                }

                request('GET', domain + path, body, headers, queryParameters, form, reject, resolve, errorHandlers);

            }).then(function(response: request.Response) {
                return response.body;
            });
        };

    fetchAllEnsemblTranscriptsGETURL(parameters: {
        $queryParameters ? : any
    }): string {
        let queryParameters: any = {};
        let path = '/ensembl/transcript';

        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                var parameter = parameters.$queryParameters[parameterName];
                queryParameters[parameterName] = parameter;
            });
        }
        let keys = Object.keys(queryParameters);
        return this.domain + path + (keys.length > 0 ? '?' + (keys.map(key => key + '=' + encodeURIComponent(queryParameters[key])).join('&')) : '');
    };

    /**
     * Retrieves all Ensembl Transcripts
     * @method
     * @name GenomeNexusAPIInternal#fetchAllEnsemblTranscriptsGET
     */
    fetchAllEnsemblTranscriptsGET(parameters: {
            $queryParameters ? : any,
                $domain ? : string
        }): Promise < Array < EnsemblTranscript >
        > {
            const domain = parameters.$domain ? parameters.$domain : this.domain;
            const errorHandlers = this.errorHandlers;
            const request = this.request;
            let path = '/ensembl/transcript';
            let body: any;
            let queryParameters: any = {};
            let headers: any = {};
            let form: any = {};
            return new Promise(function(resolve, reject) {
                headers['Accept'] = 'application/json';
                headers['Content-Type'] = 'application/json';

                if (parameters.$queryParameters) {
                    Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                        var parameter = parameters.$queryParameters[parameterName];
                        queryParameters[parameterName] = parameter;
                    });
                }

                request('GET', domain + path, body, headers, queryParameters, form, reject, resolve, errorHandlers);

            }).then(function(response: request.Response) {
                return response.body;
            });
        };

    fetchEnsemblTranscriptsByGeneIdsPOSTURL(parameters: {
        'geneIds': Array < string > ,
        $queryParameters ? : any
    }): string {
        let queryParameters: any = {};
        let path = '/ensembl/transcript/gene';

        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                var parameter = parameters.$queryParameters[parameterName];
                queryParameters[parameterName] = parameter;
            });
        }
        let keys = Object.keys(queryParameters);
        return this.domain + path + (keys.length > 0 ? '?' + (keys.map(key => key + '=' + encodeURIComponent(queryParameters[key])).join('&')) : '');
    };

    /**
     * Retrieves Ensembl transcripts by Ensembl gene IDs
     * @method
     * @name GenomeNexusAPIInternal#fetchEnsemblTranscriptsByGeneIdsPOST
     * @param {} geneIds - List of Ensembl gene IDs. For example ["ENSG00000136999","ENSG00000272398","ENSG00000198695"]
     */
    fetchEnsemblTranscriptsByGeneIdsPOST(parameters: {
            'geneIds': Array < string > ,
            $queryParameters ? : any,
            $domain ? : string
        }): Promise < Array < EnsemblTranscript >
        > {
            const domain = parameters.$domain ? parameters.$domain : this.domain;
            const errorHandlers = this.errorHandlers;
            const request = this.request;
            let path = '/ensembl/transcript/gene';
            let body: any;
            let queryParameters: any = {};
            let headers: any = {};
            let form: any = {};
            return new Promise(function(resolve, reject) {
                headers['Accept'] = 'application/json';
                headers['Content-Type'] = 'application/json';

                if (parameters['geneIds'] !== undefined) {
                    body = parameters['geneIds'];
                }

                if (parameters['geneIds'] === undefined) {
                    reject(new Error('Missing required  parameter: geneIds'));
                    return;
                }

                if (parameters.$queryParameters) {
                    Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                        var parameter = parameters.$queryParameters[parameterName];
                        queryParameters[parameterName] = parameter;
                    });
                }

                request('POST', domain + path, body, headers, queryParameters, form, reject, resolve, errorHandlers);

            }).then(function(response: request.Response) {
                return response.body;
            });
        };

    fetchEnsemblTranscriptsByGeneIdGETURL(parameters: {
        'geneId': string,
        $queryParameters ? : any
    }): string {
        let queryParameters: any = {};
        let path = '/ensembl/transcript/gene/{geneId}';

        path = path.replace('{geneId}', parameters['geneId'] + '');

        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                var parameter = parameters.$queryParameters[parameterName];
                queryParameters[parameterName] = parameter;
            });
        }
        let keys = Object.keys(queryParameters);
        return this.domain + path + (keys.length > 0 ? '?' + (keys.map(key => key + '=' + encodeURIComponent(queryParameters[key])).join('&')) : '');
    };

    /**
     * Retrieves Ensembl transcripts by an Ensembl gene ID
     * @method
     * @name GenomeNexusAPIInternal#fetchEnsemblTranscriptsByGeneIdGET
     * @param {string} geneId - An Ensembl gene ID. For example ENSG00000136999
     */
    fetchEnsemblTranscriptsByGeneIdGET(parameters: {
            'geneId': string,
            $queryParameters ? : any,
            $domain ? : string
        }): Promise < Array < EnsemblTranscript >
        > {
            const domain = parameters.$domain ? parameters.$domain : this.domain;
            const errorHandlers = this.errorHandlers;
            const request = this.request;
            let path = '/ensembl/transcript/gene/{geneId}';
            let body: any;
            let queryParameters: any = {};
            let headers: any = {};
            let form: any = {};
            return new Promise(function(resolve, reject) {
                headers['Accept'] = 'application/json';
                headers['Content-Type'] = 'application/json';

                path = path.replace('{geneId}', parameters['geneId'] + '');

                if (parameters['geneId'] === undefined) {
                    reject(new Error('Missing required  parameter: geneId'));
                    return;
                }

                if (parameters.$queryParameters) {
                    Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                        var parameter = parameters.$queryParameters[parameterName];
                        queryParameters[parameterName] = parameter;
                    });
                }

                request('GET', domain + path, body, headers, queryParameters, form, reject, resolve, errorHandlers);

            }).then(function(response: request.Response) {
                return response.body;
            });
        };

    fetchEnsemblTranscriptsByHugoSymbolsPOSTURL(parameters: {
        'hugoSymbols': Array < string > ,
        'isoformOverrideSource' ? : string,
        $queryParameters ? : any
    }): string {
        let queryParameters: any = {};
        let path = '/ensembl/transcript/hgnc';

        if (parameters['isoformOverrideSource'] !== undefined) {
            queryParameters['isoformOverrideSource'] = parameters['isoformOverrideSource'];
        }

        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                var parameter = parameters.$queryParameters[parameterName];
                queryParameters[parameterName] = parameter;
            });
        }
        let keys = Object.keys(queryParameters);
        return this.domain + path + (keys.length > 0 ? '?' + (keys.map(key => key + '=' + encodeURIComponent(queryParameters[key])).join('&')) : '');
    };

    /**
     * Retrieves Ensembl transcripts by Hugo Symbols
     * @method
     * @name GenomeNexusAPIInternal#fetchEnsemblTranscriptsByHugoSymbolsPOST
     * @param {} hugoSymbols - List of Hugo Symbols. For example ["TP53","PIK3CA","BRCA1"]
     * @param {string} isoformOverrideSource - Isoform override source. For example uniprot
     */
    fetchEnsemblTranscriptsByHugoSymbolsPOST(parameters: {
            'hugoSymbols': Array < string > ,
            'isoformOverrideSource' ? : string,
            $queryParameters ? : any,
            $domain ? : string
        }): Promise < Array < EnsemblTranscript >
        > {
            const domain = parameters.$domain ? parameters.$domain : this.domain;
            const errorHandlers = this.errorHandlers;
            const request = this.request;
            let path = '/ensembl/transcript/hgnc';
            let body: any;
            let queryParameters: any = {};
            let headers: any = {};
            let form: any = {};
            return new Promise(function(resolve, reject) {
                headers['Accept'] = 'application/json';
                headers['Content-Type'] = 'application/json';

                if (parameters['hugoSymbols'] !== undefined) {
                    body = parameters['hugoSymbols'];
                }

                if (parameters['hugoSymbols'] === undefined) {
                    reject(new Error('Missing required  parameter: hugoSymbols'));
                    return;
                }

                if (parameters['isoformOverrideSource'] !== undefined) {
                    queryParameters['isoformOverrideSource'] = parameters['isoformOverrideSource'];
                }

                if (parameters.$queryParameters) {
                    Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                        var parameter = parameters.$queryParameters[parameterName];
                        queryParameters[parameterName] = parameter;
                    });
                }

                request('POST', domain + path, body, headers, queryParameters, form, reject, resolve, errorHandlers);

            }).then(function(response: request.Response) {
                return response.body;
            });
        };

    fetchEnsemblTranscriptsByHugoSymbolGETURL(parameters: {
        'hugoSymbol': string,
        'isoformOverrideSource' ? : string,
        $queryParameters ? : any
    }): string {
        let queryParameters: any = {};
        let path = '/ensembl/transcript/hgnc/{hugoSymbol}';

        path = path.replace('{hugoSymbol}', parameters['hugoSymbol'] + '');
        if (parameters['isoformOverrideSource'] !== undefined) {
            queryParameters['isoformOverrideSource'] = parameters['isoformOverrideSource'];
        }

        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                var parameter = parameters.$queryParameters[parameterName];
                queryParameters[parameterName] = parameter;
            });
        }
        let keys = Object.keys(queryParameters);
        return this.domain + path + (keys.length > 0 ? '?' + (keys.map(key => key + '=' + encodeURIComponent(queryParameters[key])).join('&')) : '');
    };

    /**
     * Retrieves Ensembl transcripts by an Ensembl gene ID
     * @method
     * @name GenomeNexusAPIInternal#fetchEnsemblTranscriptsByHugoSymbolGET
     * @param {string} hugoSymbol - A Hugo Symbol. For example TP53
     * @param {string} isoformOverrideSource - Isoform override source. For example uniprot
     */
    fetchEnsemblTranscriptsByHugoSymbolGET(parameters: {
        'hugoSymbol': string,
        'isoformOverrideSource' ? : string,
        $queryParameters ? : any,
        $domain ? : string
    }): Promise < EnsemblTranscript > {
        const domain = parameters.$domain ? parameters.$domain : this.domain;
        const errorHandlers = this.errorHandlers;
        const request = this.request;
        let path = '/ensembl/transcript/hgnc/{hugoSymbol}';
        let body: any;
        let queryParameters: any = {};
        let headers: any = {};
        let form: any = {};
        return new Promise(function(resolve, reject) {
            headers['Accept'] = 'application/json';
            headers['Content-Type'] = 'application/json';

            path = path.replace('{hugoSymbol}', parameters['hugoSymbol'] + '');

            if (parameters['hugoSymbol'] === undefined) {
                reject(new Error('Missing required  parameter: hugoSymbol'));
                return;
            }

            if (parameters['isoformOverrideSource'] !== undefined) {
                queryParameters['isoformOverrideSource'] = parameters['isoformOverrideSource'];
            }

            if (parameters.$queryParameters) {
                Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                    var parameter = parameters.$queryParameters[parameterName];
                    queryParameters[parameterName] = parameter;
                });
            }

            request('GET', domain + path, body, headers, queryParameters, form, reject, resolve, errorHandlers);

        }).then(function(response: request.Response) {
            return response.body;
        });
    };

    fetchEnsemblTranscriptsByTranscriptIdsPOSTURL(parameters: {
        'transcriptIds': Array < string > ,
        $queryParameters ? : any
    }): string {
        let queryParameters: any = {};
        let path = '/ensembl/transcript/id';

        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                var parameter = parameters.$queryParameters[parameterName];
                queryParameters[parameterName] = parameter;
            });
        }
        let keys = Object.keys(queryParameters);
        return this.domain + path + (keys.length > 0 ? '?' + (keys.map(key => key + '=' + encodeURIComponent(queryParameters[key])).join('&')) : '');
    };

    /**
     * Retrieves Ensembl Transcripts by Ensembl transcript IDs
     * @method
     * @name GenomeNexusAPIInternal#fetchEnsemblTranscriptsByTranscriptIdsPOST
     * @param {} transcriptIds - List of Ensembl transcript IDs. For example ["ENST00000361390","ENST00000361453","ENST00000361624"]
     */
    fetchEnsemblTranscriptsByTranscriptIdsPOST(parameters: {
            'transcriptIds': Array < string > ,
            $queryParameters ? : any,
            $domain ? : string
        }): Promise < Array < EnsemblTranscript >
        > {
            const domain = parameters.$domain ? parameters.$domain : this.domain;
            const errorHandlers = this.errorHandlers;
            const request = this.request;
            let path = '/ensembl/transcript/id';
            let body: any;
            let queryParameters: any = {};
            let headers: any = {};
            let form: any = {};
            return new Promise(function(resolve, reject) {
                headers['Accept'] = 'application/json';
                headers['Content-Type'] = 'application/json';

                if (parameters['transcriptIds'] !== undefined) {
                    body = parameters['transcriptIds'];
                }

                if (parameters['transcriptIds'] === undefined) {
                    reject(new Error('Missing required  parameter: transcriptIds'));
                    return;
                }

                if (parameters.$queryParameters) {
                    Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                        var parameter = parameters.$queryParameters[parameterName];
                        queryParameters[parameterName] = parameter;
                    });
                }

                request('POST', domain + path, body, headers, queryParameters, form, reject, resolve, errorHandlers);

            }).then(function(response: request.Response) {
                return response.body;
            });
        };

    fetchEnsemblTranscriptsByTranscriptIdGETURL(parameters: {
        'transcriptId': string,
        $queryParameters ? : any
    }): string {
        let queryParameters: any = {};
        let path = '/ensembl/transcript/id/{transcriptId}';

        path = path.replace('{transcriptId}', parameters['transcriptId'] + '');

        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                var parameter = parameters.$queryParameters[parameterName];
                queryParameters[parameterName] = parameter;
            });
        }
        let keys = Object.keys(queryParameters);
        return this.domain + path + (keys.length > 0 ? '?' + (keys.map(key => key + '=' + encodeURIComponent(queryParameters[key])).join('&')) : '');
    };

    /**
     * Retrieves Transcripts by an Ensembl transcript ID
     * @method
     * @name GenomeNexusAPIInternal#fetchEnsemblTranscriptsByTranscriptIdGET
     * @param {string} transcriptId - An Ensembl transcript ID. For example ENST00000361390
     */
    fetchEnsemblTranscriptsByTranscriptIdGET(parameters: {
            'transcriptId': string,
            $queryParameters ? : any,
            $domain ? : string
        }): Promise < Array < EnsemblTranscript >
        > {
            const domain = parameters.$domain ? parameters.$domain : this.domain;
            const errorHandlers = this.errorHandlers;
            const request = this.request;
            let path = '/ensembl/transcript/id/{transcriptId}';
            let body: any;
            let queryParameters: any = {};
            let headers: any = {};
            let form: any = {};
            return new Promise(function(resolve, reject) {
                headers['Accept'] = 'application/json';
                headers['Content-Type'] = 'application/json';

                path = path.replace('{transcriptId}', parameters['transcriptId'] + '');

                if (parameters['transcriptId'] === undefined) {
                    reject(new Error('Missing required  parameter: transcriptId'));
                    return;
                }

                if (parameters.$queryParameters) {
                    Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                        var parameter = parameters.$queryParameters[parameterName];
                        queryParameters[parameterName] = parameter;
                    });
                }

                request('GET', domain + path, body, headers, queryParameters, form, reject, resolve, errorHandlers);

            }).then(function(response: request.Response) {
                return response.body;
            });
        };

    fetchEnsemblTranscriptsByProteinIdsPOSTURL(parameters: {
        'proteinIds': Array < string > ,
        $queryParameters ? : any
    }): string {
        let queryParameters: any = {};
        let path = '/ensembl/transcript/protein';

        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                var parameter = parameters.$queryParameters[parameterName];
                queryParameters[parameterName] = parameter;
            });
        }
        let keys = Object.keys(queryParameters);
        return this.domain + path + (keys.length > 0 ? '?' + (keys.map(key => key + '=' + encodeURIComponent(queryParameters[key])).join('&')) : '');
    };

    /**
     * Retrieves Ensembl transcripts by Ensembl protein IDs
     * @method
     * @name GenomeNexusAPIInternal#fetchEnsemblTranscriptsByProteinIdsPOST
     * @param {} proteinIds - List of Ensembl protein IDs. For example ["ENSP00000439985","ENSP00000478460","ENSP00000346196"]
     */
    fetchEnsemblTranscriptsByProteinIdsPOST(parameters: {
            'proteinIds': Array < string > ,
            $queryParameters ? : any,
            $domain ? : string
        }): Promise < Array < EnsemblTranscript >
        > {
            const domain = parameters.$domain ? parameters.$domain : this.domain;
            const errorHandlers = this.errorHandlers;
            const request = this.request;
            let path = '/ensembl/transcript/protein';
            let body: any;
            let queryParameters: any = {};
            let headers: any = {};
            let form: any = {};
            return new Promise(function(resolve, reject) {
                headers['Accept'] = 'application/json';
                headers['Content-Type'] = 'application/json';

                if (parameters['proteinIds'] !== undefined) {
                    body = parameters['proteinIds'];
                }

                if (parameters['proteinIds'] === undefined) {
                    reject(new Error('Missing required  parameter: proteinIds'));
                    return;
                }

                if (parameters.$queryParameters) {
                    Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                        var parameter = parameters.$queryParameters[parameterName];
                        queryParameters[parameterName] = parameter;
                    });
                }

                request('POST', domain + path, body, headers, queryParameters, form, reject, resolve, errorHandlers);

            }).then(function(response: request.Response) {
                return response.body;
            });
        };

    fetchEnsemblTranscriptsByProteinIdGETURL(parameters: {
        'proteinId': string,
        $queryParameters ? : any
    }): string {
        let queryParameters: any = {};
        let path = '/ensembl/transcript/protein/{proteinId}';

        path = path.replace('{proteinId}', parameters['proteinId'] + '');

        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                var parameter = parameters.$queryParameters[parameterName];
                queryParameters[parameterName] = parameter;
            });
        }
        let keys = Object.keys(queryParameters);
        return this.domain + path + (keys.length > 0 ? '?' + (keys.map(key => key + '=' + encodeURIComponent(queryParameters[key])).join('&')) : '');
    };

    /**
     * Retrieves Ensembl transcripts by an Ensembl protein ID
     * @method
     * @name GenomeNexusAPIInternal#fetchEnsemblTranscriptsByProteinIdGET
     * @param {string} proteinId - An Ensembl protein ID. For example ENSP00000439985
     */
    fetchEnsemblTranscriptsByProteinIdGET(parameters: {
            'proteinId': string,
            $queryParameters ? : any,
            $domain ? : string
        }): Promise < Array < EnsemblTranscript >
        > {
            const domain = parameters.$domain ? parameters.$domain : this.domain;
            const errorHandlers = this.errorHandlers;
            const request = this.request;
            let path = '/ensembl/transcript/protein/{proteinId}';
            let body: any;
            let queryParameters: any = {};
            let headers: any = {};
            let form: any = {};
            return new Promise(function(resolve, reject) {
                headers['Accept'] = 'application/json';
                headers['Content-Type'] = 'application/json';

                path = path.replace('{proteinId}', parameters['proteinId'] + '');

                if (parameters['proteinId'] === undefined) {
                    reject(new Error('Missing required  parameter: proteinId'));
                    return;
                }

                if (parameters.$queryParameters) {
                    Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                        var parameter = parameters.$queryParameters[parameterName];
                        queryParameters[parameterName] = parameter;
                    });
                }

                request('GET', domain + path, body, headers, queryParameters, form, reject, resolve, errorHandlers);

            }).then(function(response: request.Response) {
                return response.body;
            });
        };

    fetchIsoformOverridePOSTURL(parameters: {
        'source': string,
        'transcriptIds': Array < string > ,
        $queryParameters ? : any
    }): string {
        let queryParameters: any = {};
        let path = '/isoform_override';
        if (parameters['source'] !== undefined) {
            queryParameters['source'] = parameters['source'];
        }

        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                var parameter = parameters.$queryParameters[parameterName];
                queryParameters[parameterName] = parameter;
            });
        }
        let keys = Object.keys(queryParameters);
        return this.domain + path + (keys.length > 0 ? '?' + (keys.map(key => key + '=' + encodeURIComponent(queryParameters[key])).join('&')) : '');
    };

    /**
     * Gets the isoform override information for the specified source and the list of transcript ids
     * @method
     * @name GenomeNexusAPIInternal#fetchIsoformOverridePOST
     * @param {string} source - Override source. For example uniprot
     * @param {} transcriptIds - List of transcript ids. For example ["ENST00000361125","ENST00000443649"]. 
     */
    fetchIsoformOverridePOST(parameters: {
            'source': string,
            'transcriptIds': Array < string > ,
            $queryParameters ? : any,
            $domain ? : string
        }): Promise < Array < IsoformOverride >
        > {
            const domain = parameters.$domain ? parameters.$domain : this.domain;
            const errorHandlers = this.errorHandlers;
            const request = this.request;
            let path = '/isoform_override';
            let body: any;
            let queryParameters: any = {};
            let headers: any = {};
            let form: any = {};
            return new Promise(function(resolve, reject) {
                headers['Accept'] = 'application/json';
                headers['Content-Type'] = 'application/json';

                if (parameters['source'] !== undefined) {
                    queryParameters['source'] = parameters['source'];
                }

                if (parameters['source'] === undefined) {
                    reject(new Error('Missing required  parameter: source'));
                    return;
                }

                if (parameters['transcriptIds'] !== undefined) {
                    body = parameters['transcriptIds'];
                }

                if (parameters['transcriptIds'] === undefined) {
                    reject(new Error('Missing required  parameter: transcriptIds'));
                    return;
                }

                if (parameters.$queryParameters) {
                    Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                        var parameter = parameters.$queryParameters[parameterName];
                        queryParameters[parameterName] = parameter;
                    });
                }

                request('POST', domain + path, body, headers, queryParameters, form, reject, resolve, errorHandlers);

            }).then(function(response: request.Response) {
                return response.body;
            });
        };

    fetchIsoformOverrideSourcesGETURL(parameters: {
        $queryParameters ? : any
    }): string {
        let queryParameters: any = {};
        let path = '/isoform_override/sources';

        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                var parameter = parameters.$queryParameters[parameterName];
                queryParameters[parameterName] = parameter;
            });
        }
        let keys = Object.keys(queryParameters);
        return this.domain + path + (keys.length > 0 ? '?' + (keys.map(key => key + '=' + encodeURIComponent(queryParameters[key])).join('&')) : '');
    };

    /**
     * Gets a list of available isoform override data sources
     * @method
     * @name GenomeNexusAPIInternal#fetchIsoformOverrideSourcesGET
     */
    fetchIsoformOverrideSourcesGET(parameters: {
            $queryParameters ? : any,
                $domain ? : string
        }): Promise < Array < string >
        > {
            const domain = parameters.$domain ? parameters.$domain : this.domain;
            const errorHandlers = this.errorHandlers;
            const request = this.request;
            let path = '/isoform_override/sources';
            let body: any;
            let queryParameters: any = {};
            let headers: any = {};
            let form: any = {};
            return new Promise(function(resolve, reject) {
                headers['Accept'] = 'application/json';
                headers['Content-Type'] = 'application/json';

                if (parameters.$queryParameters) {
                    Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                        var parameter = parameters.$queryParameters[parameterName];
                        queryParameters[parameterName] = parameter;
                    });
                }

                request('GET', domain + path, body, headers, queryParameters, form, reject, resolve, errorHandlers);

            }).then(function(response: request.Response) {
                return response.body;
            });
        };

    fetchAllIsoformOverridesGETURL(parameters: {
        'source': string,
        $queryParameters ? : any
    }): string {
        let queryParameters: any = {};
        let path = '/isoform_override/{source}';

        path = path.replace('{source}', parameters['source'] + '');

        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                var parameter = parameters.$queryParameters[parameterName];
                queryParameters[parameterName] = parameter;
            });
        }
        let keys = Object.keys(queryParameters);
        return this.domain + path + (keys.length > 0 ? '?' + (keys.map(key => key + '=' + encodeURIComponent(queryParameters[key])).join('&')) : '');
    };

    /**
     * Gets the isoform override information for the specified source
     * @method
     * @name GenomeNexusAPIInternal#fetchAllIsoformOverridesGET
     * @param {string} source - Override source. For example uniprot
     */
    fetchAllIsoformOverridesGET(parameters: {
            'source': string,
            $queryParameters ? : any,
            $domain ? : string
        }): Promise < Array < IsoformOverride >
        > {
            const domain = parameters.$domain ? parameters.$domain : this.domain;
            const errorHandlers = this.errorHandlers;
            const request = this.request;
            let path = '/isoform_override/{source}';
            let body: any;
            let queryParameters: any = {};
            let headers: any = {};
            let form: any = {};
            return new Promise(function(resolve, reject) {
                headers['Accept'] = 'application/json';
                headers['Content-Type'] = 'application/json';

                path = path.replace('{source}', parameters['source'] + '');

                if (parameters['source'] === undefined) {
                    reject(new Error('Missing required  parameter: source'));
                    return;
                }

                if (parameters.$queryParameters) {
                    Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                        var parameter = parameters.$queryParameters[parameterName];
                        queryParameters[parameterName] = parameter;
                    });
                }

                request('GET', domain + path, body, headers, queryParameters, form, reject, resolve, errorHandlers);

            }).then(function(response: request.Response) {
                return response.body;
            });
        };

    fetchIsoformOverrideGETURL(parameters: {
        'source': string,
        'transcriptId': string,
        $queryParameters ? : any
    }): string {
        let queryParameters: any = {};
        let path = '/isoform_override/{source}/{transcriptId}';

        path = path.replace('{source}', parameters['source'] + '');

        path = path.replace('{transcriptId}', parameters['transcriptId'] + '');

        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                var parameter = parameters.$queryParameters[parameterName];
                queryParameters[parameterName] = parameter;
            });
        }
        let keys = Object.keys(queryParameters);
        return this.domain + path + (keys.length > 0 ? '?' + (keys.map(key => key + '=' + encodeURIComponent(queryParameters[key])).join('&')) : '');
    };

    /**
     * Gets the isoform override information for the specified source and transcript id
     * @method
     * @name GenomeNexusAPIInternal#fetchIsoformOverrideGET
     * @param {string} source - Override source. For example uniprot.
     * @param {string} transcriptId - Transcript id. For example ENST00000361125.
     */
    fetchIsoformOverrideGET(parameters: {
        'source': string,
        'transcriptId': string,
        $queryParameters ? : any,
        $domain ? : string
    }): Promise < IsoformOverride > {
        const domain = parameters.$domain ? parameters.$domain : this.domain;
        const errorHandlers = this.errorHandlers;
        const request = this.request;
        let path = '/isoform_override/{source}/{transcriptId}';
        let body: any;
        let queryParameters: any = {};
        let headers: any = {};
        let form: any = {};
        return new Promise(function(resolve, reject) {
            headers['Accept'] = 'application/json';
            headers['Content-Type'] = 'application/json';

            path = path.replace('{source}', parameters['source'] + '');

            if (parameters['source'] === undefined) {
                reject(new Error('Missing required  parameter: source'));
                return;
            }

            path = path.replace('{transcriptId}', parameters['transcriptId'] + '');

            if (parameters['transcriptId'] === undefined) {
                reject(new Error('Missing required  parameter: transcriptId'));
                return;
            }

            if (parameters.$queryParameters) {
                Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                    var parameter = parameters.$queryParameters[parameterName];
                    queryParameters[parameterName] = parameter;
                });
            }

            request('GET', domain + path, body, headers, queryParameters, form, reject, resolve, errorHandlers);

        }).then(function(response: request.Response) {
            return response.body;
        });
    };

    postMutationAssessorAnnotationURL(parameters: {
        'variants': Array < string > ,
        $queryParameters ? : any
    }): string {
        let queryParameters: any = {};
        let path = '/mutation_assessor';

        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                var parameter = parameters.$queryParameters[parameterName];
                queryParameters[parameterName] = parameter;
            });
        }
        let keys = Object.keys(queryParameters);
        return this.domain + path + (keys.length > 0 ? '?' + (keys.map(key => key + '=' + encodeURIComponent(queryParameters[key])).join('&')) : '');
    };

    /**
     * Retrieves mutation assessor information for the provided list of variants
     * @method
     * @name GenomeNexusAPIInternal#postMutationAssessorAnnotation
     * @param {} variants - List of variants. For example ["7:g.140453136A>T","12:g.25398285C>A"]
     */
    postMutationAssessorAnnotation(parameters: {
            'variants': Array < string > ,
            $queryParameters ? : any,
            $domain ? : string
        }): Promise < Array < MutationAssessor >
        > {
            const domain = parameters.$domain ? parameters.$domain : this.domain;
            const errorHandlers = this.errorHandlers;
            const request = this.request;
            let path = '/mutation_assessor';
            let body: any;
            let queryParameters: any = {};
            let headers: any = {};
            let form: any = {};
            return new Promise(function(resolve, reject) {
                headers['Accept'] = 'application/json';
                headers['Content-Type'] = 'application/json';

                if (parameters['variants'] !== undefined) {
                    body = parameters['variants'];
                }

                if (parameters['variants'] === undefined) {
                    reject(new Error('Missing required  parameter: variants'));
                    return;
                }

                if (parameters.$queryParameters) {
                    Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                        var parameter = parameters.$queryParameters[parameterName];
                        queryParameters[parameterName] = parameter;
                    });
                }

                request('POST', domain + path, body, headers, queryParameters, form, reject, resolve, errorHandlers);

            }).then(function(response: request.Response) {
                return response.body;
            });
        };

    fetchMutationAssessorAnnotationGETURL(parameters: {
        'variant': string,
        $queryParameters ? : any
    }): string {
        let queryParameters: any = {};
        let path = '/mutation_assessor/{variant}';

        path = path.replace('{variant}', parameters['variant'] + '');

        if (parameters.$queryParameters) {
            Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                var parameter = parameters.$queryParameters[parameterName];
                queryParameters[parameterName] = parameter;
            });
        }
        let keys = Object.keys(queryParameters);
        return this.domain + path + (keys.length > 0 ? '?' + (keys.map(key => key + '=' + encodeURIComponent(queryParameters[key])).join('&')) : '');
    };

    /**
     * Retrieves mutation assessor information for the provided list of variants
     * @method
     * @name GenomeNexusAPIInternal#fetchMutationAssessorAnnotationGET
     * @param {string} variant - A variants. For example 7:g.140453136A>T
     */
    fetchMutationAssessorAnnotationGET(parameters: {
        'variant': string,
        $queryParameters ? : any,
        $domain ? : string
    }): Promise < MutationAssessor > {
        const domain = parameters.$domain ? parameters.$domain : this.domain;
        const errorHandlers = this.errorHandlers;
        const request = this.request;
        let path = '/mutation_assessor/{variant}';
        let body: any;
        let queryParameters: any = {};
        let headers: any = {};
        let form: any = {};
        return new Promise(function(resolve, reject) {
            headers['Accept'] = 'application/json';
            headers['Content-Type'] = 'application/json';

            path = path.replace('{variant}', parameters['variant'] + '');

            if (parameters['variant'] === undefined) {
                reject(new Error('Missing required  parameter: variant'));
                return;
            }

            if (parameters.$queryParameters) {
                Object.keys(parameters.$queryParameters).forEach(function(parameterName) {
                    var parameter = parameters.$queryParameters[parameterName];
                    queryParameters[parameterName] = parameter;
                });
            }

            request('GET', domain + path, body, headers, queryParameters, form, reject, resolve, errorHandlers);

        }).then(function(response: request.Response) {
            return response.body;
        });
    };

}