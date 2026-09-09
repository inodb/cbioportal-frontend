import * as React from 'react';
import { observer } from 'mobx-react';
import Helmet from 'react-helmet';
import { getBrowserWindow } from 'cbioportal-frontend-commons';
import { PageLayout } from 'shared/components/PageLayout/PageLayout';
import { UserProfilePageStore } from './UserProfilePageStore';
import FeatureFlagsSection from './FeatureFlagsSection';
import VirtualStudiesSection from './VirtualStudiesSection';
import ComparisonGroupsSection from './ComparisonGroupsSection';
import DataAccessTokenSection from './DataAccessTokenSection';
import UserRoleSection from './UserRoleSection';
import styles from './styles.module.scss';

@observer
export default class UserProfilePage extends React.Component<{}, {}> {
    private store: UserProfilePageStore;

    private get appStore() {
        return getBrowserWindow().globalStores.appStore;
    }

    constructor(props: any) {
        super(props);
        this.store = new UserProfilePageStore();
    }

    public render() {
        return (
            <PageLayout className={'whiteBackground'}>
                <div className={styles.userProfilePage}>
                    <Helmet>
                        <title>
                            {'cBioPortal for Cancer Genomics::My Account'}
                        </title>
                    </Helmet>

                    <h1>My Account</h1>
                    {this.appStore.userName && (
                        <p className={styles.subtext}>
                            Signed in as {this.appStore.userName}
                        </p>
                    )}

                    <div className={styles.sectionGrid}>
                        <FeatureFlagsSection
                            featureFlagStore={this.appStore.featureFlagStore}
                        />
                        <VirtualStudiesSection
                            virtualStudies={this.store.virtualStudies}
                        />
                        <ComparisonGroupsSection
                            comparisonGroups={this.store.comparisonGroups}
                        />
                        <DataAccessTokenSection
                            supported={this.store.dataAccessTokenSupported}
                            dataAccessTokens={this.store.dataAccessTokens}
                        />
                        <UserRoleSection
                            userRoleStore={this.store.userRoleStore}
                        />
                    </div>
                </div>
            </PageLayout>
        );
    }
}
