export interface RecentRelease {
    id: string;
    title: string;
    category: string;
    description: string;
    getUrl: (appName: string | undefined | null) => string;
    /** restricts visibility to these app_names. Omit for "every portal". */
    portals?: string[];
}

export const RECENT_RELEASES: RecentRelease[] = [
    {
        id: 'ai-chat',
        title: 'AI Chat',
        category: 'AI Features',
        description:
            'Ask questions about your data in natural language with an AI ' +
            'chat assistant.',
        getUrl: appName =>
            appName === 'mskcc-portal'
                ? 'https://chat.cbioportal.aws.mskcc.org'
                : 'https://chat.cbioportal.org',
        portals: ['mskcc-portal', 'public-portal'],
    },
];

export function isRecentReleaseVisible(
    release: RecentRelease,
    appName: string | undefined | null
): boolean {
    if (!release.portals || release.portals.length === 0) {
        return true;
    }
    return !!appName && release.portals.includes(appName);
}
