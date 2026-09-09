import * as React from 'react';
import { observer } from 'mobx-react';
import { MobxPromise } from 'cbioportal-frontend-commons';
import { DataAccessToken } from 'cbioportal-ts-api-client/dist/generated/CBioPortalAPIInternal';
import LoadingIndicator from 'shared/components/loadingIndicator/LoadingIndicator';
import { buildCBioPortalAPIUrl } from 'shared/api/urls';
import styles from './styles.module.scss';

interface IDataAccessTokenSectionProps {
    supported: boolean;
    dataAccessTokens: MobxPromise<DataAccessToken[]>;
}

@observer
export default class DataAccessTokenSection extends React.Component<
    IDataAccessTokenSectionProps,
    {}
> {
    private generateToken() {
        window.open(buildCBioPortalAPIUrl('api/data-access-token'), '_blank');
    }

    render() {
        const { supported, dataAccessTokens } = this.props;

        return (
            <div className={styles.card}>
                <h4>Data Access Token</h4>
                {!supported && (
                    <p className={styles.subtext}>
                        Data access tokens are not available on this cBioPortal
                        instance.
                    </p>
                )}
                {supported && dataAccessTokens.isPending && (
                    <LoadingIndicator isLoading={true} />
                )}
                {supported &&
                    !dataAccessTokens.isPending &&
                    (dataAccessTokens.result!.length === 0 ? (
                        <p className={styles.subtext}>
                            You have not generated a data access token.
                        </p>
                    ) : (
                        <ul className={styles.itemList}>
                            {dataAccessTokens.result!.map(token => {
                                const expired =
                                    new Date(token.expiration).getTime() <
                                    Date.now();
                                return (
                                    <li key={token.token}>
                                        <span
                                            className={
                                                expired
                                                    ? 'text-danger'
                                                    : 'text-success'
                                            }
                                        >
                                            {expired ? 'Expired' : 'Active'}
                                        </span>
                                        <div className={styles.meta}>
                                            Expires{' '}
                                            {new Date(
                                                token.expiration
                                            ).toLocaleDateString()}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ))}
                {supported && (
                    <button
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: 10 }}
                        onClick={() => this.generateToken()}
                    >
                        Generate New Token
                    </button>
                )}
            </div>
        );
    }
}
