import * as React from 'react';
import { observer } from 'mobx-react';
import FontAwesome from 'react-fontawesome';
import {
    FeatureFlagEnum,
    getFeatureFlagDisplayInfo,
    isFeatureFlagOptable,
} from 'shared/featureFlags';
import { FeatureFlagStore } from 'shared/FeatureFlagStore';
import { getServerConfig } from 'config/config';
import styles from './styles.module.scss';

interface IFeatureFlagsSectionProps {
    featureFlagStore: FeatureFlagStore;
}

@observer
export default class FeatureFlagsSection extends React.Component<
    IFeatureFlagsSectionProps,
    {}
> {
    private toggle(flag: string, enabled: boolean) {
        if (enabled) {
            this.props.featureFlagStore.remove(flag);
        } else {
            this.props.featureFlagStore.add(flag);
        }
    }

    render() {
        const appName = getServerConfig().app_name;
        const flags = Object.values(FeatureFlagEnum).filter(flag => {
            const { alwaysOn } = getFeatureFlagDisplayInfo(flag, appName);
            return alwaysOn || isFeatureFlagOptable(flag, appName);
        });

        return (
            <div className={styles.card}>
                <h4>
                    <FontAwesome name="flask" /> Feature Flags
                </h4>
                <p className={styles.subtext}>
                    Experimental features you can opt into. Disabling a flag
                    reloads the page to apply the change.
                </p>
                <ul className={styles.flagList}>
                    {flags.map(flag => {
                        const enabled = this.props.featureFlagStore.has(flag);
                        const {
                            description,
                            exampleUrl,
                            alwaysOn,
                        } = getFeatureFlagDisplayInfo(flag, appName);
                        const optable = isFeatureFlagOptable(flag, appName);

                        return (
                            <li key={flag}>
                                {optable ? (
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={enabled}
                                            onChange={() =>
                                                this.toggle(flag, enabled)
                                            }
                                        />{' '}
                                        <strong>{flag}</strong>
                                    </label>
                                ) : (
                                    <div>
                                        <strong>{flag}</strong>{' '}
                                        <span className={styles.badge}>
                                            Always on for this portal
                                        </span>
                                    </div>
                                )}
                                <div className={styles.subtext}>
                                    {description}
                                    {alwaysOn && optable && (
                                        <span>
                                            {' '}
                                            Already enabled by default for this
                                            portal.
                                        </span>
                                    )}
                                </div>
                                {exampleUrl && (
                                    <div className={styles.meta}>
                                        <a href={exampleUrl}>See an example</a>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    }
}
